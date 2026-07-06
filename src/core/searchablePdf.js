'use strict';
// Builds a searchable PDF: each page = the original page image, with an
// invisible (opacity 0) text layer positioned from tesseract word bounding
// boxes so the page is Ctrl-F-able and copy/paste-able in any PDF reader.
//
// tesseract bboxes are in SOURCE-IMAGE PIXELS with y increasing downward.
// PDF page geometry is in POINTS (1/72 inch) with y increasing upward.
// We size each PDF page at (imagePixels / dpi) * 72 so image pixels map
// 1:1 (scaled by ptsPerPixel = 72 / dpi) onto page points.
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const sharp = require('sharp');

const DEFAULT_DPI = 200;

async function embedRasterImage(pdfDoc, imageBuffer) {
  // Normalize to PNG so pdf-lib can always embed it, regardless of source format.
  const meta = await sharp(imageBuffer).metadata();
  const isJpeg = meta.format === 'jpeg' || meta.format === 'jpg';
  if (isJpeg) {
    return { image: await pdfDoc.embedJpg(imageBuffer), meta };
  }
  const pngBuffer = await sharp(imageBuffer).png().toBuffer();
  const image = await pdfDoc.embedPng(pngBuffer);
  const pngMeta = await sharp(pngBuffer).metadata();
  return { image, meta: pngMeta };
}

/**
 * @param {Array<{imageBuffer: Buffer, dpi?: number, words: Array<{text:string, bbox:{x0,y0,x1,y1}}>}>} pages
 * @returns {Promise<Buffer>}
 */
async function buildSearchablePdf(pages) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const page of pages) {
    const dpi = page.dpi || DEFAULT_DPI;
    const ptsPerPixel = 72 / dpi;
    const { image, meta } = await embedRasterImage(pdfDoc, page.imageBuffer);
    const widthPx = meta.width || image.width;
    const heightPx = meta.height || image.height;
    const pageWidth = widthPx * ptsPerPixel;
    const pageHeight = heightPx * ptsPerPixel;

    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });

    for (const w of page.words || []) {
      const text = (w.text || '').trim();
      if (!text) continue;
      const bbox = w.bbox || {};
      const x0 = (bbox.x0 || 0) * ptsPerPixel;
      const x1 = (bbox.x1 || 0) * ptsPerPixel;
      const y0 = (bbox.y0 || 0) * ptsPerPixel;
      const y1 = (bbox.y1 || 0) * ptsPerPixel;
      const boxHeight = Math.max(1, y1 - y0);
      const fontSize = Math.max(1, boxHeight * 0.85);

      // Trailing space: each word is its own positioned drawText call (so
      // layout/alignment is unaffected), but text-extraction tools like
      // pdf-parse/pdf.js concatenate content-stream text runs without
      // inserting whitespace of their own — without this, adjacent words
      // glue together ("BROWNFOX") when copy-pasted or Ctrl-F'd.
      pdfPage.drawText(`${text} `, {
        x: x0,
        y: pageHeight - y1,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        opacity: 0, // invisible — present for text extraction/search only
      });
    }
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

module.exports = { buildSearchablePdf, DEFAULT_DPI };
