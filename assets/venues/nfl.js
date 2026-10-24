/* NFL-style stadium for Game view (generic, no team or league marks). Ported from the
   3D models pack (procedural-venues/nfl, three.js MIT); no player models. Handle
   contract: see ./kit.js.

   Field 109.7 x 48.8 m (painted 114 x 53) centred on the origin, long axis along x:
   yard lines every 5, numbers every 10, coloured end zones, Y posts at x = +/-55 m.
   A deep bowl of stands and two LED rings. */
import { box, mat, canvasPlane, standRect, ledRibbons, rectPath, mountVenue } from "./kit.js";

export var VENUE = "nfl";
export var FALLBACK_URL = new URL("./nfl-fallback.png", import.meta.url).href;
export var FIELD = {w: 110, d: 49};
// Inside the bowl (|x| < 85, |z| < 57) except the overhead.
export var NFL_CAMERAS = [
  {id: "broadcast", label: "Broadcast", fov: 62, pos: [0, 34, 46], look: [0, 0, 6], minAspect: 1.4},
  {id: "goals-north", label: "End zone", fov: 46, pos: [-80, 20, 0], look: [-15, 0, 0], minAspect: 1.3},
  {id: "goals-south", label: "End zone", fov: 46, pos: [80, 20, 0], look: [15, 0, 0], minAspect: 1.3},
  {id: "wing", label: "Wing", fov: 46, pos: [-40, 25, -50], look: [4, 0, 3], minAspect: 1.3},
  {id: "blimp", label: "Blimp", fov: 50, pos: [0, 120, 60], look: [0, 0, 0], minAspect: 1.4}
];
export var NFL_CHIPS = {ends: "End zone", blimp: "Blimp"};

function drawField(x, p, W, H) {
  x.fillStyle = "#3f8a3a";
  x.fillRect(0, 0, W, H);
  var o = 2.2 * p, fl = W - 2 * o;
  x.fillStyle = "#24456e"; x.fillRect(o, o, 9.14 * p, H - 2 * o);
  x.fillStyle = "#7a1f2b"; x.fillRect(W - o - 9.14 * p, o, 9.14 * p, H - 2 * o);
  x.strokeStyle = "#fff";
  x.lineWidth = 0.15 * p;
  x.strokeRect(o, o, fl, H - 2 * o);
  for (var y = 0; y <= 100; y += 5) {
    var px = o + 9.14 * p + y * 0.9144 * p;
    x.beginPath(); x.moveTo(px, o); x.lineTo(px, H - o); x.stroke();
  }
  x.fillStyle = "#fff";
  x.font = "bold " + (2 * p) + "px sans-serif";
  x.textAlign = "center";
  for (var yy = 10; yy < 100; yy += 10) {
    var n = yy <= 50 ? yy : 100 - yy, qx = o + 9.14 * p + yy * 0.9144 * p;
    x.fillText(String(n), qx, o + 9 * p);
    x.fillText(String(n), qx, H - o - 7 * p);
  }
}

export async function buildNfl(scene, opts) {
  opts = opts || {};
  box(scene, 180, 0.2, 110, 0x2f5b2c, 0, -0.1, 0);
  canvasPlane(scene, 114, 53, drawField, 10, 0.01);
  var y = mat(0xf2d230);
  for (var s = -1; s <= 1; s += 2) {
    box(scene, 0.2, 3, 0.2, y, s * 55, 1.5, 0);
    box(scene, 0.2, 0.2, 5.6, y, s * 55, 3.05, 0);
    box(scene, 0.15, 9, 0.15, y, s * 55, 7.5, -2.8);
    box(scene, 0.15, 9, 0.15, y, s * 55, 7.5, 2.8);
  }
  standRect(scene, {w: 122, d: 66, gap: 2, rows: 22, rowH: 0.75, rowD: 1.0, y0: 0.5});
  var led = null;
  try {
    led = await ledRibbons(scene, [
      {pts: rectPath(124, 68), y: 0, h: 1.2, closed: true},
      {pts: rectPath(124 + 44, 68 + 44), y: 12.2, h: 1.6, closed: true}
    ], false, opts.boardsUrl);
  } catch (e) { led = null; }
  return {led: led};
}

export var DEF = {venue: VENUE, fallbackUrl: FALLBACK_URL, cameras: NFL_CAMERAS, chips: NFL_CHIPS,
  field: FIELD, outdoor: true, far: 800, build: buildNfl};

export function mount(host, opts) {
  return mountVenue(host, opts, DEF);
}
