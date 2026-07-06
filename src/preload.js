'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const invoke = (channel) => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('textract', {
  // Dialogs / file discovery
  openFiles: invoke('ocr:openFiles'),
  openFolder: invoke('ocr:openFolder'),
  pickOutputDir: invoke('dialog:pickOutputDir'),
  pickSavePath: invoke('dialog:pickSavePath'),

  // OCR
  recognizeFile: invoke('ocr:recognizeFile'),
  buildSearchablePdf: invoke('ocr:buildSearchablePdf'),

  // Batch
  runBatch: invoke('batch:run'),
  onBatchProgress: (cb) => {
    const listener = (_evt, payload) => cb(payload);
    ipcRenderer.on('batch:progress', listener);
    return () => ipcRenderer.removeListener('batch:progress', listener);
  },

  // Languages
  listLangs: invoke('lang:list'),
  downloadLang: invoke('lang:download'),
  onLangProgress: (cb) => {
    const listener = (_evt, payload) => cb(payload);
    ipcRenderer.on('lang:progress', listener);
    return () => ipcRenderer.removeListener('lang:progress', listener);
  },

  // Screenshot region capture
  beginRegionCapture: invoke('shot:beginRegionCapture'),
  setHotkey: invoke('shot:setHotkey'),
  onHotkeyCaptureDone: (cb) => {
    const listener = (_evt, payload) => cb(payload);
    ipcRenderer.on('hotkey:capture-done', listener);
    return () => ipcRenderer.removeListener('hotkey:capture-done', listener);
  },

  // History / settings
  getHistory: invoke('history:get'),
  addHistory: invoke('history:add'),
  clearHistory: invoke('history:clear'),
  getSettings: invoke('settings:get'),
  setSettings: invoke('settings:set'),

  // Misc
  revealInFolder: invoke('app:revealInFolder'),
  writeClipboard: invoke('clipboard:write'),
  readFile: invoke('fs:readFile'),
  writeText: invoke('fs:writeText'),
  writeFile: invoke('fs:writeFile'),
});

// Resolves an absolute filesystem path for a dropped DOM File — the
// `.path` shortcut Electron used to add to File objects is deprecated,
// webUtils.getPathForFile is the supported replacement.
contextBridge.exposeInMainWorld('textractFile', {
  getPath: (file) => webUtils.getPathForFile(file),
});

// Separate, smaller bridge for the region-capture overlay window.
contextBridge.exposeInMainWorld('textractOverlay', {
  submitRegion: invoke('overlay:submitRegion'),
  cancel: invoke('overlay:cancel'),
});
