'use strict';
(() => {
  const api = window.textract;

  // ---------------- state ----------------
  const state = {
    view: 'home',
    currentFile: null,
    pages: [], // [{pageNumber, text, confidence, words, imageBase64, dpi}]
    activePage: 0,
    langs: ['eng'],
    preprocess: false,
    batchFolder: '',
    batchOutputDir: '',
  };

  // ---------------- view switching ----------------
  const views = {
    home: document.getElementById('view-home'),
    batch: document.getElementById('view-batch'),
    settings: document.getElementById('view-settings'),
    result: document.getElementById('view-result'),
  };
  const navButtons = Array.from(document.querySelectorAll('.nav-btn'));

  function showView(name) {
    state.view = name;
    Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
    navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === name));
  }

  navButtons.forEach((btn) => btn.addEventListener('click', () => showView(btn.dataset.view)));
  document.getElementById('btnBackHome').addEventListener('click', () => showView('home'));

  // ---------------- helpers ----------------
  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch (_e) {
      return '';
    }
  }

  function basename(p) {
    return (p || '').split(/[\\/]/).pop();
  }

  async function refreshHistory() {
    const res = await api.getHistory();
    const list = res.ok ? res.result : [];
    const container = document.getElementById('historyList');
    if (!list.length) {
      container.innerHTML = '<div class="empty">No history yet.</div>';
      return;
    }
    container.innerHTML = '';
    list.slice(0, 25).forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'history-item';
      row.innerHTML = `
        <span class="kind">${entry.kind || 'file'}</span>
        <span class="path" title="${entry.source_path || ''}">${basename(entry.source_path)}</span>
        <span class="when">${fmtTime(entry.created_at)}</span>
      `;
      container.appendChild(row);
    });
  }

  // ---------------- drop zone / file open ----------------
  const dropzone = document.getElementById('dropzone');

  ['dragenter', 'dragover'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    });
  });
  dropzone.addEventListener('drop', async (e) => {
    const files = Array.from(e.dataTransfer.files || []);
    const paths = files.map((f) => window.textractFile.getPath(f)).filter(Boolean);
    if (paths.length) await processFiles(paths);
  });

  document.getElementById('btnBrowseFiles').addEventListener('click', async () => {
    const res = await api.openFiles();
    const paths = res.ok ? res.result : [];
    if (paths.length) await processFiles(paths);
  });

  document.getElementById('btnBrowseFolder').addEventListener('click', () => {
    showView('batch');
  });

  async function processFiles(paths) {
    for (const filePath of paths) {
      await recognizeAndShow(filePath);
    }
  }

  async function recognizeAndShow(filePath) {
    const res = await api.recognizeFile(filePath, { langs: state.langs, preprocess: state.preprocess });
    if (!res.ok) {
      alert(`OCR failed for ${basename(filePath)}: ${res.error}`);
      return;
    }
    state.currentFile = filePath;
    state.pages = res.result.pages;
    state.activePage = 0;
    renderResult();
    showView('result');

    const totalChars = state.pages.reduce((sum, p) => sum + (p.text ? p.text.length : 0), 0);
    const meanConf = state.pages.reduce((sum, p) => sum + (p.confidence || 0), 0) / Math.max(1, state.pages.length);
    await api.addHistory({
      kind: filePath.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image',
      source_path: filePath,
      pages: state.pages.length,
      chars: totalChars,
      mean_confidence: meanConf,
    });
    refreshHistory();
  }

  // ---------------- result view ----------------
  const pageRail = document.getElementById('pageRail');
  const textPane = document.getElementById('textPane');
  const confidenceChip = document.getElementById('confidenceChip');

  function renderResult() {
    pageRail.innerHTML = '';
    state.pages.forEach((p, idx) => {
      const thumb = document.createElement('div');
      thumb.className = `page-thumb${idx === state.activePage ? ' active' : ''}`;
      thumb.innerHTML = `<img src="data:image/png;base64,${p.imageBase64}" /><span class="num">${p.pageNumber}</span>`;
      thumb.addEventListener('click', () => {
        state.activePage = idx;
        renderResult();
      });
      pageRail.appendChild(thumb);
    });
    const page = state.pages[state.activePage];
    if (page) {
      textPane.value = page.text || '';
      confidenceChip.textContent = `confidence: ${Math.round(page.confidence || 0)}%  ·  page ${page.pageNumber}/${state.pages.length}`;
    } else {
      textPane.value = '';
      confidenceChip.textContent = 'confidence: -';
    }
  }

  textPane.addEventListener('input', () => {
    const page = state.pages[state.activePage];
    if (page) page.text = textPane.value;
  });

  document.getElementById('btnCopyAll').addEventListener('click', async () => {
    const all = state.pages.map((p) => p.text).join('\n\n');
    await api.writeClipboard(all);
  });

  document.getElementById('btnExportTxt').addEventListener('click', async () => {
    if (!state.currentFile) return;
    const defaultName = `${basename(state.currentFile).replace(/\.[^.]+$/, '')}.txt`;
    const savePath = await api.pickSavePath(defaultName, { name: 'Text', extensions: ['txt'] });
    if (!savePath.ok || !savePath.result) return;
    const all = state.pages.map((p) => p.text).join('\n\n');
    await api.writeText(savePath.result, all);
    await api.revealInFolder(savePath.result);
  });

  document.getElementById('btnExportPdf').addEventListener('click', async () => {
    if (!state.currentFile) return;
    const defaultName = `${basename(state.currentFile).replace(/\.[^.]+$/, '')}-searchable.pdf`;
    const savePath = await api.pickSavePath(defaultName, { name: 'PDF', extensions: ['pdf'] });
    if (!savePath.ok || !savePath.result) return;
    const res = await api.buildSearchablePdf(state.pages, savePath.result);
    if (res.ok) await api.revealInFolder(savePath.result);
    else alert(`Export failed: ${res.error}`);
  });

  document.getElementById('btnRerun').addEventListener('click', async () => {
    if (state.currentFile) await recognizeAndShow(state.currentFile);
  });

  document.getElementById('btnPreprocessToggle').addEventListener('click', async (e) => {
    state.preprocess = !state.preprocess;
    e.target.textContent = `Preprocessing: ${state.preprocess ? 'On' : 'Off'}`;
    if (state.currentFile) await recognizeAndShow(state.currentFile);
  });

  const langSelect = document.getElementById('langSelect');
  langSelect.addEventListener('change', () => {
    state.langs = [langSelect.value];
  });

  async function populateLangSelect() {
    const res = await api.listLangs();
    const langs = res.ok ? res.result : [];
    langSelect.innerHTML = '';
    langs.filter((l) => l.installed).forEach((l) => {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = l.name;
      langSelect.appendChild(opt);
    });
    if (!langSelect.options.length) {
      const opt = document.createElement('option');
      opt.value = 'eng';
      opt.textContent = 'English';
      langSelect.appendChild(opt);
    }
  }

  // ---------------- batch view ----------------
  const batchTableBody = document.getElementById('batchTableBody');
  const batchSummaryEl = document.getElementById('batchSummary');
  const outputDirLabel = document.getElementById('outputDirLabel');

  document.getElementById('btnPickOutputDir').addEventListener('click', async () => {
    const res = await api.pickOutputDir();
    if (res.ok && res.result) {
      state.batchOutputDir = res.result;
      outputDirLabel.textContent = res.result;
    }
  });

  document.getElementById('btnPickBatchFolder').addEventListener('click', async () => {
    const recursive = document.getElementById('batchRecursive').checked;
    const res = await api.openFolder(recursive);
    if (!res.ok || !res.result.folder) return;
    state.batchFolder = res.result.folder;
    const files = res.result.files;
    batchTableBody.innerHTML = '';
    batchSummaryEl.textContent = `Running OCR on ${files.length} files...`;
    const rowsByFile = new Map();
    files.forEach((f) => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${f}</td><td class="status-pending">pending</td>`;
      batchTableBody.appendChild(row);
      rowsByFile.set(f, row);
    });

    const stopListening = api.onBatchProgress((evt) => {
      const row = rowsByFile.get(evt.file);
      if (!row) return;
      const statusCell = row.children[1];
      if (evt.ok) {
        statusCell.textContent = 'done';
        statusCell.className = 'status-ok';
      } else {
        statusCell.textContent = `failed: ${evt.error}`;
        statusCell.className = 'status-fail';
      }
    });

    const runRes = await api.runBatch(state.batchFolder, {
      recursive,
      outputDir: state.batchOutputDir || undefined,
      langs: state.langs,
    });
    stopListening();

    if (runRes.ok) {
      const s = runRes.result;
      batchSummaryEl.textContent = `${s.ok}/${s.files} files OK · ${s.pages} pages · ${s.words} words · ${s.failed.length} failed`;
    } else {
      batchSummaryEl.textContent = `Batch failed: ${runRes.error}`;
    }
  });

  // ---------------- settings view ----------------
  const hotkeyInput = document.getElementById('hotkeyInput');
  const hotkeyStatus = document.getElementById('hotkeyStatus');
  const hotkeyPill = document.getElementById('hotkeyPill');

  document.getElementById('btnSaveHotkey').addEventListener('click', async () => {
    const accel = hotkeyInput.value.trim();
    const res = await api.setSettings({ hotkey: accel });
    if (res.ok) {
      hotkeyStatus.textContent = res.result.hotkeyRegistered ? 'Registered.' : 'Could not register (conflict with another app?)';
      hotkeyPill.textContent = `${accel} · region capture`;
    }
  });

  document.getElementById('settingPreprocess').addEventListener('change', async (e) => {
    await api.setSettings({ preprocessing: e.target.checked });
    state.preprocess = e.target.checked;
  });

  document.getElementById('settingSearchablePdfDefault').addEventListener('change', async (e) => {
    await api.setSettings({ searchablePdfDefault: e.target.checked });
  });

  const langManagerEl = document.getElementById('langManager');

  async function renderLangManager() {
    const res = await api.listLangs();
    const langs = res.ok ? res.result : [];
    langManagerEl.innerHTML = '';
    langs.forEach((l) => {
      const row = document.createElement('div');
      row.className = 'lang-row';
      row.dataset.code = l.code;
      row.innerHTML = `
        <span class="name">${l.name} (${l.code})</span>
        <span class="progress"><span class="progress-bar" style="width:${l.installed ? 100 : 0}%"></span></span>
        <button class="btn" ${l.installed ? 'disabled' : ''}>${l.installed ? 'Installed' : 'Download'}</button>
      `;
      const btn = row.querySelector('button');
      if (!l.installed) {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Downloading...';
          const dl = await api.downloadLang(l.code);
          if (dl.ok) {
            btn.textContent = 'Installed';
            row.querySelector('.progress-bar').style.width = '100%';
            populateLangSelect();
          } else {
            btn.disabled = false;
            btn.textContent = 'Retry';
            alert(`Download failed: ${dl.error}`);
          }
        });
      }
      langManagerEl.appendChild(row);
    });
  }

  api.onLangProgress((evt) => {
    const row = langManagerEl.querySelector(`.lang-row[data-code="${evt.code}"]`);
    if (!row) return;
    const bar = row.querySelector('.progress-bar');
    if (bar && evt.pct) bar.style.width = `${Math.round(evt.pct * 100)}%`;
  });

  async function loadSettings() {
    const res = await api.getSettings();
    if (!res.ok) return;
    const s = res.result;
    hotkeyInput.value = s.hotkey || 'CommandOrControl+Shift+T';
    hotkeyPill.textContent = `${s.hotkey || 'Ctrl+Shift+T'} · region capture`;
    document.getElementById('settingPreprocess').checked = !!s.preprocessing;
    document.getElementById('settingSearchablePdfDefault').checked = s.searchablePdfDefault !== false;
    state.preprocess = !!s.preprocessing;
    state.langs = s.defaultLangs && s.defaultLangs.length ? s.defaultLangs : ['eng'];
  }

  document.getElementById('btnClearHistory').addEventListener('click', async () => {
    await api.clearHistory();
    refreshHistory();
  });

  // ---------------- hotkey capture toast in-app ----------------
  api.onHotkeyCaptureDone(() => {
    refreshHistory();
  });

  // ---------------- boot ----------------
  (async () => {
    await loadSettings();
    await populateLangSelect();
    await renderLangManager();
    await refreshHistory();
  })();
})();
