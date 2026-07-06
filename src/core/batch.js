'use strict';
// Batch folder mode: discover supported files, OCR each, write .txt outputs
// alongside sources (or to a chosen output dir), and produce a summary.
const fs = require('fs');
const path = require('path');
const ocr = require('./ocr');
const pdfPages = require('./pdfPages');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff', '.tif']);
const PDF_EXT = '.pdf';

function walk(dir, recursive) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) out.push(...walk(full, recursive));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTS.has(ext) || ext === PDF_EXT) out.push(full);
    }
  }
  return out;
}

/**
 * @param {string} folder
 * @param {{recursive?: boolean, outputDir?: string, langs?: string[], onProgress?: (evt:object)=>void}} opts
 * @returns {Promise<{files:number, pages:number, words:number, ok:number, failed:Array, results:Array}>}
 */
async function runBatch(folder, opts = {}) {
  const recursive = !!opts.recursive;
  const files = walk(folder, recursive);
  const outputDir = opts.outputDir || folder;
  fs.mkdirSync(outputDir, { recursive: true });

  const summary = { files: files.length, pages: 0, words: 0, ok: 0, failed: [], results: [] };

  for (const filePath of files) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      const base = path.basename(filePath, ext);
      let combinedText = '';
      let pageCount = 0;

      if (ext === PDF_EXT) {
        for await (const p of pdfPages.iteratePages(filePath, {})) {
          const res = await ocr.recognizeImage(p.buffer, { langs: opts.langs });
          combinedText += `\n--- Page ${p.pageNumber} ---\n${res.text}\n`;
          pageCount += 1;
        }
      } else {
        const buffer = fs.readFileSync(filePath);
        const res = await ocr.recognizeImage(buffer, { langs: opts.langs });
        combinedText = res.text;
        pageCount = 1;
      }

      const outPath = path.join(outputDir, `${base}.txt`);
      fs.writeFileSync(outPath, combinedText, 'utf8');

      summary.pages += pageCount;
      summary.words += combinedText.trim().split(/\s+/).filter(Boolean).length;
      summary.ok += 1;
      summary.results.push({ file: filePath, outPath, pages: pageCount, ok: true });
      if (opts.onProgress) opts.onProgress({ file: filePath, ok: true, done: summary.ok + summary.failed.length, total: files.length });
    } catch (err) {
      summary.failed.push({ file: filePath, error: err.message || String(err) });
      if (opts.onProgress) opts.onProgress({ file: filePath, ok: false, error: err.message, done: summary.ok + summary.failed.length, total: files.length });
    }
  }

  return summary;
}

module.exports = { runBatch, walk, IMAGE_EXTS };
