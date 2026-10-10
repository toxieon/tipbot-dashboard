# AFL Match Centre (builder)

Handoff for the bet365-style **Match Centre** on AFL/AFLW builder game pages in tipdash. Original SVG/CSS only; no third-party match-centre widgets or broadcast assets.

## Goals

- One panel per AFL game page (live **or** upcoming): venue stadium hero, scoreline, quarter clock, momentum worm, last-event ticker.
- On **goal** / **behind**: ball-through-posts animation inside the stadium scene, camera push-in, burst, score tick — coordinated with `window.TBMatchFx` (goal/point animations PR `bc-2a44bb8b`).
- **No extra polling**: reuse the existing 30s `refreshLive` → `GET /api/live-stats?match=&complete=` cadence and fixture fields already on `BUILD.game`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  builder.js renderGame()                                     │
│    └─ <div id="match-centre">  (shell, once per paint)       │
│         TBMatchCentre.paint(el, game, live, state)           │
├─────────────────────────────────────────────────────────────┤
│  refreshLive(g)  every LIVE_POLL_MS (30s, unchanged)         │
│    → BUILD.live = /api/live-stats JSON                       │
│    → applyLiveMatchFields(g, data)  (scores on game object)  │
│    → TBMatchCentre.onLiveTick(el, g, live, state)          │
│         ├─ detectEvents(prevSnap, nextSnap)                  │
│         ├─ TBMatchFx.goal|behind(venue) on scoring events    │
│         └─ patch DOM (scores, worm, ticker, clock)           │
├─────────────────────────────────────────────────────────────┤
│  assets/match-centre.js   TBMatchCentre  (model + render)    │
│  assets/match-fx.js       TBMatchFx      (animations hook)   │
│  assets/afl-stadiums.js   TBAflStadiums  (venue SVG)         │
└─────────────────────────────────────────────────────────────┘
```

### Render layers (bottom → top)

| Layer | Class | Role |
|-------|--------|------|
| Stadium | `.mc-stadium-stage` → `TBAflStadiums` SVG | Isometric ground + stands (venue-mapped) |
| Posts | `.mc-posts` | Goal posts (animation target) |
| Ball | `.mc-ball` | Flies through posts on goal/behind |
| Burst | `.mc-burst` | Flash / particles on major scores |
| Chrome | `.mc-scoreline`, `.mc-clock`, `.mc-worm`, `.mc-ticker` | UI outside the 3D-tilt stage |

`prefers-reduced-motion` (and `html[data-motion=reduce]`) disables ball flight and camera; scores and ticker still update with a short opacity flash.

## Data sources

### Fixture game (`BUILD.game`)

From `/api/fixtures` lean payload (same object used today for the picker). Relevant fields:

| Field | Use |
|-------|-----|
| `venue` | Stadium art via `TBAflStadiums.venueId` |
| `hteam` / `ateam` | Names in scoreline |
| `hscore`, `ascore` | Total points |
| `hgoals`, `hbehinds`, `agoals`, `abehinds` | Preferred scoring-event detection |
| `complete` | 0–100 progress; live band is `>0 && <100` (same as builder live poll) |
| `phase` | `{ label, fraction }` when present on game |
| `date` / `unixtime` | Upcoming kickoff display |
| `live` | Badge when true |

### Live stats (`BUILD.live`)

From `GET /api/live-stats?match=<aflMatchId>&complete=<complete>` — **same call and rate** as player rows today.

| Field | Use |
|-------|-----|
| `available` | Live player stats gate (unchanged) |
| `phase` | Quarter clock + worm time axis (`label`, `fraction`) |
| `players` | Not drawn in match centre (still used by player list) |
| `hscore`, `ascore`, `hgoals`, `hbehinds`, `agoals`, `abehinds` | Merged onto `BUILD.game` when present |
| `events[]` (optional) | If TipBot adds `{ type, team, player, label }`, used before goal/behind inference |

`applyLiveMatchFields` in `match-centre.js` normalises aliases (`home_score`, nested `match`, etc.) without new endpoints.

## Event model

Internal events (`TBMatchCentre.Event`):

| `type` | When | FX |
|--------|------|-----|
| `goal` | Home/away goals count increases (or +6 pts if only totals) | `TBMatchFx.goal(venue)` |
| `behind` | Behinds count increases (or +1 pt) | `TBMatchFx.behind(venue)` |
| `quarter` | `phase.label` changes (e.g. Q1 → Q2) | ticker only |
| `final` | `complete >= 100` or phase indicates full time | ticker; FX off |

Ticker shows the latest event; worm appends a point on each score change (margin = home − away).

## Wiring (builder)

1. `renderGame()` inserts `<div id="match-centre" class="match-centre">` and calls `paintMatchCentre()` (wrapper around `TBMatchCentre.paint`).
2. `openGame()` resets `BUILD._mcState` when the match id changes.
3. `refreshLive()` after JSON parse: `applyLiveMatchFields(g, data)`, then `onLiveTick` if `#match-centre` is mounted (does **not** re-run full `renderGame` / player list except existing `renderPlayers()`).
4. External animations PR: call `TBMatchFx.goal(venue)` / `TBMatchFx.behind(venue)` — match centre registers the active stage via `TBMatchFx.bind(matchCentreEl)`.

## Phone / performance

- Panel is `max-width: 100%`, `overflow: hidden`, worm SVG `viewBox` scales down.
- Animations use CSS transforms on one composited layer; one-shot class toggles (no `requestAnimationFrame` loops).
- Live poll unchanged (`LIVE_POLL_MS` in `index.html`).

## Tests

`tests/match_centre.test.js` — venue map smoke, event detection from goals/behinds, score fallback, builder wiring strings, reduced-motion CSS guards.

## Future (TipBot)

Optional richer feed on the **same** `/api/live-stats` response: `events[]`, `worm[]`. Match centre will prefer explicit events when present; no dashboard polling change required.
