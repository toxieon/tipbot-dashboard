# Handoff note: game-view-camera-angles (job 08)

Branch `claude/game-view-camera-angles`, cut from tipdash main `c025ebd` (0.66.7).

> **Sequencing: read this first.** The brief says to start only after the stadiums job has merged, because it rewrites `assets/mcg/*`. **It hadn't merged when I built this** (main still has the single-MCG `mount.js`). I built it anyway to save a round trip, and kept the footprint small so it's quick to re-apply:
> - `assets/mcg/cameras.js` is **new and self-contained**: presets, tween maths, saved choice, chip row and its CSS.
> - `mount.js` gets **only additive hooks** (+63 lines, nothing removed), listed below.
> - `index.html` gets **one line**.
>
> If the stadiums job rewrites `mount.js`, re-apply the hook list onto its version, and have each stadium config pass `{cameras: [...]}` through `mount(host, {stadium})`. It doesn't touch job 03's area (the Game view functions stayed in index.html there), so 03 and 08 can merge in either order.

## What changed
- **`assets/mcg/cameras.js`** (new ES module, imported by `mount.js`, no new library):
  - **The table.** `CAMERAS` lists `broadcast` (identical to `mount.js` `CAM`, a test enforces it), `goals-north`, `goals-south`, `wing` and `blimp`, each with `id`, `label`, `fov`, `pos`, `look` and an optional `minAspect`. The values were tuned by eye in headless Chromium; the ends sit inside the bowl, clear of the stand roofs.
  - **Per stadium.** `camerasFor(stadium)` uses a stadium's own `cameras` table when every entry is valid and it includes `broadcast`; otherwise it falls back to these MCG values.
  - **`minAspect`.** `effectiveFov()` widens the fov on hosts narrower than `minAspect`, keeping the horizontal coverage.
  - **Tween maths.** `cameraAt()` (ease-out cubic) and `tweenProgress()` (600 ms; instant under reduced motion).
  - **Ends.** `nextCameraForChip()`: tapping "Ends" again flips north and south, and the chip label shows "North end" or "South end".
  - **Saved choice.** `loadCameraChoice()` / `saveCameraChoice()` use `localStorage` key `tipdash_gv_cam`, wrapped in try/catch (private mode is safe, and an unknown id falls back to Broadcast).
  - **The chip row.** `mountCameraChips(host, handle)` draws `Broadcast · Ends · Wing · Blimp` at the bottom-left of the ground. Each button is a 44×44 px tap target around a 28 px visual pill, using safe-area insets, the existing `.fl-demo` button look and theme vars. It applies the saved camera on open. **There's no row in photo mode:** none for a fallback handle, and the CSS hides it whenever the host loses `is-webgl` (WebGL off or the context lost).
  - **The 2D player overlay.** The cartoon players (`TBLiveFx.afl`, a flat SVG laid over the broadcast framing) would float over the stands under other cameras, so they're hidden when `data-cam` isn't `broadcast`, and come back on Broadcast.
- **`assets/mcg/mount.js`** (additive hooks only):
  - imports from `cameras.js` and re-exports `mountCameraChips`;
  - `export var POSE_FOLLOWS_ACTIVE_CAMERA = false`, commented: logo tilt keeps facing `CAM.pos` (the broadcast camera), as the brief requires. `corners()` is unchanged;
  - `export function setCamera(handle, id, {animate})`;
  - inside `mount()`: `cams = camerasFor(opts.stadium)`, `applyCam` / `setCam` / `stepCam`. The tween steps inside the existing `draw()` loop, so the render-loop policy is unchanged. With `still` (prefers-reduced-motion) or `{animate:false}` it jumps and renders once. After a move, the light tower nearest the lens is re-hidden for the new camera (`hideTowerOnLens` used to run only for broadcast);
  - `resize()` re-applies the preset fov for the new aspect;
  - the handle gains `cameras`, `get cameraId()` and `setCamera`;
  - no extra model loads, and the DPR cap is untouched.
- **`index.html`**: one line in `fliveMount()`, after the ground mounts: `FLIVE.mcgMod.mountCameraChips(host, handle)` in a try/catch.

## Tests
- **`tests/game_view_cameras.test.js`** (10 tests) covers:
  - the table's shape and broadcast == `CAM`, plus the ends mirroring each other;
  - stadium override and fallback;
  - the tween maths: start, middle (ease-out 0.875 at t = 0.5), end, clamping and reduced motion;
  - `minAspect` keeping the horizontal coverage;
  - the Ends flip;
  - the `localStorage` round trip, including unknown ids and throwing storage;
  - **no chip row in fallback mode**, with the host never touched, and the CSS rule for lost WebGL;
  - chip markup (4 buttons, 44 px, `aria-pressed`, the end label);
  - the `mount.js` API: the `setCamera` export, `POSE_FOLLOWS_ACTIVE_CAMERA === false`, tilt still using `CAM.pos`, and one `loadAsync` (no extra model loads);
  - the index wiring, plus no `console.*` or new tabs.
- **`tests/e2e/game-view-cameras.spec.mjs`** (4 tests) runs the demo Game view with WebGL (swiftshader):
  - at **390×844 and 1440×900** it checks 4 chips, each at least 44×44, the row fitting inside the ground with no horizontal scroll, and cycles **every preset**, checking `data-cam`, `aria-pressed` and `handle.cameraId`, with a screenshot of each to `tests/e2e/__screens__/cameras/<width>-<id>.png`;
  - the choice is saved, and comes back on the next open;
  - photo fallback (model 404) shows no chip row;
  - no page errors and no new tabs.
  - `PW_CHROMIUM_PATH` optionally points it at a Chromium binary.

| | main `c025ebd` | This branch |
|---|---|---|
| `npm test` | 440 pass | 450 pass |
| `tests/ground_logos.test.js` | 6 pass | 6 pass (unchanged) |
| `node scripts/build-public.mjs` | ok, 142 files | ok, 143 files (`assets/mcg/cameras.js` ships; nothing from `tests/`) |
| `npm run test:e2e` | 21 pass, 4 fail | 25 pass, the same 4 fail |

The 4 e2e failures happen on main too. The `follower-live` specs override `launchOptions` and launch their own browser build, which this sandbox doesn't have.

**Screenshots** (10 PNGs) were sent with this handoff, plus two contact sheets. The repo's `.gitignore` ignores `*.png`, so they aren't committed, and the spec regenerates them.

## For Brandon or the reviewer to decide
- **Which end is "north"?** I used the −x end of the model as North and +x as South, because the model has no compass. If it's the other way round at the real MCG, swap the two `pos`/`look` pairs in `CAMERAS`.
- **"Wing"** is from the far (−z) side, as the members' side. If the broadcast camera is already on the members' side, move `wing` to +z.
- If Brandon later wants logos to re-pose per camera, `POSE_FOLLOWS_ACTIVE_CAMERA` is the switch. It would also need `corners()` to take the active camera's position, which isn't built.

## Suggested changelog line
"Game view: new camera angles. Switch between Broadcast, Ends (tap again for the other end), Wing and Blimp from the chips on the ground; your pick is remembered."

## Manual check (iPhone, 390px)
Open a game, tap each chip: it should glide in about 0.6 s, with Ends flipping between ends. Reopen the game and your pick should be back. With Reduce Motion on, it should jump. Players should appear only on Broadcast. A device without WebGL shows the photo with no chips.
