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
