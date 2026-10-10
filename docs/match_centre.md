# AFL Match Centre — asset handoff (integration)

This document describes **standalone assets** for AFL/AFLW stadium art and a **lab prototype** of the bet365-style Match Centre. Nothing here is wired into `index.html`, `builder.js`, or production CSS yet.

## Asset layout

```
assets/stadiums/
  mcg.svg
  marvel.svg
  adelaide.svg
  optus.svg
  gabba.svg
  scg.svg
  giants.svg          # Engie / Sydney Showground
  gmhba.svg
  carrara.svg         # People First
  bellerive.svg
  manuka.svg
  norwood.svg
  yorkpark.svg
  traeger.svg
  marrara.svg
  barossa.svg
  hands.svg
  generic.svg         # fallback silhouette
  venues.js           # id + label + alias map (CommonJS / StadiumVenues)

labs/match-centre/    # NOT in public build (see DENY_DIRS)
  index.html          # interactive prototype
  match-centre.js     # panel model + worm + ticker (TBMatchCentre)
  match-fx.js         # goal/behind FX hook (TBMatchFx)
  match-centre.css
```

Each `.svg` is original vector art: isometric oval, stands, light towers, pitch. No photos, logos, or external URLs.

### Venue resolution

```js
const V = require("./assets/stadiums/venues.js");
const id = V.venueId("Marvel Stadium"); // "marvel"
const file = V.svgFile(id);             // "marvel.svg"
```

Load in the app with a stable path, e.g. `./assets/stadiums/${id}.svg` (public build ships the whole `assets/` tree except denied files).

## Match Centre prototype (lab)

Open locally: `labs/match-centre/index.html` (serve repo root or `labs/match-centre/` so `../../assets/stadiums/` resolves).

**Includes:**

- Stadium scene via `<img src="../../assets/stadiums/{venueId}.svg">`
- Scoreline (totals + goals.behinds), quarter clock, momentum worm, last-event ticker
- `TBMatchFx.goal(venue)` / `TBMatchFx.behind(venue)` — coordinate with goal/point animations PR `bc-2a44bb8b`

**Reduced motion:** `match-centre.css` only runs ball flight / camera push when `prefers-reduced-motion: no-preference`; otherwise a brief brightness flash.

## Planned production integration (not implemented)

When wiring into the builder game page:

1. **Scripts** (order): `assets/stadiums/venues.js` → match FX → match centre logic (copy or move from `labs/match-centre/` into `assets/` if desired).
2. **Mount** `<div id="match-centre">` on AFL game view; call `TBMatchCentre.paint(el, game, live, state)` on render.
3. **Live updates** — reuse existing `refreshLive()` → `GET /api/live-stats?match=&complete=` at **30s** (`LIVE_POLL_MS`). Do not add polling. Merge scores with `TBMatchCentre.applyLiveMatchFields(game, data)` then `onLiveTick`.
4. **Data** — fixture game fields: `venue`, `hscore`, `ascore`, `hgoals`, `hbehinds`, `agoals`, `abehinds`, `complete`, `phase`. Live payload may mirror those fields; optional future `events[]` on the same endpoint.
5. **Event detection** — prefer goal/behind counters; fallback decompose point deltas (+6 goal, +1 behind). Fire `TBMatchFx` on scoring events.
6. **Game cards** — optional card hero: `<img>` or inline SVG from `assets/stadiums/{venueId}.svg` behind card content; respect `overflow:hidden` and reduced motion.

## Public build

`labs/` is listed in `DENY_DIRS` in `scripts/build-public.mjs` so prototypes never ship to tipdashhq.com. Stadium SVGs under `assets/stadiums/` **do** ship with the normal `assets/` allowlist.

## Tests

`tests/stadium_assets.test.js` — file presence, SVG sanity, venue map, lab path, `labs/` denied from dist.
