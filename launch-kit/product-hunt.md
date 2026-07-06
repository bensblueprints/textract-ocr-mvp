# Product Hunt Launch — Textract

## Name
Textract

## Tagline (60 chars max)
Offline OCR: scans & screenshots to text. $19 once. (52 chars)

## Description (260 chars max)
Drag in images or PDFs, get selectable text per page, export searchable PDFs, batch whole folders, and snap a screenshot region to text with a hotkey — all offline. No uploads, no subscription. Pay $19 once, own it forever. MIT-licensed. (240 chars)

## Full description

Textract is a desktop OCR app that replaces Adobe Acrobat Pro's OCR add-on (and ABBYY, and the online-credit OCR sites) with a one-time purchase — and the difference isn't just price.

**The problem:** every popular OCR tool either bills you monthly forever, or makes you upload the document you're OCR'ing — which is exactly the kind of document you least want on a third-party server: signed contracts, IDs, medical forms, financials.

**The fix:** Textract runs the entire OCR pipeline locally, with [tesseract.js](https://github.com/naptha/tesseract.js) pointed at bundled worker/core/language files instead of a CDN:

- **Drag-drop OCR** — images or PDFs, per-page extracted text with a confidence score
- **Searchable-PDF export** — rebuilds the PDF with an invisible text layer positioned from the OCR word boxes, so it's Ctrl-F-able in any reader
- **Batch folder mode** — point it at a folder, walk away, come back to a `.txt` per file and a summary
- **Screenshot-to-text hotkey** — `Ctrl+Shift+T` anywhere, even minimized to tray, drag a region, text lands on your clipboard in a couple seconds
- **Multi-language** — English bundled, more languages downloaded on demand (the one and only network call the app makes)

Zero telemetry. No account. The source is MIT-licensed on GitHub; the $19 buys the polished 1-click installer and supports development.

One month of Acrobat Pro's OCR-bundled tier costs more than Textract, forever.

## Maker first comment

Hey PH 👋

I built this because I needed to OCR a stack of signed contracts and old scanned IDs, and every tool I found wanted either $20/month or my documents uploaded to their server first. For paperwork like that, "upload it to a random OCR website" was a hard no.

So I built the offline version. tesseract.js runs entirely on-device — worker, WASM core, and language data all bundled locally, no CDN calls. Everything from drag-drop OCR to the searchable-PDF export to the screenshot-to-text hotkey happens on your machine.

Honest notes:
- OCR accuracy is tesseract's accuracy — very good on clean scans/screenshots, so-so on messy handwriting. It's not a cloud vision model.
- The code is MIT on GitHub — build it yourself for free if you want. The $19 is for the 1-click installer and to keep me shipping.
- Windows-first today; it's cross-platform Electron underneath, other builds are next.

Curious what you're OCR'ing that you don't want touching someone else's server — that's exactly the use case I built this for.

## Gallery shots (5)

1. **Hero** — full app window on the drop zone: dark UI, dashed drop target mid-hover, recent history strip below. Caption: "Drop a scan. Get selectable text. Nothing leaves your machine."
2. **Result view** — page thumbnail rail + text pane with a confidence chip and "Export searchable PDF" button glowing. Caption: "Per-page text, confidence score, one-click searchable PDF."
3. **Screenshot hotkey** — dimmed-screen region-capture overlay mid-drag with the selection rectangle, plus the toast popup showing "copied to clipboard". Caption: "Ctrl+Shift+T, anywhere. Screenshot to text in two seconds."
4. **Batch view** — folder queue table with per-file status ticking to green, summary card at the bottom (files/pages/words). Caption: "Point it at a folder. Walk away."
5. **Comparison card** — designed graphic of the README comparison table: $19 once vs $19.99/mo forever, offline vs uploaded, MIT vs closed. Caption: "One month of Acrobat costs more than Textract, forever."
