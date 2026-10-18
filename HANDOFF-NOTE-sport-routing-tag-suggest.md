# Handoff note: sport-routing-tag-suggest (job 11, tipdash half)

Branch `claude/sport-routing-tag-suggest`, cut from main `9fdb3b6` (0.66.3). `index.html` isn't touched.

**Rebased on 18 Oct (evening) onto tipdash main `c025ebd` (0.66.7)**, which moved after the pack was written. There were no conflicts. Results on 0.66.7: `npm test` 440 pass on main, 445 on this branch. `build-public` ok (142 files). e2e: main 21 pass and 4 fail; this branch 24 pass and the same 4 fail (`follower-live`, environmental). The Apex sticky-header bug below is still on 0.66.7.

**The TipBot half isn't done.** This session couldn't reach the private `toxieon/TipBot` repo, so there's no `sport_route_suggest.py`, no `suggestions` field in `_state_payload`, and no Python tests yet. The tipdash side is built against the payload contract below, and it shows nothing until TipBot sends the field, so it's safe to merge first.

## Payload contract (for whoever builds the TipBot half)
`GET /api/routing` gains an optional top-level list:

```json
"suggestions": [
  {"tag": "AFL", "channel_id": "11", "channel_name": "afl-tips", "score": 0.95, "reason": "channel name contains 'afl'"}
]
```

- `tag` must match a `tags[].tag`. `channel_id` must be one of `channels[].id` (as a string; ids are compared as strings).
- `channel_name` is optional: the UI prefers the name from `channels[]`. `score` is 0 to 1. `reason` is shown as the chip's tooltip.
- tipdash also filters defensively, even if TipBot already does: it drops rows for unknown or deleted tags, unknown channels, channels already on that tag, the default Tips channel and duplicates. It sorts by score and keeps at most 3 per tag. So TipBot can send its raw `suggest_routes()` output as is.

## What changed
- **`assets/routing.js`**
  - New pure helpers, exported for tests: `pendingSuggestions(data, deleted)` (the filtering above), `emptySetup(data, deleted)` (true when no visible tag has a channel yet) and `suggestionChip(tag, sg)` (the chip HTML, escaped, 44px tall).
  - In Settings → Channels → Sport routing, each tag with suggestions gets a "Suggested from channel names" row under it with `+ #channel` chips. When no tag has a channel yet, an **Apply all suggestions (N)** button appears above the table.
  - A chip tap ticks the **same `.sr-ch` checkbox** the admin would tick by hand, then refreshes that row's summary and removes the chip. Ticking the checkbox by hand also hides the matching chip. Nothing saves until the admin presses Save, and `collect()` and the Save body are untouched, so the request shape is exactly what it was.
  - Read-only viewers (non-admins, or while a save is running) get no chips. `beforePost` and the post-time popups are untouched. `resolve` lives in TipBot and isn't affected.
  - Header comment updated to describe the chips.
- **`tests/routing.test.js`**: 5 new tests covering grouping, sorting, the cap, duplicates, never-suggest rules, an older payload with no field, when Apply all appears, chip markup (escaping, 44px, no new tab), and a source check that a chip only ticks a checkbox and never calls the API.
- **`tests/e2e/routing-suggest.spec.mjs`** (new, 390×844, 3 tests) with mocked `/api/routing`:
  - Chips render per tag, and none for NBA, which has no suggestion. The chip is at least 44px tall. Tapping the AFL chip ticks `#afl-tips`, updates the summary and saves nothing. Save then posts exactly `{guild_id, tags, multi_sport_mode, delete_tags, forget}` with the usual tag keys.
  - Apply all ticks all three, then Save stores them.
  - An older payload with no `suggestions` shows no chips and saves as before.
  - Every test also checks for no page errors and no new tab or window.

## Tests
| | Before (main) | After |
|---|---|---|
| `npm test` | 420 pass | 425 pass, 0 fail |
| `node scripts/build-public.mjs` | ok, 141 files | ok, 141 files (`routing.js` was already public; term scan clean) |
| `npx playwright test routing-suggest` | — | 3 pass |

The rest of the e2e suite wasn't re-run for this job (only `routing.js` changed). The job 03 note explains the 10 environmental e2e failures that are already on main. To run e2e in this sandbox I used a local config override pointing at `/opt/pw-browsers/chromium`. No repo config was changed.

## Screenshot
`routing-suggest.png` (Settings → Channels at 390px with three suggestions) was sent with this handoff rather than committed, because `.gitignore` ignores `*.png`. The spec writes it to `$E2E_SHOTS_DIR` (default: the OS temp dir).

## Already broken on main, spotted but not touched (worth a quick fix)
**Under the Apex theme, the first row of the Sport routing table is hidden.** `assets/theme-apex.css:258` makes every `table thead th` `position:sticky; top:calc(48px + safe-area)`. The routing table sits in an `overflow-x:auto` wrapper, so that wrapper becomes the sticky container and the header is drawn 48px lower, on top of the first tag row. With the default tags, **the AFL row can't be seen or ticked** at 390px. I confirmed this on untouched main with Playwright (`th` computed `position: sticky; top: 48px`, sitting over the AFL row's box). The same thing probably affects any other Apex table inside a scroll wrapper.

The likely one-line fix is to scope that rule to tables that aren't inside a horizontal scroller, or to add `html[data-theme="apex"] #sport-routing-box thead th{position:static}`. I left it alone because the theme file is outside this job. Until it's fixed, the AFL suggestion chip still works, since it sits in its own row below the hidden one.

## Suggested changelog line
"Sport routing: Settings → Channels now suggests channels for each sport from your channel names. Tap a suggestion (or Apply all) and press Save."

## Integration steps
1. Build the TipBot half from the job 11 brief (`services/sport_route_suggest.py`, the `suggestions` line in `sport_routing_api._state_payload`, and `tests/test_sport_route_suggest.py`), emitting the row shape above.
2. Merge TipBot first, then this branch. Either order is actually safe, because tipdash shows nothing without the field.
3. Live check on a test server with `feat.sport_routing` on and two sport channels: the chips appear, Apply all then Save stores the routes, and a test tip routes correctly.
