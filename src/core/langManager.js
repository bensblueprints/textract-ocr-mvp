'use strict';
// The ONLY network call in Textract: downloading additional language
// traineddata files on demand. English is bundled; everything else is
// fetched from tessdata_fast into userData/tessdata, with a progress UI
// the caller drives via onProgress.
const fs = require('fs');
const path = require('path');
const https = require('https');
const paths = require('./paths');

const TESSDATA_FAST_BASE = 'https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/';

// A representative subset — full ISO list can be extended freely; these are
// the languages most likely to be requested.
const AVAILABLE_LANGS = [
  { code: 'eng', name: 'English', bundled: true },
  { code: 'deu', name: 'German' },
  { code: 'fra', name: 'French' },
  { code: 'spa', name: 'Spanish' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'nld', name: 'Dutch' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'rus', name: 'Russian' },
  { code: 'ara', name: 'Arabic' },
];

function isInstalled(code) {
  const userFile = path.join(paths.getUserLangDir(), `${code}.traineddata`);
  const bundledFile = path.join(paths.getBundledLangPath(), `${code}.traineddata`);
  return fs.existsSync(userFile) || fs.existsSync(bundledFile);
}

function listLangs() {
  return AVAILABLE_LANGS.map((l) => ({ ...l, installed: isInstalled(l.code) }));
}

function download(url, destFile, onProgress) {
  return new Promise((resolve, reject) => {
    const tmp = destFile + '.part';
    const file = fs.createWriteStream(tmp);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(tmp, () => {});
          return resolve(download(res.headers.location, destFile, onProgress));
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(tmp, () => {});
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          if (onProgress) onProgress({ received, total, pct: total ? received / total : 0 });
        });
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            fs.renameSync(tmp, destFile);
            resolve(destFile);
          });
        });
      })
      .on('error', (err) => {
        file.close();
        fs.unlink(tmp, () => {});
        reject(err);
      });
  });
}

/**
 * @param {string} code language code e.g. 'deu'
 * @param {(p:{received:number,total:number,pct:number})=>void} onProgress
 */
async function downloadLang(code, onProgress) {
  if (isInstalled(code)) return { code, alreadyInstalled: true };
  const dest = path.join(paths.getUserLangDir(), `${code}.traineddata`);
  const url = `${TESSDATA_FAST_BASE}${code}.traineddata`;
  await download(url, dest, onProgress);
  return { code, alreadyInstalled: false, path: dest };
}

module.exports = { listLangs, downloadLang, isInstalled, AVAILABLE_LANGS };
