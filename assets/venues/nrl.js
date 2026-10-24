/* NRL-style rectangular ground for Game view (generic, no club or league marks).
   Ported from the 3D models pack (procedural-venues/nrl, three.js MIT); no player
   models. Handle contract: see ./kit.js.

   100 m field plus in-goals, 68 m wide (painted 124 x 72) centred on the origin, long
   axis along x: league markings every 10 m, dashed 5 m lines, H posts at x = +/-50 m. */
import { box, mat, canvasPlane, standRect, ledRibbons, rectPath, mountVenue } from "./kit.js";

export var VENUE = "nrl";
export var FALLBACK_URL = new URL("./nrl-fallback.png", import.meta.url).href;
export var FIELD = {w: 100, d: 68};
// Inside the stands (|x| < 75, |z| < 49) except the overhead.
export var NRL_CAMERAS = [
  {id: "broadcast", label: "Broadcast", fov: 62, pos: [0, 30, 48], look: [0, 0, 4], minAspect: 1.4},
  {id: "goals-north", label: "End", fov: 48, pos: [-70, 14, 0], look: [-15, 0, 0], minAspect: 1.3},
  {id: "goals-south", label: "End", fov: 48, pos: [70, 14, 0], look: [15, 0, 0], minAspect: 1.3},
  {id: "wing", label: "Wing", fov: 48, pos: [-36, 20, -45], look: [4, 0, 3], minAspect: 1.3},
  {id: "blimp", label: "Blimp", fov: 50, pos: [0, 105, 50], look: [0, 0, 0], minAspect: 1.4}
];
export var NRL_CHIPS = {ends: "End", blimp: "Blimp"};

function drawField(x, p, W, H) {
  for (var i = 0; i < 24; i++) { x.fillStyle = i % 2 ? "#3f8f3a" : "#4a9a43"; x.fillRect(i * W / 24, 0, W / 24, H); }
  var o = 2 * p;
  function X(m) { return W / 2 + m * p; }
  x.strokeStyle = "#fff";
  x.lineWidth = 0.12 * p;
  x.strokeRect(o, o, W - 2 * o, H - 2 * o);
  for (var m = -50; m <= 50; m += 10) {
    x.lineWidth = (m % 50 === 0) ? 0.2 * p : 0.12 * p;
    x.beginPath(); x.moveTo(X(m), o); x.lineTo(X(m), H - o); x.stroke();
  }
  x.setLineDash([1 * p, 1 * p]);
  [-45, -35, -25, -15, -5, 5, 15, 25, 35, 45].forEach(function (d) {
    x.beginPath(); x.moveTo(X(d), o); x.lineTo(X(d), H - o); x.stroke();
  });
  x.setLineDash([]);
  x.fillStyle = "#fff";
  x.font = "bold " + (2.4 * p) + "px sans-serif";
  x.textAlign = "center";
  [-40, -30, -20, -10, 0, 10, 20, 30, 40].forEach(function (d) {
    var n = String(50 - Math.abs(d));
    x.fillText(n, X(d), o + 8 * p);
    x.fillText(n, X(d), H - o - 6 * p);
  });
}

export async function buildNrl(scene, opts) {
  opts = opts || {};
  box(scene, 150, 0.2, 90, 0x2f5b2c, 0, -0.1, 0);
  canvasPlane(scene, 124, 72, drawField, 8, 0.01);
  var white = mat(0xffffff), pad = mat(0x1f4fbf);
  for (var s = -1; s <= 1; s += 2) {
    [-2.8, 2.8].forEach(function (z) {
      box(scene, 0.25, 16, 0.25, white, s * 50, 8, z);
      box(scene, 0.9, 2, 0.9, pad, s * 50, 1, z);
    });
    box(scene, 0.2, 0.2, 5.6, white, s * 50, 3, 0);
  }
  standRect(scene, {w: 124, d: 72, gap: 1, rows: 12, rowH: 0.75, rowD: 1.0, y0: 0.4});
  var led = null;
  try { led = await ledRibbons(scene, [{pts: rectPath(124, 72), y: 0, h: 0.9, closed: true}], false, opts.boardsUrl); } catch (e) { led = null; }
  return {led: led};
}

export var DEF = {venue: VENUE, fallbackUrl: FALLBACK_URL, cameras: NRL_CAMERAS, chips: NRL_CHIPS,
  field: FIELD, outdoor: true, far: 700, build: buildNrl};

export function mount(host, opts) {
  return mountVenue(host, opts, DEF);
}
