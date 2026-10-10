# AFL Match Centre — asset handoff (integration)

Standalone **3D stadium assets** and **lab prototypes**. Nothing here is wired into `index.html`, `builder.js`, or production CSS.

## 3D stadium assets (shipping)

```
assets/stadiums/
  vendor/
    three.module.min.js    # three.js r170 (MIT) — see LICENSE-three.txt
    OrbitControls.js       # three.js examples (MIT)
    LICENSE-three.txt
  stadium-build.js         # StadiumBuild.build(THREE, spec) → THREE.Group
  venues.js                # alias map (StadiumVenues / CommonJS)
  mcg.js … generic.js      # per-venue procedural parameters (18 modules)
```

### Per-venue module

Each `assets/stadiums/<id>.js` registers `StadiumSpecs[id]` (and `module.exports.spec` for tests). Parameters drive:

- Oval `rx` / `ry`, tier count, stand height multipliers (`stands.n/e/s/w`)
- Roof: `ring` (cantilever truss ribs), `full` (Marvel), `arch` (Optus), `none`
- Light towers, emissive window planes, mowing stripes on the field
- Feature flags: `hill`, `scoreboard`, `south-stand`, `heritage-pavilion`, `rect-bowl`

Resolve venue name → file:

```js
const V = require("./assets/stadiums/venues.js");
const id = V.venueId("Marvel Stadium"); // marvel
const spec = require("./assets/stadiums/" + V.jsFile(id)).spec;
```

### Runtime build (WebGL)

```js
import * as THREE from "./assets/stadiums/vendor/three.module.min.js";
// load stadium-build.js (classic) or bundle
const group = StadiumBuild.build(THREE, spec);
```

Lighting in the lab viewer: hemisphere + ambient + directional + cool blue-grey materials (`MeshStandardMaterial`).

## Labs (not in public build)

| Path | Purpose |
|------|---------|
| `labs/stadiums/index.html` | Gallery of all grounds |
| `labs/stadiums/viewer.html?venue=mcg` | Full-screen orbiting WebGL preview (`autoRotate`, honours `prefers-reduced-motion`) |
| `labs/match-centre/` | 2D match-centre UI prototype (optional; integrate with 3D scene later) |

`labs/` is in `DENY_DIRS` in `scripts/build-public.mjs`.

## Planned production integration

1. **Mount** a WebGL canvas (or offscreen) on the AFL builder game page hero; load vendored three + `stadium-build.js` + venue module from `venues.js` resolution.
2. **Live data** — unchanged: `GET /api/live-stats` at 30s via existing `refreshLive`; merge scores into game object; drive scoreline / worm / ticker (see prior match-centre lab JS).
3. **FX** — `TBMatchFx.goal(venue)` / `behind(venue)` from goal/point animations PR `bc-2a44bb8b`; animate ball layer over the 3D canvas or a DOM overlay.
4. **Performance** — one stadium group per page; dispose renderer on navigate; cap `devicePixelRatio` at 2 on phone.

## Tests

`tests/stadium_assets.test.js` — venue `.js` files exist, specs validate, three.js licence on disk, builder API, labs paths, `labs/` denied from dist.
