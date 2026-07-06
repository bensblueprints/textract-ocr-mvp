'use strict';
// Rasterizes a PDF into per-page PNG buffers, lazily (one page at a time),
// so large PDFs don't blow up memory. Uses pdfjs-dist's legacy Node build
// with @napi-rs/canvas as the canvas factory — no native pdftoppm/poppler
// dependency, works headlessly from plain Node (smoke tests) too.
const fs = require('fs');
const { createCanvas } = require('@napi-rs/canvas');

// pdfjs-dist v4 ships ESM-only, even its "legacy" Node build — load it via
// dynamic import() from this CJS module and cache the module handle.
let pdfjsLibPromise = null;
function getPdfjsLib() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLibPromise;
}

const DEFAULT_DPI = 200;
const PDF_POINTS_PER_INCH = 72;

class NodeCanvasFactory {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function loadPdf(input) {
  const pdfjsLib = await getPdfjsLib();
  const data = Buffer.isBuffer(input) ? new Uint8Array(input) : new Uint8Array(fs.readFileSync(input));
  const loadingTask = pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    useSystemFonts: false,
  });
  return loadingTask.promise;
}

/**
 * @param {string|Buffer} input path or buffer of the source PDF
 * @param {{dpi?: number}} opts
 * @returns {Promise<number>} page count
 */
async function getPageCount(input, opts = {}) {
  const doc = await loadPdf(input);
  const count = doc.numPages;
  await doc.destroy();
  return count;
}

/**
 * Rasterize a single 1-based page to a PNG buffer at the given DPI.
 * @returns {Promise<{buffer: Buffer, width: number, height: number, dpi: number}>}
 */
async function renderPage(input, pageNumber, opts = {}) {
  const dpi = opts.dpi || DEFAULT_DPI;
  const scale = dpi / PDF_POINTS_PER_INCH;
  const doc = await loadPdf(input);
  try {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const factory = new NodeCanvasFactory();
    const { canvas, context } = factory.create(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    const renderTask = page.render({
      canvasContext: context,
      viewport,
      canvasFactory: factory,
    });
    await renderTask.promise;
    const buffer = canvas.toBuffer('image/png');
    return { buffer, width: canvas.width, height: canvas.height, dpi };
  } finally {
    await doc.destroy();
  }
}

/**
 * Lazily yields { pageNumber, buffer, width, height, dpi } for every page.
 * Renders one page at a time to keep memory bounded on large PDFs.
 */
async function* iteratePages(input, opts = {}) {
  const count = await getPageCount(input, opts);
  for (let i = 1; i <= count; i++) {
    const rendered = await renderPage(input, i, opts);
    yield { pageNumber: i, ...rendered };
  }
}

module.exports = { getPageCount, renderPage, iteratePages, DEFAULT_DPI };
