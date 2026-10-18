# Handoff note: tipdash-trim (job 06, tipdash half)

Branch `claude/tipdash-trim`, cut from main `9fdb3b6` (0.66.3). `index.html` isn't touched.

**Rebased on 18 Oct (evening) onto tipdash main `c025ebd` (0.66.7)**, which moved after the pack was written. There were no conflicts, and every deletion still applies to the same code. Results on 0.66.7: `npm test` 440 pass on both main and this branch, `build-public` ok (142 files). The TipBot half of job 06 wasn't done: this session has no access to the private TipBot repo.

## Deletions (file:line on main)
| What | Where | Lines |
|---|---|---|
| `GPT/` scratch page | `GPT/index.html` (whole folder) | −201 |
| `espnSkillPlayers` (never called) | `assets/builder.js:565–568` | −4 |
| `teamPlayers` (never called) | `assets/builder.js:698` | −1 |
| `openPanel` (never called) | `assets/theme-apex.js:569–582` | −14 |
| `.apex-flow-bar` rule | `assets/theme-apex.css:910–921` | −12 |
| `.apex-flow-bar` in the reduced-motion selector list | `assets/theme-apex.css:486` | −1 |
| `.hero-links` and `.hero-links a` | `assets/site/site.css:137–138` | −2 |

**Total: 235 lines removed** (201 of them in `GPT/`), with 0 added.

Before deleting anything, I grepped for string-built calls: `window[...]` (only `TD.call`'s `window[fn]`, which only resolves entry-point names) and prefix concatenation (`"tbfx-" +`, `"tb-mini-toast--" +`, `"apex-" +`). The only `apex-flow` code in JS is `.apex-flow` itself, never `-bar`.

## Kept on purpose (the scan was wrong about these)
- **The fx selectors are all in use.** That's `.tbfx-ball-anim`, `.tbfx-burst`, `.tbfx-burst-2` (goal.css), `.tbfx-ticket`, `.tbfx-ticket-text`, `.tbfx-win-ring`, `.tbfx-win-ring-2` (win.css) and `.tbfx-ball-behind` (behind.css). The classes sit in `assets/fx/goal.svg`, `win.svg` and `behind.svg`, which `goal.js`, `win.js` and `behind.js` fetch and inline at runtime, so the CSS applies to them. The scan only looked at JS and HTML.
- **`.tb-mini-toast--error` and `--success` are in use.** `assets/mini/copy-tip.js:113` builds the class as `"tb-mini-toast tb-mini-toast--" + kind`.
- **`GPT` in `DENY_DIRS`** (`scripts/build-public.mjs:95`). It's harmless, and `tests/public_build.test.js` still checks that `GPT/index.html` never ships, so I left the entry in.

## labs/ and logo-lab/ (left alone, as asked)
| Folder | Still used by |
|---|---|
| `labs/club-intros` | `assets/club-intros/gallery.js`, `tests/club_intros.test.js` |
| `labs/fx` | `tests/public_build.test.js` (must-not-ship check) |
| `labs/fx-live` | nothing outside itself. It's the fx check page the brief mentions. |
| `labs/mini` | `tests/mini.test.js` |
| `labs/sfx` | nothing outside itself |
| `logo-lab` | `scripts/build-public.mjs` (`DENY_DIRS`), `tests/logo_lab.test.js` |

## Visual check
I took screenshots at 390×844 in headless Chromium with reduced motion, on main and on this branch, and diffed them: Apex home, `labs/fx-live/index.html` and `/welcome/` (which uses `site.css`). **All three are identical pixel for pixel.** The fx CSS files themselves weren't changed.

## Tests
| | Before (main) | After |
|---|---|---|
| `npm test` | 420 pass | 420 pass |
| `node scripts/build-public.mjs` | ok, 141 files | ok, 141 files |
| `npm run test:e2e` | 14 pass, 10 fail | 14 pass, the same 10 fail |

The 10 e2e failures are the same on main and are environmental or already there. 6 smoke tests hit a CORS console error from the mock on `/api/ground/scene`. 4 `follower-live` tests launch their own browser and ignore the config's path, which this sandbox needs. See the job 03 note.

## Suggested changelog line
"Housekeeping: removed an old scratch page and a few unused functions and styles. No visible changes."

## For Husker (TipBot half, not done here)
TipBot items 1–4 (ruff F401/F841/F811 on the allowlisted files, the `eag` redefinition, `auto_recaps.py`, and the unused locals) need the private TipBot repo, which this session couldn't reach. The routes listed in the integration notes still need a log check before anyone deletes them.
