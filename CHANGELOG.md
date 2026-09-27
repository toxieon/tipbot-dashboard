# Changelog: toxieon/tipbot-dashboard (tipdash)

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
