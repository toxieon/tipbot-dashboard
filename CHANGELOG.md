# Changelog: toxieon/tipbot-dashboard (tipdash)

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
