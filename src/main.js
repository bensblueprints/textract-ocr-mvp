'use strict';
const {
  app, BrowserWindow, ipcMain, dialog, shell, clipboard,
  globalShortcut, Tray, Menu, screen, desktopCapturer, nativeImage,
} = require('electron');
const path = require('path');
const fs = require('fs');

const ocr = require('./core/ocr');
const searchablePdf = require('./core/searchablePdf');
const pdfPages = require('./core/pdfPages');
const batch = require('./core/batch');
const langManager = require('./core/langManager');
const store = require('./core/store');

let mainWindow = null;
let overlayWindow = null;
let toastWindow = null;
let tray = null;
let overlayResolvers = null;

const ICON_PATH = path.join(__dirname, 'renderer', 'assets', 'icon.png');

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: 'Textract',
    backgroundColor: '#0b0d12',
    autoHideMenuBar: true,
    icon: fs.existsSync(ICON_PATH) ? ICON_PATH : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    if (app.isQuiting) return;
    // Keep running in tray instead of fully closing, so the global hotkey
    // and screenshot-to-text flow keep working while "minimized".
    if (tray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  try {
    const image = fs.existsSync(ICON_PATH) ? nativeImage.createFromPath(ICON_PATH) : nativeImage.createEmpty();
    tray = new Tray(image);
    tray.setToolTip('Textract — offline OCR');
    const menu = Menu.buildFromTemplate([
      { label: 'Open Textract', click: () => { mainWindow.show(); } },
      { label: 'Capture region', click: () => beginRegionCapture().catch(() => {}) },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => { mainWindow.show(); });
  } catch (err) {
    console.error('Tray init failed', err);
  }
}

function registerHotkey(accel) {
  globalShortcut.unregisterAll();
  if (!accel) return { ok: true, registered: false };
  const ok = globalShortcut.register(accel, () => {
    beginRegionCapture().catch((err) => console.error('capture failed', err));
  });
  return { ok, registered: ok };
}

app.whenReady().then(() => {
  createMainWindow();
  createTray();
  const settings = store.getSettings();
  registerHotkey(settings.hotkey);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow.show();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !tray) app.quit();
});

// ---------------- helpers ----------------
const wrap = (fn) => async (_evt, ...args) => {
  try {
    const result = await fn(...args);
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  }
};

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif'];

// ---------------- dialogs / discovery ----------------
ipcMain.handle('ocr:openFiles', wrap(async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose images or PDFs',
    filters: [
      { name: 'Images & PDFs', extensions: [...IMAGE_EXTS, 'pdf'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });
  return canceled ? [] : filePaths;
}));

ipcMain.handle('ocr:openFolder', wrap(async (recursive = true) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder to batch OCR',
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths[0]) return { folder: '', files: [] };
  const files = batch.walk(filePaths[0], recursive);
  return { folder: filePaths[0], files };
}));

ipcMain.handle('dialog:pickOutputDir', wrap(async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose output folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  return canceled ? '' : filePaths[0];
}));

ipcMain.handle('dialog:pickSavePath', wrap(async (defaultName, extFilter) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save as',
    defaultPath: defaultName,
    filters: extFilter ? [extFilter] : undefined,
  });
  return canceled ? '' : filePath;
}));

ipcMain.handle('app:revealInFolder', wrap(async (filePath) => {
  shell.showItemInFolder(filePath);
  return true;
}));

ipcMain.handle('clipboard:write', wrap(async (text) => {
  clipboard.writeText(text || '');
  return true;
}));

ipcMain.handle('fs:readFile', wrap(async (filePath) => fs.readFileSync(filePath)));
ipcMain.handle('fs:writeText', wrap(async (filePath, text) => {
  fs.writeFileSync(filePath, text, 'utf8');
  return filePath;
}));
ipcMain.handle('fs:writeFile', wrap(async (filePath, buffer) => {
  fs.writeFileSync(filePath, Buffer.from(buffer));
  return filePath;
}));

// ---------------- OCR ----------------
// A single file (image or PDF) -> per-page OCR results. Runs in the main
// (Node) process against src/core/ocr.js — the exact module + code path
// proven by test/smoke.js, so "works in tests" and "works in the app" are
// the same code, not a renderer-side reimplementation.
ipcMain.handle('ocr:recognizeFile', wrap(async (filePath, opts = {}) => {
  const ext = path.extname(filePath).toLowerCase();
  const pages = [];
  if (ext === '.pdf') {
    for await (const p of pdfPages.iteratePages(filePath, { dpi: opts.dpi || 200 })) {
      const res = await ocr.recognizeImage(p.buffer, { langs: opts.langs });
      pages.push({
        pageNumber: p.pageNumber,
        text: res.text,
        confidence: res.confidence,
        words: res.words,
        imageBase64: p.buffer.toString('base64'),
        width: p.width,
        height: p.height,
        dpi: p.dpi,
      });
    }
  } else {
    const buffer = fs.readFileSync(filePath);
    let ocrBuffer = buffer;
    if (opts.preprocess) {
      const preprocess = require('./core/preprocess');
      ocrBuffer = await preprocess.grayscaleThreshold(buffer);
    }
    const res = await ocr.recognizeImage(ocrBuffer, { langs: opts.langs });
    pages.push({
      pageNumber: 1,
      text: res.text,
      confidence: res.confidence,
      words: res.words,
      imageBase64: buffer.toString('base64'),
      dpi: 96,
    });
  }
  return { file: filePath, pages };
}));

ipcMain.handle('ocr:buildSearchablePdf', wrap(async (pages, outPath) => {
  const pdfPagesInput = pages.map((p) => ({
    imageBuffer: Buffer.from(p.imageBase64, 'base64'),
    dpi: p.dpi || 200,
    words: p.words || [],
  }));
  const buffer = await searchablePdf.buildSearchablePdf(pdfPagesInput);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}));

// ---------------- batch ----------------
ipcMain.handle('batch:run', wrap(async (folder, opts = {}) => {
  const summary = await batch.runBatch(folder, {
    recursive: opts.recursive,
    outputDir: opts.outputDir,
    langs: opts.langs,
    onProgress: (evt) => {
      if (mainWindow) mainWindow.webContents.send('batch:progress', evt);
    },
  });
  return summary;
}));

// ---------------- languages ----------------
ipcMain.handle('lang:list', wrap(async () => langManager.listLangs()));
ipcMain.handle('lang:download', wrap(async (code) => langManager.downloadLang(code, (p) => {
  if (mainWindow) mainWindow.webContents.send('lang:progress', { code, ...p });
})));

// ---------------- history / settings ----------------
ipcMain.handle('history:get', wrap(async () => store.getHistory()));
ipcMain.handle('history:add', wrap(async (entry) => store.addHistory(entry)));
ipcMain.handle('history:clear', wrap(async () => store.clearHistory()));
ipcMain.handle('settings:get', wrap(async () => store.getSettings()));
ipcMain.handle('settings:set', wrap(async (patch) => {
  const next = store.setSettings(patch);
  if (Object.prototype.hasOwnProperty.call(patch, 'hotkey')) {
    const { ok } = registerHotkey(next.hotkey);
    next.hotkeyRegistered = ok;
  }
  return next;
}));

ipcMain.handle('shot:setHotkey', wrap(async (accel) => registerHotkey(accel)));

// ---------------- screenshot region capture ----------------
async function captureDisplayImage(display) {
  const scale = display.scaleFactor || 1;
  const width = Math.round(display.size.width * scale);
  const height = Math.round(display.size.height * scale);
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height },
  });
  const bySourceId = sources.find((s) => String(s.display_id) === String(display.id));
  const source = bySourceId || sources[0];
  return source ? source.thumbnail : null;
}

function closeOverlay() {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
  overlayResolvers = null;
}

ipcMain.handle('overlay:submitRegion', wrap(async (rect) => {
  if (overlayResolvers) overlayResolvers.resolve(rect);
  closeOverlay();
  return true;
}));

ipcMain.handle('overlay:cancel', wrap(async () => {
  if (overlayResolvers) overlayResolvers.resolve(null);
  closeOverlay();
  return true;
}));

async function beginRegionCapture() {
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const scale = display.scaleFactor || 1;

  const image = await captureDisplayImage(display);
  if (!image) throw new Error('Screen capture unavailable (no source found).');

  const rect = await new Promise((resolve) => {
    overlayResolvers = { resolve };
    overlayWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      hasShadow: false,
      fullscreenable: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
      },
    });
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
    overlayWindow.on('closed', () => {
      overlayWindow = null;
      if (overlayResolvers) {
        overlayResolvers.resolve(null);
        overlayResolvers = null;
      }
    });
  });

  if (!rect) return null; // cancelled

  const cropRect = {
    x: Math.round(rect.x * scale),
    y: Math.round(rect.y * scale),
    width: Math.max(1, Math.round(rect.width * scale)),
    height: Math.max(1, Math.round(rect.height * scale)),
  };
  const cropped = image.crop(cropRect);
  const buffer = cropped.toPNG();

  const result = await ocr.recognizeImage(buffer, {});
  clipboard.writeText(result.text.trim());
  store.addHistory({
    kind: 'screenshot',
    source_path: `region-capture-${Date.now()}.png`,
    pages: 1,
    chars: result.text.length,
    text: result.text.slice(0, 50000),
    mean_confidence: result.confidence,
  });

  showCaptureToast(result.text.trim());

  if (mainWindow) {
    mainWindow.webContents.send('hotkey:capture-done', {
      text: result.text,
      confidence: result.confidence,
      imageBase64: buffer.toString('base64'),
    });
  }
  return result;
}

function showCaptureToast(text) {
  if (toastWindow) {
    toastWindow.close();
    toastWindow = null;
  }
  const { workArea } = screen.getPrimaryDisplay();
  const width = 360;
  const height = 140;
  toastWindow = new BrowserWindow({
    x: workArea.x + workArea.width - width - 24,
    y: workArea.y + workArea.height - height - 24,
    width,
    height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: { sandbox: true },
  });
  const preview = (text || '(no text found)').slice(0, 200).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const html = `<!doctype html><html><body style="margin:0;font-family:Segoe UI,Arial,sans-serif;background:#181c24;color:#eee;border-radius:10px;padding:14px;box-sizing:border-box;height:100vh;border:1px solid #2e3440;">
    <div style="font-size:12px;color:#7dd3fc;font-weight:600;margin-bottom:6px;">TEXTRACT &middot; copied to clipboard</div>
    <div style="font-size:13px;line-height:1.4;max-height:80px;overflow:hidden;">${preview}</div>
  </body></html>`;
  toastWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  setTimeout(() => {
    if (toastWindow) { toastWindow.close(); toastWindow = null; }
  }, 3500);
}

ipcMain.handle('shot:beginRegionCapture', wrap(async () => beginRegionCapture()));
