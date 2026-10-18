# Handoff note: tipdash-token-sheet (job 12)

Branch `claude/tipdash-token-sheet`, cut from main `9fdb3b6` (0.66.3).

**Rebased on 18 Oct (evening) onto tipdash main `c025ebd` (0.66.7)**, which moved after the pack was written. There were no conflicts. `npm run tokens` regenerates identical files (same 24 drift rows, 0 contrast fails). Results on 0.66.7: `npm test` 440 pass on main, 446 pass + 1 todo on this branch. `build-public` ok (142 files), with nothing from `labs/tokens/`.

## What changed
- **`scripts/token-sheet.mjs`** (new, Node built-ins only). It parses every pure token rule in the `<style>` blocks of `index.html`, `live/index.html` and `compare/index.html`, plus `assets/theme-apex.css`. A pure token rule is one whose selector is only `:root`, `html[data-theme="x"]`, `html[data-theme="apex"][data-apex-variant="x"]` or `html[data-theme="apex"][data-apex-light="1"]`. From those it builds a model of surface → theme/variant → `{ var: value }` and follows CSS specificity: `:root` < `html[data-theme]` < the apex variant selectors, with later source order winning at equal weight. Rules inside `@media` are skipped, so the phone-size `--apex-display` override doesn't appear.
  - For the app's apex themes, the model layers `theme-apex.css` on top. The app injects that file after the inline `<style>`, so its `--t-body`, `--t-h1`, `--t-h2`, `--t-h3` and `--apex-display` win. The drift check leaves that file out and only compares the hand-copied blocks.
  - It writes `labs/tokens/index.html`: one column per app theme or variant (9 in all: navy, day, ochre, apex, and apex light/oled/mono/ochre/legacy-light), with a mini preview card, a swatch, name and value for every colour var, a contrast table, type samples, size vars per theme, radius vars and the drift table. The Geist and Instrument Sans fonts are embedded as data URIs, so the page makes **no external requests** (checked in headless Chromium: 0 requests outside localhost, no page errors, no horizontal scroll at 390px).
  - It writes `labs/tokens/tokens.json` with the same data: themes per surface, contrast rows and drift rows.
- **`tests/theme_token_drift.test.js`** (new). It checks that the parser finds every theme block on all 3 surfaces. Today's drift is pinned in `KNOWN_DRIFT`, so any **new** drift fails straight away, and a fixed entry also fails until it's removed from the list. The "shared vars all match" check is a `todo` that lists the known drift.
- **`tests/theme_contrast.test.js`** (new). It checks the luminance maths against WCAG reference values (black/white 21:1, #767676 on white 4.54:1). It then checks every key pair on every surface and theme against AA: 4.5:1 for text, and 3:1 for accent and the pending border (UI or large text). `KNOWN_FAILS` is an empty allowlist, because **every key pair passes today**. The closest is apex-light accent on card at 4.54:1. The test also checks that `labs` isn't in the public `ALLOW` list, and that the page has no external URLs, no `console.` and no `target="_blank"`.
- **`package.json`**: new `tokens` script.
- Screenshots of the sheet at 390px and 1440px (`tokens-390.png`, `tokens-1440.png`) were sent with this handoff, not committed, because the repo's `.gitignore` ignores `*.png`.

The key pairs are `--txt` on `--bg`, `--txt` on `--card`, `--muted` on `--card`, `--accent` on `--card` (UI), `--win-ink` on `--card`, `--loss-ink` on `--card`, pending text and pending border. "Pending" uses the real `.b-pending` styling, which is `--muted` text with a `--faint` border on a transparent background, so it's measured on `--card`. Translucent colours are composited over `--bg` first. A pair is skipped on a surface that never declares one of its vars: `compare/` has no `--loss-ink` for navy, day or ochre.

## Drift for Cinna to decide (no colours changed)
| Theme(s) | Var | index.html | live/ | compare/ |
|---|---|---|---|---|
| navy, day, ochre, apex, apex-light-legacy | `--t-callout` | .875rem | .875rem | 15px |
| same | `--t-cap` | .6875rem | .6875rem | 11px |
| same | `--t-h3` | 1.0625rem | 1.0625rem | 18px |
| navy, day, ochre | `--t-foot` | .75rem | .75rem | 12px |
| navy, day, ochre | `--t-sub` | .8125rem | .8125rem | 14px |
| day | `--warn` | #e0a04a (from `:root`) | #c9861f | — |
| apex | `--faint` | #8B93A7 | #6E768C | #6E768C |
| apex (data-apex-light=1) | `--faint` | #5C6578 | #6A7386 | #6A7386 |

`compare/` uses px type sizes, and three of them are a pixel larger than the app's rem values at a 16px root (15/14/18px against 14/13/17px). The apex `--faint` values differ in all three files.

## Tests
| | Before | After |
|---|---|---|
| `npm test` | 420 pass | 426 pass, 1 todo (the known-drift check), 0 fail |
| `node scripts/build-public.mjs` | ok (141 files) | ok (141 files). Nothing from `labs/tokens/` is in `dist/` |
| `npm run tokens` | — | 9 app themes, 24 drift rows, 0 contrast fails |

There's no visual change to the app: no app file was edited.

## Suggested changelog line
"Design: added a private theme token sheet (labs/tokens) with contrast checks, plus tests that catch theme colours drifting between the app, Live and Compare."

## Spotted but not touched
- The app has no spacing tokens (spacing is written inline), so the sheet shows type and radius tokens but no spacing. A spacing scale would be a separate design job.
- Merging the three hand-copied token blocks into one shared file would make the drift test unnecessary (out of scope here).
