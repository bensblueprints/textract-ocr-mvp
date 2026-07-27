# Textract

## Get the packaged app

Don't want to build from source? Get the signed installer, lifetime updates and setup support for a one-time payment at [onetimesuite.com/textract](https://onetimesuite.com/textract/) — same app, MIT source right here.

Part of [OneTimeSuite](https://onetimesuite.com) — pay-once alternatives to subscription software.

## Demo



https://github.com/user-attachments/assets/81b69546-61f6-486a-8a83-154659a1e453



[![License: MIT](https://img.shields.io/badge/License-MIT-8f7bff.svg)](LICENSE)

**Every scan, every screenshot, into text. Offline. Once.** Drag in images or PDFs, get selectable text per page, export searchable PDFs, batch whole folders, and snap a screenshot region to text with a global hotkey — all running 100% on your machine.

Adobe Acrobat Pro charges **$19.99/month** for bundled OCR. ABBYY FineReader wants **$99/year**. Online OCR sites make you upload your contracts, IDs and scans to a server you don't control. Textract does the same job locally, offline, with zero telemetry, for a **one-time $19**.

![Textract screenshot](docs/screenshot.png)

## Features

- **Drag-drop OCR** — drop images (PNG/JPG/WEBP/BMP/TIFF) or PDFs, get per-page extracted text. PDFs are rasterized page-by-page and OCR'd with [tesseract.js](https://tesseract.projectnaptha.com/)
- **Per-page results** — page thumbnails, text pane, per-page copy + copy-all, confidence indicator, .txt export
- **Searchable-PDF export** — rebuilds the PDF with an invisible text layer positioned from OCR word bounding boxes ([pdf-lib](https://pdf-lib.js.org/)), so the result is Ctrl-F-able and copy-able in any PDF reader
- **Batch folder mode** — point it at a folder (recursive optional), OCR everything, write a `.txt` per file, get a summary (files/pages/words/failures)
- **Screenshot-to-text hotkey** — global `Ctrl+Shift+T` (configurable) opens a region-capture overlay, even while minimized to tray; DPI-aware across multi-monitor setups; auto-copies to clipboard
- **Multi-language OCR** — English is bundled; other languages download on demand from `tessdata_fast` with a progress UI — the *only* network call this app ever makes
- **Preprocessing** — optional grayscale + adaptive threshold pass to rescue low-contrast scans
- **History** — recent extractions persisted locally, re-copy without re-OCR, clearable

Everything runs **100% locally** with [tesseract.js](https://github.com/naptha/tesseract.js) pointed at bundled worker/core/language files — never a CDN. No telemetry, no uploads, no account.

## ☕ Skip the setup — get the 1-click installer

Don't want to install Node and build from source? Grab the packaged Windows installer — pay once, own it forever:

**[Get Textract on Whop →](https://whop.com/benjisaiempire/textract)**

## Quick start (from source)

```bash
npm i && npm start
```

Requires Node 18+ (built on Node 24). Run the smoke test with `npm test`. Build a Windows installer with `npm run dist`.

## Textract vs the subscription alternatives

| | **Textract** | Adobe Acrobat Pro | ABBYY FineReader PDF |
|---|---|---|---|
| Price | **$19 once** | $19.99/month ($240/yr, forever) | $99/year (Standard) |
| Your documents | **Never leave your machine** | Uploaded for cloud OCR features | Local, but pricey subscription |
| Works fully offline | **Yes** | Partial | Yes |
| Searchable PDF export | Yes | Yes | Yes |
| Batch folder OCR | Yes | Limited | Yes |
| Screenshot-to-text hotkey | **Yes** | No | No |
| Telemetry | **None** | Extensive | Some |
| Source code | **MIT, on GitHub** | Closed | Closed |

One month of Acrobat Pro costs more than Textract, forever. Everything after month one is money you keep.

## Tech stack

- **Electron** — main + preload + renderer, context-isolated, no node integration in the renderer
- **tesseract.js** — OCR engine, wired to bundled local worker/core/language files (true offline, no CDN)
- **pdf-lib** — searchable-PDF assembly (invisible text layer over the source image)
- **pdfjs-dist + @napi-rs/canvas** — headless PDF page rasterization
- **sharp** — image preprocessing (grayscale + adaptive threshold)
- **Plain HTML/CSS/JS renderer** — no framework, fast startup, premium dark UI
- **electron-builder** — Windows NSIS installer via `npm run dist`

## Project structure

```
src/
  main.js            # window/tray lifecycle, hotkey + region-capture, IPC
  preload.js          # contextBridge API surface
  core/               # pure Node-requireable OCR/PDF/batch logic (also used by tests)
    ocr.js            # tesseract.js wrapper w/ explicit local paths
    searchablePdf.js  # invisible text-layer PDF assembly
    pdfPages.js       # PDF -> per-page PNG rasterization
    batch.js          # folder discovery + batch OCR
    preprocess.js     # grayscale + adaptive threshold
    langManager.js    # on-demand language downloads
    store.js          # settings.json / history.json (userData)
    paths.js          # resolves worker/core/lang paths per environment
  renderer/           # home/result/batch/settings views + region-capture overlay
resources/tessdata/    # bundled eng.traineddata (shipped in the installer)
test/smoke.js          # pure-Node OCR/PDF/batch smoke tests (sharp-generated fixtures)
launch-kit/            # Product Hunt, ad copy, and go-to-market notes
```

## Verification

- `npm i` — clean install
- `npm start` — boots the Electron app (home/result/batch/settings views, tray icon, global hotkey registered)
- `npm test` — pure-Node smoke test: OCR's a sharp-generated text image and asserts the extracted words, builds a searchable PDF and round-trips it through `pdf-parse` to prove the invisible text layer is real, rasterizes a 2-page generated PDF and OCRs each page, batch-OCRs a folder of 3 images, and verifies the preprocessing pass recovers a low-contrast marker word. **All smoke tests pass** — see honest verification notes in the PR/build report.

## License

MIT — see [LICENSE](LICENSE).

## macOS build

See [MAC-BUILD.md](MAC-BUILD.md). Quickest path: GitHub **Actions** tab -> run the **Mac Build** (`mac-build.yml`) workflow to get a downloadable `.dmg` (unsigned - right-click -> Open on first launch).
