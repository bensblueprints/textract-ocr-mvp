'use strict';
// Tiny local JSON stores for settings + history. Always written via Node
// fs (never PowerShell / shell redirection), so no BOM/encoding issues.
const fs = require('fs');
const path = require('path');
const paths = require('./paths');

const DEFAULT_SETTINGS = {
  hotkey: 'CommandOrControl+Shift+T',
  defaultLangs: ['eng'],
  preprocessing: false,
  outputDirMode: 'alongside', // 'alongside' | 'custom'
  customOutputDir: '',
  searchablePdfDefault: true,
  theme: 'dark',
};

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_e) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function settingsPath() {
  return path.join(paths.getUserDataDir(), 'settings.json');
}

function historyPath() {
  return path.join(paths.getUserDataDir(), 'history.json');
}

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJson(settingsPath(), {}) };
}

function setSettings(patch) {
  const next = { ...getSettings(), ...patch };
  writeJson(settingsPath(), next);
  return next;
}

const HISTORY_CAP = 200;

function getHistory() {
  return readJson(historyPath(), []);
}

function addHistory(entry) {
  const list = getHistory();
  list.unshift({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), created_at: new Date().toISOString(), ...entry });
  const capped = list.slice(0, HISTORY_CAP);
  writeJson(historyPath(), capped);
  return capped;
}

function clearHistory() {
  writeJson(historyPath(), []);
  return [];
}

module.exports = {
  getSettings,
  setSettings,
  getHistory,
  addHistory,
  clearHistory,
  DEFAULT_SETTINGS,
};
