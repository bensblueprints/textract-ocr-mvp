'use strict';
// Pure-Node smoke test for Textract's core OCR pipeline — no Electron GUI
// required. Exercises: image OCR, searchable-PDF invisible text layer,
// PDF-input rasterization, batch folder mode, and preprocessing.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const sharp = require('sharp');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');

const ocr = require('../src/core/ocr');
const searchablePdf = require('../src/core/searchablePdf');
const pdfPages = require('../src/core/pdfPages');
const batch = require('../src/core/batch');
const preprocess = require('../src/core/preprocess');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TMP_DIR = path.join(__dirname, 'tmp');

function normalize(text) {
  return text.toUpperCase().replace(/\s+/g, ' ').trim();
}

function containsWords(text, words) {
  const norm = normalize(text);
  return words.every((w) => norm.includes(w.toUpperCase()));
}

async function makeTextImage(text, opts = {}) {
  const width = opts.width || 900;
  const height = opts.height || 200;
  const fill = opts.fill || '#000000';
  const fontSize = opts.fontSize || 32;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white" />
      <text x="30" y="${Math.round(height / 2 + fontSize / 3)}" font-size="${fontSize}"
            font-family="Arial, sans-serif" fill="${fill}">${text}</text>
    </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function step1_imageOcr() {
  console.log('\n[1] Image OCR (sharp-generated fixture)...');
  const buf = await makeTextImage('THE QUICK BROWN FOX 12345');
  fs.writeFileSync(path.join(FIXTURES_DIR, 'quick-brown-fox.png'), buf);

  const result = await ocr.recognizeImage(buf, { langs: ['eng'] });
  console.log('  extracted:', JSON.stringify(result.text.trim()));
  console.log('  confidence:', result.confidence);

  assert.ok(containsWords(result.text, ['QUICK', 'BROWN', 'FOX', '12345']), 'OCR text should contain expected words');
  assert.ok(result.confidence > 60, `mean confidence should be > 60, got ${result.confidence}`);
  assert.ok(result.words.length > 0, 'should return per-word bounding boxes');
  console.log('  PASS');
  return { buf, result };
}

async function step2_searchablePdf(buf, result) {
  console.log('\n[2] Searchable PDF (invisible text layer)...');
  const meta = await sharp(buf).metadata();
  const pdfBuffer = await searchablePdf.buildSearchablePdf([
    { imageBuffer: buf, dpi: 96, words: result.words },
  ]);
  const outPath = path.join(TMP_DIR, 'quick-brown-fox.pdf');
  fs.writeFileSync(outPath, pdfBuffer);

  assert.ok(fs.existsSync(outPath), 'searchable PDF should exist on disk');
  const stat = fs.statSync(outPath);
  assert.ok(stat.size > 1024, `PDF should be > 1KB, got ${stat.size}`);
  assert.strictEqual(pdfBuffer.slice(0, 4).toString('ascii'), '%PDF', 'PDF should start with %PDF header');

  const parsed = await pdfParse(pdfBuffer);
  console.log('  pdf-parse extracted:', JSON.stringify(parsed.text.trim()));
  assert.ok(normalize(parsed.text).includes('QUICK BROWN FOX'), 'round-tripped PDF text should contain "QUICK BROWN FOX"');
  console.log('  PASS (meta width/height:', meta.width, meta.height, ')');
}

async function step3_pdfInputPath() {
  console.log('\n[3] PDF input path (2-page PDF -> rasterize -> OCR)...');
  const page1Img = await makeTextImage('PAGEONE MARKER TEXT');
  const page2Img = await makeTextImage('PAGETWO MARKER TEXT');

  const pdfDoc = await PDFDocument.create();
  for (const imgBuf of [page1Img, page2Img]) {
    const meta = await sharp(imgBuf).metadata();
    const pngBuf = await sharp(imgBuf).png().toBuffer();
    const embedded = await pdfDoc.embedPng(pngBuf);
    const ptsPerPixel = 72 / 96;
    const w = meta.width * ptsPerPixel;
    const h = meta.height * ptsPerPixel;
    const page = pdfDoc.addPage([w, h]);
    page.drawImage(embedded, { x: 0, y: 0, width: w, height: h });
  }
  const twoPagePdfBytes = await pdfDoc.save();
  const twoPagePdfPath = path.join(FIXTURES_DIR, 'two-page.pdf');
  fs.writeFileSync(twoPagePdfPath, twoPagePdfBytes);

  const pageCount = await pdfPages.getPageCount(twoPagePdfPath);
  assert.strictEqual(pageCount, 2, 'PDF should report 2 pages');

  const pageResults = [];
  for await (const p of pdfPages.iteratePages(twoPagePdfPath, { dpi: 150 })) {
    const res = await ocr.recognizeImage(p.buffer, { langs: ['eng'] });
    pageResults.push({ pageNumber: p.pageNumber, text: res.text });
    console.log(`  page ${p.pageNumber} extracted:`, JSON.stringify(res.text.trim()));
  }

  assert.strictEqual(pageResults.length, 2, 'should produce 2 page results');
  assert.ok(containsWords(pageResults[0].text, ['PAGEONE']), 'page 1 should contain PAGEONE');
  assert.ok(containsWords(pageResults[1].text, ['PAGETWO']), 'page 2 should contain PAGETWO');
  console.log('  PASS');
}

async function step4_batchFolder() {
  console.log('\n[4] Batch folder mode (3 images -> 3 .txt outputs)...');
  const batchDir = path.join(TMP_DIR, 'batch-input');
  fs.mkdirSync(batchDir, { recursive: true });

  const markers = ['ALPHA', 'BRAVO', 'CHARLIE'];
  for (const marker of markers) {
    const img = await makeTextImage(`${marker} DOCUMENT SAMPLE`);
    fs.writeFileSync(path.join(batchDir, `${marker.toLowerCase()}.png`), img);
  }

  const outDir = path.join(TMP_DIR, 'batch-output');
  const summary = await batch.runBatch(batchDir, { outputDir: outDir, langs: ['eng'] });

  console.log('  summary:', JSON.stringify({ files: summary.files, ok: summary.ok, failed: summary.failed.length }));
  assert.strictEqual(summary.files, 3, 'should discover 3 files');
  assert.strictEqual(summary.ok, 3, 'all 3 should OCR successfully');
  assert.strictEqual(summary.failed.length, 0, 'no failures expected');

  for (const marker of markers) {
    const txtPath = path.join(outDir, `${marker.toLowerCase()}.txt`);
    assert.ok(fs.existsSync(txtPath), `${txtPath} should exist`);
    const content = fs.readFileSync(txtPath, 'utf8');
    assert.ok(containsWords(content, [marker]), `${txtPath} should contain ${marker}`);
  }
  console.log('  PASS');
}

async function step5_preprocessing() {
  console.log('\n[5] Preprocessing (low-contrast image, on vs off)...');
  const lowContrastImg = await makeTextImage('FAINT MARKER WORD', { fill: '#cfcfcf' });
  fs.writeFileSync(path.join(FIXTURES_DIR, 'low-contrast.png'), lowContrastImg);

  const rawResult = await ocr.recognizeImage(lowContrastImg, { langs: ['eng'] });
  console.log('  raw OCR:', JSON.stringify(rawResult.text.trim()));

  const processedBuf = await preprocess.grayscaleThreshold(lowContrastImg);
  const processedResult = await ocr.recognizeImage(processedBuf, { langs: ['eng'] });
  console.log('  preprocessed OCR:', JSON.stringify(processedResult.text.trim()));

  assert.ok(
    containsWords(processedResult.text, ['MARKER']),
    'preprocessed (grayscale+threshold) result should contain MARKER'
  );
  console.log('  PASS (preprocessing recovers text from low-contrast source)');
}

async function main() {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  try {
    const { buf, result } = await step1_imageOcr();
    await step2_searchablePdf(buf, result);
    await step3_pdfInputPath();
    await step4_batchFolder();
    await step5_preprocessing();

    console.log('\nAll smoke tests PASSED.');
    process.exitCode = 0;
  } catch (err) {
    console.error('\nSMOKE TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    await ocr.terminate();
  }
}

main();
