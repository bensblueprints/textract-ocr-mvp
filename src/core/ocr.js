'use strict';
// Pure OCR core — requireable from plain Node (test/smoke.js) or from the
// Electron renderer. Always points tesseract.js at local files: never a CDN.
const { createWorker } = require('tesseract.js');
const paths = require('./paths');

let workerPromise = null;
let workerLangs = null;

async function getWorker(langs) {
  const key = langs.join('+');
  if (workerPromise && workerLangs === key) return workerPromise;
  if (workerPromise) {
    const old = await workerPromise;
    await old.terminate();
    workerPromise = null;
  }
  workerLangs = key;
  workerPromise = createWorker(langs, 1, {
    workerPath: paths.getWorkerPath(),
    corePath: paths.getCorePath(),
    langPath: paths.getBundledLangPath(),
    cachePath: paths.getUserLangDir(),
    gzip: false,
    cacheMethod: 'none',
    logger: () => {},
  });
  return workerPromise;
}

/**
 * Run OCR on an image buffer (png/jpg/etc).
 * @param {Buffer} imageBuffer
 * @param {{langs?: string[], onProgress?: (p:number)=>void}} opts
 * @returns {Promise<{text:string, confidence:number, words:Array}>}
 */
async function recognizeImage(imageBuffer, opts = {}) {
  const langs = opts.langs && opts.langs.length ? opts.langs : ['eng'];
  const worker = await getWorker(langs);
  const { data } = await worker.recognize(imageBuffer);
  const words = (data.words || []).map((w) => ({
    text: w.text,
    confidence: w.confidence,
    bbox: w.bbox, // {x0,y0,x1,y1} in source-image pixels
  }));
  return {
    text: data.text || '',
    confidence: typeof data.confidence === 'number' ? data.confidence : 0,
    words,
  };
}

async function terminate() {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
    workerLangs = null;
  }
}

module.exports = { recognizeImage, terminate };
