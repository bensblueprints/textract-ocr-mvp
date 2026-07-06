# Launch Strategy — Textract

## Positioning
"Every scan, every screenshot, into text. Offline. Once." — the local, private, one-time-purchase replacement for Adobe Acrobat Pro's OCR ($19.99/mo), ABBYY FineReader PDF ($99/yr), and credit-metered online OCR sites.

## Pricing math
- **Suggested price: $19 one-time.**
- Adobe Acrobat Pro (OCR bundled): $19.99/mo → Textract pays for itself in **under 1 month**. Year one saves ~$220; every following year saves ~$240.
- ABBYY FineReader PDF Standard: $99/yr → pays for itself in **~2.3 months**.
- Readiris (~$99 one-time): position Textract as simpler and less than a fifth of the price.
- Anchor in copy: "One month of Acrobat costs more than Textract, forever."
- Launch promo option: $14 first-week Product Hunt price, back to $19 after.

## Target communities (rules-aware angles)

- **r/software** — allows recommendations/discussions; post as "I built a one-time-purchase alternative to Acrobat's OCR" in a self-promo-friendly window; disclose you're the author (required).
- **r/datacurator** — angle: batch OCR + searchable-PDF output for digitized document collections; lead with the batch-folder mode and the invisible-text-layer searchable PDF, both of which matter a lot to this crowd.
- **r/selfhosted** — angle: "I de-cloud'd my OCR pipeline." Lead with the fact that tesseract.js runs fully local against bundled worker/core/lang files, no CDN calls at runtime. Share the GitHub repo; mention the paid installer only if asked.
- **r/productivity** — angle: the screenshot-to-text hotkey as a daily-driver feature (copy text out of any app, PDF, or video frame instantly). Show the hotkey GIF — this is the most visually compelling feature for this audience.
- **Hacker News** — see Show HN draft below. Never use marketing language on HN; lead with the technical story (offline tesseract.js worker/core path wrangling, invisible-text-layer PDF assembly).

## Show HN draft

**Title:** Show HN: Textract – offline OCR desktop app with searchable-PDF export, pay once (MIT)

**Post:**
I needed to OCR a stack of signed contracts and old scanned IDs, and every option I found either billed monthly forever or wanted the documents uploaded to a server first — a hard no for that kind of paperwork.

So I built the local version: an Electron app wrapping tesseract.js, but explicitly pointed at bundled worker/core/language files instead of the default CDN URLs (this took more wrangling than I expected — tesseract.js's Node vs browser worker scripts aren't interchangeable, and `corePath` needs to be a directory of all four WASM variants, not a single file, or SIMD detection silently breaks).

Searchable-PDF export rebuilds each page as the original image plus an invisible (opacity 0) text layer positioned from tesseract's word bounding boxes via pdf-lib — verified by round-tripping the output through `pdf-parse` in the test suite, not just eyeballing it in a reader.

Also included: batch folder OCR, and a global-hotkey screenshot-to-text overlay (DPI-aware across multi-monitor Windows setups, which was its own rabbit hole).

The source is MIT on GitHub — `npm i && npm start` and you have the whole thing. I sell a $19 packaged installer for people who don't want to touch Node; that's the business model experiment: open source + paid convenience, versus $20+/mo subscription incumbents.

Honest limitations: OCR accuracy is tesseract's accuracy — excellent on clean scans/screenshots, mediocre on handwriting or heavily skewed photos. It's not a cloud vision model, and I'm not claiming it is.

Happy to talk about the tesseract.js offline-path gotchas or the PDF coordinate-system math (image pixels → PDF points, y-flip included).

## SEO keywords (10)
1. offline ocr software
2. searchable pdf converter offline
3. ocr without subscription
4. adobe acrobat ocr alternative
5. screenshot to text windows
6. batch ocr folder
7. tesseract gui windows
8. image to text app offline
9. pdf ocr one time purchase
10. abbyy finereader alternative

## AppSumo / PitchGround pitch

Textract is the anti-subscription answer to Adobe Acrobat Pro's OCR tier and ABBYY FineReader: a polished Windows desktop app that OCRs images and PDFs, exports true searchable PDFs, batch-processes entire folders, and turns any screen region into clipboard text via a global hotkey — entirely on the user's machine, no uploads, no account, no telemetry. The market leaders charge $20+/month or $99/year for a job a modern CPU does locally in seconds; we charge once. Our audience — freelancers, legal and admin staff, researchers digitizing paper archives — handles sensitive scans daily (IDs, contracts, medical forms) and has real reasons to distrust "free" OCR websites that upload documents server-side. The code is open source (MIT), which de-risks the purchase and builds trust; the paid product is the 1-click installer plus lifetime updates. Strong LTV story for a lifetime-deal audience: our $19 direct price leaves comfortable margin for a $12–15 deal tier, and "one month of Acrobat costs more than Textract, forever" writes the campaign copy for you.

## Launch sequence (suggested)
1. Repo public on GitHub with polished README + screenshot + hotkey GIF.
2. Product Hunt launch (Tuesday, 00:01 PT) with launch-week $14 price.
3. Show HN same week (Wednesday morning US time).
4. Reddit drip over the following 2 weeks (one community per 3-4 days, tailored angle each — lead with the screenshot-hotkey GIF wherever visuals are welcome).
5. X thread: the "one month of Acrobat costs more than this, forever" graphic + the tesseract.js offline-path build story.
6. AppSumo/PitchGround outreach after 100+ organic sales (social proof for the pitch).
