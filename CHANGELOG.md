# Changelog: toxieon/tipbot-dashboard (tipdash)

## 0.42.1 · 2026-10-01 · `csv-template` · Paste tip sheet: owner-only "Download CSV template" (needs TipBot 0.43.1)

- Admin Tools → Paste tip sheet (owner-only panel) gains **Download CSV template**. It fetches TipBot's `GET /api/owner/tipsheet-template` (owner-only) and saves `tipsheet-template.csv`: notes lines (`#`, allowed values), the header with exactly the columns the importer reads, and one example row. Older TipBot: "This needs TipBot's latest deploy" (press the button again once it's live).
- The Paste sheet now also reads that CSV: a sheet whose first line starts `kind,` (no tab) is read as CSV (quoted cells allowed); `#` lines are notes. TSV / two-space sheets are read exactly as before. Same rule as TipBot's parser.
- Tests: `tests/tipsheet_template.test.js` (4; the template is the shared fixture `tests/fixtures/tipsheet_template.csv`, checked byte-for-byte against TipBot's generator in TipBot's tests). `tests/split.test.js`: new admin entry point `pasteSheetTemplate`.

## 0.41.2 · 2026-10-01 · `light-server-rosters` · Server page and builder load less (needs TipBot 0.42.3 for the full gain)

- **Server page:** `/api/server` no longer carries live/FT prop counts (TipBot 0.42.3). They load right after the page paints from `GET /api/server/prop-counts` and are merged into the tip legs (`current`, `emoji`, `status`, `line`, `side`), then the page repaints once. An older TipBot has no such endpoint, but its `/api/server` still includes the counts, so the miss is ignored.
- **Builder:** the games list asks for `/api/fixtures?rosters=0` (no players: a few KB instead of a few hundred). Picking a game fetches only that game's players from `/api/fixtures/roster?game=` (cached 2 min per game) and shows "Loading players…" meanwhile. Older TipBot: it ignores `?rosters=0` (players already present, nothing extra fetched) or 404s the roster endpoint, and the builder falls back to the full `/api/fixtures` payload. Also used for the 3-min games poll and the old-TipBot upcoming fallback.
- `assets/light-data.js` (browser `TBLight` + node export). Tests: `tests/light_data.test.js` (6). No visual changes.

## 0.41.1 · 2026-09-30 · `scheduled-tips` · Server page: Scheduled Tips (cancel, adjust odds, edit before posting)

- New **Scheduled Tips** section on the server page (open by default): the server's queued / scheduled tips that haven't posted yet, with when each posts ("⏰ Posts Wed 10:30 pm (in 9 min)"), legs, odds, stake, bookmaker, an image badge and "↗ forwarded" when the master already has the scheduled copy. Refreshes every 30 s.
- Actions (same sign-in as the builder): **Cancel tip** (confirm), **Adjust odds**, **Edit** (leg text, odds, stake, bookmaker). They go through TipBot `POST /api/scheduled-tip` (list: `GET /api/scheduled-tips`), which updates the queued tip and the forwarded master copy. A tip that already posted comes back with TipBot's clear "already posted" message and drops off the list.
- `assets/scheduled-tips.js` (browser `TBScheduled` + node export). Tests: `tests/scheduled_tips.test.js` (9). Needs TipBot 0.41.1; older TipBot shows "needs TipBot's latest deploy".

## 0.40.3 · 2026-09-30 · `stats-flicker` · Server stats stop flashing to 0; the builder loads its data in parallel (perf deep dive quick fixes)

- Home: the fast `lite=1` server list has no stats, so it now keeps the stats already shown (saved boot copy / current state) and saves those, instead of overwriting them with nothing. Cards with no stats yet show "…" instead of 0.
- The lite list only re-renders home when home is showing. It no longer pulls you off a server page back to home.
- Server page: a saved copy (memory or disk) paints with "Updating…" for Tips Queued (tile and summary) until fresh `/api/server` data arrives. Disk copies older than 10 min aren't painted at all. If the refresh fails, the last known count shows again.
- Builder: `players.json`, `bookies.json` and `/api/fixtures` load in parallel (`prefetchBuilderData`), and are warmed once a server page has loaded, so opening the builder reuses them.

## 0.40.2 · 2026-09-29 · `lazy-builder` · The tip builder and Paste sheet load on first open (Claude, Phase 2.2b)

No visual or behaviour changes. The first page load no longer downloads or parses the tip builder or Admin Tools' Paste tip sheet.
- **What moved:** 88 top-level declarations of the builder (AFL games/players, custom tips, ESPN NFL/NBA/WNBA picker, tray, review, schedule, batch, drafts) to `assets/builder.js`, and the 8 of Paste tip sheet (parse, preview, confirm) to `assets/admin.js`, **byte-for-byte**: every one of the main script's 425 top-level declarations is still there exactly once across index.html + the two files (checked by parsing all three).
- **How:** index.html's main script was never a closure but a top-level classic script, so its `const`/`let`/`function` names (`BUILD`, `BATCH`, `STATE`, `$`, `esc`, `api` …) are shared with any other classic script on the page. The two files are plain scripts in that same scope, so the moved code runs unchanged. The one small namespace is `window.TD`: `TD.load(name)` adds `<script src="./assets/<name>.js?v=<VERSION>">` once (cache-busted every release, `TD.version` must equal `VERSION`), and index.html keeps a placeholder for each entry point the rest of the app calls (`openBuilder`, `openCustom`, `pasteSheetPreview`, `pasteSheetConfirm`). A placeholder loads its file, then the real function the file declares replaces it. A failed load shows "Couldn't load the tip builder/admin tools. Check your connection and try again." and a retry fetches again.
- **Kept in index.html** (used outside the builder): the Results view, `teamName` / `aflLogoHtml` / `fmtGameWhen` and their helpers, the batch tray (`renderBatchTray`, `syncTrayStack`, `clearBatch`: every server open calls it), and the Compare-pick listeners that register at load (`applyComparePick`, `compareHref`). **God mode stays too:** it isn't a separate block but part of `renderDetail` and the shared grading every tip card uses, so moving it would make ordinary server views load a lazy file.
- **Measured** (first load, mocked API, local server): index.html **513 KB → 406 KB raw, 137 KB → 109 KB gzip** (−28 KB on the wire; builder.js is 27 KB gzip, admin.js 4.5 KB, fetched only when used). DOMContentLoaded median over 15 runs: 191 → 175 ms unthrottled, 670 → 570 ms with 4× CPU throttling (a mid-range phone).
- **Browser check** (Playwright, mocked API, 390 and 1280 px): home, server page, builder, custom tip, the NBA prop picker (Add puts a leg in the tray) and Paste sheet Preview, on 0.40.1 and 0.40.2: 0 page errors; screenshots pixel-identical (one 1280 px server-page strip differed only run to run, on both builds); home and server pages fetch neither file; opening the builder fetches `builder.js?v=…` once and Preview fetches `admin.js?v=…` once.
- Tests: **50 → 56 passing** (+6 `split.test.js`: the lazy files compile, stay sloppy-mode and aren't in any `<script src>`; `TD.version` = `VERSION`; placeholders vs real entry points and no name clashes; the loader run for real (one fetch for a double click, arguments passed, failed load toasts and can retry, no loop when a file lacks its function); and a smoke run of the real page scripts plus the lazy files in a fake DOM with a mocked API: home, server page, builder, custom tip, NBA picker and Paste preview open, lazy files fetched only on first use). `lines.test.js` and `espn_props.test.js` now read the builder code from `assets/builder.js`, with the same assertions.

## 0.40.1 · 2026-09-29 · `nba-props` · NBA/WNBA player props in the builder (Claude, Phase 2.1)

Needs TipBot 0.40.1 for the props; older TipBot keeps working (see below). Grading is TipBot's and ships OFF there.
- **The NFL prop picker is reused for NBA and WNBA.** Opening an NBA/WNBA game now loads the roster from TipBot `GET /api/espn/players?league=…&event=…` and shows the same tabs, sliders, Over/Under and Add row as NFL, with the five markets TipBot grades: Points, Rebounds, Assists, Threes Made, Points + Rebounds + Assists. Legs carry `player_id`, `prop`, `line`, `side`, `league`, `espn_event_id` and `game_id`, the same shape as NFL legs, and get the half-point rule like every player prop. "＋ Free text" still opens the match-pick box for free-text selections on the same game.
- **Older TipBot:** if `/api/espn/players` isn't there (404), the game opens the free-text pick as before, with "player props need TipBot's latest deploy" and Retry.
- **Fixed (NFL too):** the prop picker's Add buttons were never wired. Since `f5a94cf` the wiring loop read an undeclared `q` and threw right after the rows were drawn. The render and the wiring now share one player list (`visiblePlayers`), so search can't shift which row a button belongs to.
- League differences live in `assets/espn-props.js` (`TBEspnProps`): prop tables (NFL values unchanged), roster URL, the NFL-only skill-position filter, and the leg builder. No theme or design work.
- Tests: **42 → 50 passing** (+8 `espn_props.test.js`: prop tables, roster URLs, player lists, leg shape, market labels, index wiring and the missing-endpoint fallback, plus the real `paintEspnNflPlayers` run against a fake DOM for NBA and NFL; the NFL case throws "q is not defined" on 0.39.2).

## 0.39.2 · 2026-09-29 · `hide-master-home` · TipBot Master Server hidden from the home servers list

- The home servers list (and the one-server auto-open) skips the configured master guild. The id comes from the owner's `/api/master/config` (`config.master_guild_id`), with the known id `1553952007923040309` covering the first paint; never matched by name. View-as, the ⚙ menu and the Master pages (`/master/`) are unchanged, so the master server is still reachable there.

## 0.39.1 · 2026-09-28 · `slip-import` · Slip import card (Claude, Phase 1.3)

Needs TipBot 0.39.1. Off by default.
- **Master → Overview → Slip import** card (`assets/slip-ui.js`): the Slip import on/off switch, the #slips channel picker (master server channels), the default target server (with its unit size), and status: vision key set yes/no, model, drafts today and approximate spend (today and this month). Saves to `POST /api/owner/slip-import/settings`. A missing endpoint shows "This needs TipBot’s latest deploy." with Retry.
- No theme or design work: existing master card, switch, select and stats styles.
- Tests: **38 → 42 passing** (+4 `slip_ui.test.js`). Mocked browser check of the Overview tab at 390 and 1280 px: 0 page errors, no horizontal scroll.

## 0.38.1 · 2026-09-28 · `consensus` · Consensus tab + shared half-point helper (Claude, Phase 1.2)

Needs TipBot 0.38.1. Consensus ships OFF (on = false, dry run = true).
- **Master → Consensus tab** (`assets/consensus-ui.js`) replaces the placeholder: the Consensus on / Dry run / Paused switches (each with a confirm; turning dry run off needs the beta on and a verified master), the settings form (minimum servers, minimum % of active servers, window, line tolerance, before-start rule, multi legs, sports, what the post shows) and a **live "what would qualify right now" preview** (`GET /api/consensus/preview` with the unsaved values). A missing endpoint shows "This needs TipBot’s latest deploy." with Retry. The Overview status pill shows Consensus on only when it is on with dry run off.
- **Half-point rule moved to `assets/lines.js`** unchanged (`applyHalfPointLine`, `normalizePropLines`, `lineAdjustNote`); `index.html` calls it, so builder behaviour is identical. TipBot now has a Python twin, checked by the shared `tests/fixtures/half_point_vectors.json` (same bytes in both repos).
- No theme or design work: existing master card, switch, pill, stats and table styles.
- Tests: **28 → 38 passing** (+4 `lines.test.js`: shared vectors + wiring; +6 `consensus_ui.test.js`: form validation, preview query, missing endpoint, rendering, tab wiring). Mocked browser check of the Consensus tab at 390 and 1280 px: 0 page errors, no horizontal scroll.

## 0.37.1 · 2026-09-28 · `sport-routing` · Sport routing popups + settings (Claude, Phase 1.1)

Needs TipBot 0.37.1. **Nothing changes until a server turns on sport routing** (`feat.sport_routing`, default off).
- **Post-time decisions** (`assets/routing.js`). Before the confirm step of Review/Schedule, custom tips and batches, tipdash asks `POST /api/routing/preview` where each tip goes. One channel: no popup, just a chip on the confirm (“→ #afl-plays”). Rules clash (several tags/channels, not “post to all”): a popup lists each candidate channel with why it matched, checkboxes, and “Remember this choice” (admins). More than one channel in the end (including a “post to all” rule): a confirm popup lists the channels. Nothing matched: “Post to #tips (default) / pick a channel / cancel”. The choice travels with the tip as `route`; TipBot re-checks it. Batches ask per tip, only where needed.
- If routing is off, the endpoint is missing (older TipBot) or the preview fails, the tip is sent exactly as before (no `route`, TipBot decides).
- **Settings → Channels → Sport routing (beta)**, below the existing routing list: the “Enable sport routing (beta)” switch (existing feature-flags endpoint), the default channel (the Tips picker), a tag table (on/off, channels, keywords, priority, “Ask” / “Post to all”), add/delete custom tags, the multi-sport mode, the non-interactive rule, remembered choices with Delete, and a test box. Saves to `POST /api/routing` (server admins). A missing endpoint shows “This needs TipBot’s latest deploy.” with Retry.
- `assets/sport-keywords.js`: the keyword matcher, identical to TipBot’s (shared vectors in `tests/fixtures/sport_keywords_vectors.json`), used for live keyword validation (50 terms, 60 characters).
- No theme or design work: the popups reuse the countdown-confirm sheet styles (`NDCountdownConfirm.injectStyles` is now exported), and the settings reuse the existing panel/feature-row/select styles.
- Tests: `node --test tests/*.test.js` **15 → 28 passing** (+4 `sport_keywords.test.js`, +9 `routing.test.js`: single, conflict, multi-confirm, none, cancel, batch, and missing endpoint / routing off / network error). Local mocked browser check at 390 and 1280 px: 0 page errors.

## 0.36.1 · 2026-09-28 · `forwarding-1c` · Forwarding tab (Claude, Block 1C)

- `master/index.html`: the placeholder **Forwarding** tab (previously labelled "phase 1C") now shows the global **Forwarding on** and **Paused** switches (`POST /api/master/config`, each with a confirm), a status panel (forwarded / queued / retrying / gave up / queue depth / duplicates found / last error) and a per-server table (channel, Active or No Longer Active, per-server toggle via `POST /api/master/forward/source`, last forward, counts).
- If `/api/master/forward/status` is missing (TipBot not deployed yet) or errors, the tab shows "This needs TipBot's latest deploy." with a Retry button. The switches are disabled while `MASTER_BETA_DISABLE` is set, beta is off or no master is verified.
- No theme or design changes; it reuses the existing card, stats and access-table styles.
- **Versioning (new).** `VERSION` file (`0.36.1`) and `VERSIONING.md` (the bump rule for every merge to `main`). The version shows at the bottom of the ⚙ Settings menu (`tipdash v0.36.1`). History replay put `main` at 0.35.3 after #88, so this merge is 0.36.1.
- Tests: `node --test tests/*.test.js` **13 → 15 passing** (+2 in `tests/version.test.js`: VERSION format, and the Settings-menu label and CHANGELOG match it). Local mocked browser smoke at 375 and 1280 px (normal, toggles, 404): no horizontal scroll, 0 page errors, and the two POST bodies were as expected.

## 2026-09-28 · `p3-dash-notes` · Phase 3 assessment + remaining list (Husker)

- **#5 (split the builder/admin JS): assessed, not done.** `index.html` is 510 KB raw but **139 KB gzip on the wire** (Pages sends `content-encoding: gzip`, `max-age=600`). The 431 KB main script is one closure: 347 top-level functions, and the builder alone references `BUILD` 436×, interleaved with shared `STATE`, `api`, `$` and `esc`. Moving it to on-demand assets safely means first exposing that shared state through a small module boundary, then a browser pass over every builder/admin flow with an owner token. That is a ~1–1.5M block, not a small safe change for an unattended night, so it is scoped in REMAINING.md.
- `REMAINING.md` updated after phases 2/3.
- No code changes; tests still **13 passing**.

## 2026-09-28 · `p2-dash-request-pool` · Fewer overlapping requests (Husker, P2b)

- **All communities** now loads at most 4 communities at a time (`ROLLUP_CONCURRENCY`) instead of firing `/api/follower` for every follow at once. Results keep their order, so the merged rollup is unchanged.
- **In-flight GET dedupe** in `api()`: identical plain GETs (same path, token, retries and timeout) already in flight share one request, and each caller gets its own `Response.clone()`. Mutations, custom headers and signals, and `onAttempt` callers are never shared. Finished requests are not cached, so the next call hits the network as before.
- **Builder live refresh** no longer stacks. A 30 s poll tick or a ↻ tap while the previous refresh for the same game is still running waits on that one instead of starting another.
- The helpers live in `assets/req-pool.js` (`mapLimit`, `createDedupe`, `singleFlight`). `index.html` falls back to the old behaviour if the file fails to load.
- Tests: `node --test tests/*.test.js` **13 passing** (+5 in `tests/req_pool.test.js`). Local mocked browser smoke at 375 and 1280 px: 7 follows → 7 requests, peak 4 in flight, rollup rendered, 0 page errors.

## 2026-09-27 · `b2-landing` · Landing (Husker)

Landed Claude's feature-pass UI and Codex's Master access/audit tabs on top of `f98decb`. There are no tipdash code changes of my own. What I checked:
- `FEATURE_COMPARE` and `FEATURE_HEATMAPS` still default to `false`. They can only be turned on per browser with `?compare=1` / `?heatmaps=1`.
- The master beta switch, "Set as master", lockdown apply and whitelist removal each ask for a `confirm()`.
- The Master page's `?api=` override only works on localhost.
- Codex's CRLF line endings were converted back to LF in CHANGELOG/REMAINING.
- `node --test tests/*.test.js`: **8 passing**. TipBot backend lands first (828 passing on Linux with libsql).

## 2026-09-27 · `master-access-ui` · Phase 1B companion (Codex)

The Master page now has functional Lockdown & access and Audit log tabs, using the existing theme tokens and owner-only backend.

**Changes**
- Separate default-role checkbox, per-channel human-readable permission diff, explicit apply confirmation and expiring review token. Changing the choice or whitelist invalidates the shown review.
- Whitelist add/edit/remove, default read-only, channel/category/source scope IDs kept as strings, queued-action status refresh and pause-repair control.
- Administrator bypass warning, member count, audit-event filter and pagination. Missing endpoints show a deploy-needed message; network failures are handled.
- Beta switch confirmation added; mobile whitelist entries stack without page overflow. No existing theme was redesigned.

**Validation**
- `node --test "tests/*.test.js"`: **8 passing** (5 inherited + 3 new); tests cover exact ID parsing and escaping.
- Headless Chrome 375px/1280px: preview/confirm/apply, queue status, whitelist DELETE, audit, missing endpoint; clean console on normal flows and no page overflow. All API responses mocked locally.
- Companion TipBot suite: 819 passing.

**Unplanned / extra**
- Brandon authorized local snapshot + Claude overlay as the base. No GitHub main merge was assumed.
- These two tabs were brought forward from block 3 to make block 1B usable. Beta confirmation covers one of Husker's planned landing fixes.

**Skipped / deferred**
- Forwarding and Consensus tabs remain placeholders for their corresponding backend blocks.
- No PR/deployment, live flag changes, domain edits or visual redesign. Real Discord behavior needs Ray's M3–M7 test-guild script.
- Source scopes take effect when phase 1C creates forwarding mappings. Whitelist expiry remains an unapproved proposal.


## Summary of this build (2026-09-27 AEST, Claude)

- **Base:** `f98decb` (PR #84). **Tests:** `node --test` 5 passing (new harness for the clock helper). Browser-checked at 375 px, 1200 px and in all three themes.
- **Flags left OFF:** `FEATURE_COMPARE`, `FEATURE_HEATMAPS` (both have `?x=1` dev overrides). The master beta is off on TipBot, so the Master page shows everything off.
- **Codex:** all new UI uses existing tokens and semantic classes, with no inline colours. See each PR's "UI notes for Codex".
- **Known gaps:** see `REMAINING.md`.

---

## 2026-09-27 · `trial-mode` · Feature G UI
- Server detail (**owner only**):
  - "Trial mode (follower tracking off)" switch, plus an expiry date (a Sydney day; the trial ends at the end of that day) and an "On expiry" select;
  - a Save button;
  - confirm dialogs that explain follows are kept, and that there's no backfill.
- Badges `.badge.trial` ("TRIAL · expires 12 Oct") and `.badge.trial-expired` on the server list card and the switch label.
- Follower view: `.trial-banner` "Tracking is off during this server's trial…".
- Calls `POST /api/server/trial`.
- **Skipped:** no header badge outside the switch row (the card badge plus the switch label cover it).

## 2026-09-27 · `master-page` · Master page (Phase 1-UI, first slice)
- New **`master/index.html`** (owner only; non-owners get "Owner only").
- Tabs:
  - **Overview:** beta switch, status pills (lockdown, forwarding and consensus show "not built yet"), sources count, and the master plus when it was verified.
  - **Master server:** candidate list (ineligible greyed with the reason; OLD MASTER / CURRENT tags), Run verification, the ✅ / ❌ / ⚠️ / ℹ️ checklist with fix hints, and **Set as master** (enabled only when every required check passes; TipBot re-verifies).
  - **Lockdown**, **Forwarding**, **Consensus** and **Audit** are placeholder tabs saying "not built yet".
- Owner gear → "Master server (beta)" link (`#dd-master`, owner only).
- UI classes for Codex: `.tabs .tab[aria-selected] .soon`, `.card`, `.pills .pill.on/.off/.todo`, `.stats`, `.switch`, `.cands .cand[aria-pressed] .tag .why`, `.checks .check[data-state=pass|fail|warn|info] .ic .lb .lv .dt .fx`, `.banner.ok/.err`.

---

## 2026-09-27 · Feature pass, five PRs (details in each drop's `PR_NOTES.md`)
- **`live-page`:** new standalone `live/index.html` (games board, sport and server filters, game centre, tips per game, signed-out mode); a Live link in the top nav.
- **`heatmaps`:** `HeatmapCard` on `/live` behind `FEATURE_HEATMAPS` (off).
- **`sydney-time`:**
  - new `assets/tbtime.js` (shared Sydney clock) and `tests/tbtime.test.js`;
  - theme day/night, the calendar day sheet, Scores / fixtures / ESPN times, the quota "as of" and the draft banner all use Sydney time;
  - fixes Scores showing AFL starts ~10 h early.
- **`signup-gate`:** the "I'm in Australia" declaration screen (`#signup=`), the `region_declined` message, and the owner Settings row (toggle plus per-user Allow / Block / Clear).
- **`compare`:** `compare/index.html` rebuilt (best value across SB / PB / Ladbrokes, line table, Use in builder); the builder's Compare link sends the game name, line and side; the builder receives picks through localStorage.
- **Unplanned / extra:** the Scores time bug fix; the builder Compare link fix (it was sending an id the odds cache can't resolve).


## Summary of this build (Codex continuation)

Lockdown & access and Audit log are usable with the phase 1B backend. Eight unit tests and desktop/mobile browser checks pass. All feature defaults are unchanged.
