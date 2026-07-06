'use strict';
// Resolves tesseract.js worker/core/lang paths so OCR runs fully offline,
// whether we're running from source (dev, `npm start`), a packaged Electron
// app (extraResources), or a bare Node process (test/smoke.js).
const path = require('path');
const fs = require('fs');

function firstExisting(candidates) {
  for (const c of candidates) {
    try {
      if (c && fs.existsSync(c)) return c;
    } catch (_e) {
      /* ignore */
    }
  }
  return candidates[0];
}

function isElectron() {
  return !!(process.versions && process.versions.electron);
}

// True when tesseract.js will spawn its BROWSER worker (a real Worker /
// WebWorker context: Electron renderer, or a renderer running under
// Electron's Node.js integration where `window` still exists). False for
// a plain Node process (test/smoke.js, or any Node-side helper), where
// tesseract.js spawns a worker_threads Worker instead and needs the
// Node-flavored worker script, not the browser bundle.
function isBrowserLike() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function resourcesRoot() {
  // electron packaged app: process.resourcesPath/tessdata etc (extraResources)
  if (isElectron() && process.resourcesPath) {
    return process.resourcesPath;
  }
  return null;
}

const repoRoot = path.join(__dirname, '..', '..');

function getWorkerPath() {
  const packaged = resourcesRoot();
  if (isBrowserLike()) {
    // Electron renderer: real browser Worker context -> browser worker bundle.
    return firstExisting([
      packaged && path.join(packaged, 'tesseract', 'worker.min.js'),
      path.join(repoRoot, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'),
    ].filter(Boolean));
  }
  // Plain Node (smoke tests, or a Node-side helper): tesseract.js uses
  // worker_threads directly, which needs the Node worker-script, not the
  // browser dist bundle (which assumes `self`/`addEventListener`).
  return path.join(repoRoot, 'node_modules', 'tesseract.js', 'src', 'worker-script', 'node', 'index.js');
}

function getCorePath() {
  const packaged = resourcesRoot();
  // A directory containing all 4 tesseract-core*.wasm.js variants lets
  // tesseract.js pick the right one (SIMD/non-SIMD, LSTM/legacy) itself.
  return firstExisting([
    packaged && path.join(packaged, 'tesseract', 'core'),
    path.join(repoRoot, 'node_modules', 'tesseract.js-core'),
  ].filter(Boolean));
}

function getBundledLangPath() {
  // English traineddata shipped in the app (resources/tessdata in dev,
  // extraResources 'tessdata' when packaged).
  const packaged = resourcesRoot();
  return firstExisting([
    packaged && path.join(packaged, 'tessdata'),
    path.join(repoRoot, 'resources', 'tessdata'),
  ].filter(Boolean));
}

function getUserDataDir() {
  if (isElectron()) {
    try {
      // Lazily require electron only when actually running inside it —
      // keeps this module requireable from plain Node (smoke tests).
      const { app } = require('electron');
      return app.getPath('userData');
    } catch (_e) {
      /* fall through */
    }
  }
  return path.join(repoRoot, '.userdata');
}

function getUserLangDir() {
  const dir = path.join(getUserDataDir(), 'tessdata');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = {
  getWorkerPath,
  getCorePath,
  getBundledLangPath,
  getUserDataDir,
  getUserLangDir,
  isElectron,
  isBrowserLike,
};
