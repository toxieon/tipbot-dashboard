# Screenshot slip import (client OCR)

Build → **Import from screenshot** runs [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0) entirely in the browser. Parsers live in `assets/slip-ocr.js`. Sportsbet is the base layout. Ladbrokes, Neds, TAB and PointsBet share it, and Ladbrokes, bet365 and PointsBet also have an NBA player-prop single reader. The lazy UI module is `assets/slip-ocr-ui.js`; WASM, worker and `eng` traineddata are vendored under `assets/vendor/tesseract/` (see `LICENSE.md` there). The line under the importer (`Supported slips: …`) is built from `SLIP_REGISTRY` in the parser, so the screen only names those bookmakers.

## Flow

1. Tipster picks or pastes an image (file input or clipboard).
2. OCR text is parsed into a slip draft (`bet_type`, odds, legs, event, date/time, sport, bookmaker). **Today** and **Tomorrow** count as the kickoff line. **Multi** slips (not same-game) attach an event/date block to each leg. AFL legs match `/api/fixtures`. NBA, NBL, WNBA and NFL legs match the public scoreboard for that sport (the slip date, plus the day either side) and the tip sends `league`, `espn_event_id` and the start time when the game is known.
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
  `slip.flags` / `leg.flags` and is highlighted on the review screen. A stake printed on the slip
  (`Stake $100`, including the amount on the next line) is kept. When it is missing it is flagged.
  Returns are stored when printed. Odds are never worked out from the stake and the return.
- NBA player-prop singles:
  - Ladbrokes `Player Assists O/u` / `Player Rebounds O/u` with `Name Under 2.5`.
  - bet365 `2+ Threes Made`. A clock in the header is the screenshot time, not the game time.
    Cash Out, Reuse and Share are ignored.
  - PointsBet `Under 5.5 Assists` and `Assists + Rebounds` (graded on the sum, same market as
    Rebounds + Assists). `Away @ Home` stays in that order. `Tomorrow, 11:30am` is the next calendar
    day in Australia/Melbourne. The footer is ignored.
  - A bare time with no date is shown and flagged. It is not given a day.
  - Team abbreviations (WAS, DAL, UTA, …) count toward NBA.
- `npm run test:slips` runs the browser pipeline in headless Chromium over `tests/fixtures/slips`
  (Sportsbet screenshots, labelled synthetic variants, and `text/*.txt` slips that skip OCR) and
  prints a per-fixture, per-field pass table. It fails if any real fixture misses a field.
- The vendored core is the SIMD build only; browsers without wasm SIMD can't run the import.
