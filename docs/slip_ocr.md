# Screenshot slip import (client OCR)

Build → **Import from screenshot** runs [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0) entirely in the browser. Parsers live in `assets/slip-ocr.js` (Sportsbet first, with Ladbrokes, Neds, TAB and Pointsbet sharing the AU layout helpers). The lazy UI module is `assets/slip-ocr-ui.js`; WASM, worker and `eng` traineddata are vendored under `assets/vendor/tesseract/` (see `LICENSE.md` there).

## Flow

1. Tipster picks or pastes an image (file input or clipboard).
2. OCR text is parsed into a slip draft (`bet_type`, odds, legs, event, date/time, sport, bookmaker). **Multi** slips (not same-game) attach an event/date block to each leg; legs are matched to rows from `/api/fixtures` (`game_id` per leg for cross-game multis).
3. **Review imported slip** lets them fix any field, including a **fixture picker** per leg to correct the game.
4. **Continue to schedule** fills `BUILD.legs`, attaches `BUILD.image` (JPEG data URL), and opens the normal **Confirm & schedule** screen (`readTipForm` → `image_b64` on `POST /api/queue-tip`).

AFLW is inferred when `(W)` appears in team names.

## TipBot / backend

The dashboard already sends `image_b64` with queued tips when the tipster attaches a screenshot on the confirm step. No TipBot change is required for attachment.

If you want the original file stored server-side separately from the compressed JPEG, add an optional `slip_source_image` (or similar) field on `/api/queue-tip` and persist it alongside the existing image payload.

## Tests

- Fixture image: `tests/fixtures/sportsbet-proposed-bet.png`
- OCR text captured once from tesseract: `tests/fixtures/sportsbet-proposed-bet.ocr.txt`
- Parser unit test: `tests/slip_ocr.test.js`

## Parser and fixture harness (0.57.7)

- `TBSlipOcr.recognizeImage(Tesseract, file, base)` upscales/greyscales the image (inverting dark-mode
  screenshots), runs tesseract with word boxes, and returns `{text, lines, width}`.
- `TBSlipOcr.parseSlipLines(ocr)` strips icon glyphs using word gaps, then reads bet type, total odds,
  leg count, event and time (per leg for cross-game multis, `v` and `@` events), and maps each leg to
  `player`/`team`, `stat`, `line`, `side` and `odds` (SGM legs have no own odds). Truncated labels
  ("Receiving Yar...") are completed only from a unique known stat that matches the subtitle.
- Anything read below confidence 70, missing, or inconsistent (leg count mismatch) goes into
  `slip.flags` / `leg.flags` and is highlighted on the review screen. Stake is never on a slip and is
  always flagged.
- `npm run test:slips` runs the same browser pipeline in headless Chromium over
  `tests/fixtures/slips` (7 real Sportsbet slips + 9 labelled synthetic variants) and prints a
  per-fixture, per-field pass table; it fails if any real fixture misses a field.
- The vendored core is the SIMD build only; browsers without wasm SIMD can't run the import.
