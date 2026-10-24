/* Indoor basketball arena for Game view (NBA, WNBA, NBL). Built in code with three.js
   (MIT, vendored), no model file and no league marks. Same handle contract as
   assets/mcg/mount.js (see ./kit.js): mount(host, opts) -> {fallback, cameras, cameraId,
   setCamera, resize, setBoards, setLogos, celebrate, stop}. If WebGL can't start, the
   still (arena-fallback.png, a render from the broadcast camera) stays.

   Court 28 x 15 m centred on the origin, long axis along x, hoops at x = +/-12.8 m
   (rim 3.05 m). Four straight stands, a jumbotron at y 16, four spotlights and LED
   ribbons that play the same slides as the MCG boards. */
import * as T from "../vendor/three/three.module.min.js";
import { mountCameraChips } from "../mcg/cameras.js";
import { box, canvasPlane, rectPath, standRect, ledRibbons, mat, logoScale, logoPlacement, mountVenue } from "./kit.js";
export { mountCameraChips, box, canvasPlane, rectPath, standRect, ledRibbons };

export var VENUE = "arena";
export var FALLBACK_URL = new URL("./arena-fallback.png", import.meta.url).href;

// Court cameras. Ids reuse the MCG chip keys so the chip row works unchanged.
// All inside the stands (|x| < 26, |z| < 21) and under the roof (y < 34).
export var ARENA_CAMERAS = [
  // Broadcast sits inside the upper LED ring (z < 19) so the ribbon isn't in shot.
  {id: "broadcast", label: "Broadcast", fov: 54, pos: [0, 13.5, 17.5], look: [0, 0.6, 0.5], minAspect: 1.4},
  {id: "goals-north", label: "Baseline", fov: 45, pos: [-22, 9, 0], look: [4, 1, 0], minAspect: 1.3},
  {id: "goals-south", label: "Baseline", fov: 45, pos: [22, 9, 0], look: [-4, 1, 0], minAspect: 1.3},
  {id: "wing", label: "Wing", fov: 46, pos: [-9, 12, -17], look: [0, 0, 1.5], minAspect: 1.3},
  // Overhead: high and a little to the side, so the jumbotron (y 13.5-18.5, 8 m square) stays out of shot.
  {id: "blimp", label: "Overhead", fov: 50, pos: [0, 26, 14], look: [0, 0, 1], minAspect: 1.4}
];
export var ARENA_CHIPS = {ends: "Baseline", blimp: "Overhead"};
export var COURT = {w: 28, d: 15, hoopX: 12.8, rimY: 3.05};
// Studio logos are laid out on the AFL oval. On the court the same layout is scaled
// down evenly so every logo keeps its shape and stays on the floor (kit.logoPlacement).
export var COURT_LOGO_SCALE = logoScale(COURT);

/** Court position and size (metres) for one studio logo: {x, z, w, d, rot}. */
export function courtLogoPlacement(logo) {
  return logoPlacement(logo, COURT);
}

function drawCourt(x, p, W, H) {
  x.fillStyle = "#c99a5e";
  x.fillRect(0, 0, W, H);
  var step = p * 0.9;
  for (var i = 0, n = 0; i < W; i += step, n++) {
    x.fillStyle = n % 2 ? "#c4935a" : "#cfa066";
    x.fillRect(i, 0, step, H);
  }
  x.strokeStyle = "#fff";
  x.lineWidth = 0.12 * p;
  x.strokeRect(2, 2, W - 4, H - 4);
  x.beginPath(); x.moveTo(W / 2, 0); x.lineTo(W / 2, H); x.stroke();
  x.beginPath(); x.arc(W / 2, H / 2, 1.8 * p, 0, Math.PI * 2); x.stroke();
  for (var s = 0; s < 2; s++) {
    var bx = s ? W - 2 : 2, dir = s ? -1 : 1;
    var keyX = s ? W - 2 - 5.8 * p : 2;
    x.fillStyle = "rgba(31,79,191,0.85)";
    x.fillRect(keyX, H / 2 - 2.45 * p, 5.8 * p, 4.9 * p);
    x.strokeRect(keyX, H / 2 - 2.45 * p, 5.8 * p, 4.9 * p);
    x.beginPath();
    x.arc(bx + dir * 1.575 * p, H / 2, 6.75 * p, -Math.PI / 2 + 0.06, Math.PI / 2 - 0.06, s === 1);
    x.stroke();
  }
}

/** Builds the arena into a scene. Returns {led} (the ribbon controller). */
export async function buildArena(scene, opts) {
  opts = opts || {};
  box(scene, 60, 0.2, 46, 0x2a2f36, 0, -0.1, 0);
  canvasPlane(scene, COURT.w, COURT.d, drawCourt, opts.ppm || 40, 0.01);
  var glass = new T.MeshStandardMaterial({color: 0xffffff, transparent: true, opacity: 0.6});
  for (var s = -1; s <= 1; s += 2) {
    box(scene, 0.3, 3.05, 0.3, 0x333a44, s * 14.6, 1.5, 0);
    box(scene, 0.05, 1.05, 1.8, glass, s * 13.2, 3.4, 0);
    var rim = new T.Mesh(new T.TorusGeometry(0.23, 0.02, 8, 24), mat(0xf06a1a));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(s * COURT.hoopX, COURT.rimY, 0);
    scene.add(rim);
    box(scene, 1.4, 0.1, 0.1, 0x333a44, s * 13.9, 3.05, 0);
  }
  standRect(scene, {w: 32, d: 19, gap: 2, rows: 16, rowH: 0.75, rowD: 0.95, y0: 0.4});
  box(scene, 8, 5, 8, 0x14181e, 0, 16, 0);
  var led = null;
  try {
    led = await ledRibbons(scene, [
      {pts: rectPath(32, 19), y: 0.05, h: 0.9, closed: true},
      {pts: rectPath(32 + 2 * 9.5, 19 + 2 * 9.5), y: 9.6, h: 1.2, closed: true},
      {pts: rectPath(8.02, 8.02), y: 14.2, h: 1.6, closed: true}
    ], true, opts.boardsUrl);
  } catch (e) {
    led = null;
  }
  [[-10, -10], [10, -10], [-10, 10], [10, 10]].forEach(function (p) {
    var sp = new T.SpotLight(0xfff4e0, 260, 80, 0.6, 0.5, 1.4);
    sp.position.set(p[0], 24, p[1]);
    sp.target.position.set(p[0] * 0.3, 0, p[1] * 0.3);
    scene.add(sp, sp.target);
  });
  return {led: led};
}

export var DEF = {venue: VENUE, fallbackUrl: FALLBACK_URL, cameras: ARENA_CAMERAS, chips: ARENA_CHIPS,
  field: COURT, outdoor: false, far: 400, build: buildArena};

export function mount(host, opts) {
  return mountVenue(host, opts, DEF);
}
