/* Soccer ground for Game view (EPL, A-League and the other soccer competitions).
   Ported from the 3D models pack (procedural-venues/soccer, three.js MIT); no player
   models, no league marks. Handle contract: see ./kit.js.

   Pitch 68 x 45 m (painted 72 x 49 with run-off) centred on the origin, long axis
   along x, goals at x = +/-34 m. Four low stands and an LED ribbon on the boundary. */
import * as T from "../vendor/three/three.module.min.js";
import { box, mat, canvasPlane, standRect, ledRibbons, rectPath, mountVenue } from "./kit.js";

export var VENUE = "soccer";
export var FALLBACK_URL = new URL("./soccer-fallback.png", import.meta.url).href;
export var PITCH = {w: 68, d: 45};
// Inside the stands (|x| < 49, |z| < 38) except the overhead.
export var SOCCER_CAMERAS = [
  {id: "broadcast", label: "Broadcast", fov: 62, pos: [0, 24, 37], look: [0, 0, 4], minAspect: 1.4},
  {id: "goals-north", label: "End", fov: 48, pos: [-46, 11, 0], look: [-8, 0, 0], minAspect: 1.3},
  {id: "goals-south", label: "End", fov: 48, pos: [46, 11, 0], look: [8, 0, 0], minAspect: 1.3},
  {id: "wing", label: "Wing", fov: 48, pos: [-24, 15, -34], look: [2, 0, 2], minAspect: 1.3},
  {id: "blimp", label: "Overhead", fov: 50, pos: [0, 72, 28], look: [0, 0, 0], minAspect: 1.4}
];
export var SOCCER_CHIPS = {ends: "End", blimp: "Overhead"};

function drawPitch(x, p, W, H) {
  for (var i = 0; i < 12; i++) { x.fillStyle = i % 2 ? "#3f8f3a" : "#4a9a43"; x.fillRect(i * W / 12, 0, W / 12, H); }
  x.strokeStyle = "#fff";
  x.lineWidth = 0.12 * p;
  var o = 2 * p;
  x.strokeRect(o, o, W - 2 * o, H - 2 * o);
  x.beginPath(); x.moveTo(W / 2, o); x.lineTo(W / 2, H - o); x.stroke();
  x.beginPath(); x.arc(W / 2, H / 2, 6 * p, 0, Math.PI * 2); x.stroke();
  for (var s = 0; s < 2; s++) {
    x.strokeRect(s ? W - o - 12 * p : o, H / 2 - 15 * p, 12 * p, 30 * p);
    x.strokeRect(s ? W - o - 4 * p : o, H / 2 - 7 * p, 4 * p, 14 * p);
  }
}

export async function buildSoccer(scene, opts) {
  opts = opts || {};
  box(scene, 110, 0.2, 80, 0x2f5b2c, 0, -0.1, 0);
  canvasPlane(scene, 72, 49, drawPitch, 12, 0.01);
  var post = mat(0xffffff), netMat = new T.MeshStandardMaterial({color: 0xffffff, transparent: true, opacity: 0.25});
  for (var s = -1; s <= 1; s += 2) {
    box(scene, 0.12, 2.44, 0.12, post, s * 34, 1.22, -3.66);
    box(scene, 0.12, 2.44, 0.12, post, s * 34, 1.22, 3.66);
    box(scene, 0.12, 0.12, 7.44, post, s * 34, 2.44, 0);
    box(scene, 1.6, 2.4, 7.3, netMat, s * 34.9, 1.2, 0);
  }
  standRect(scene, {w: 80, d: 57, gap: 1, rows: 8, rowH: 0.7, rowD: 1.0, y0: 0.4});
  var led = null;
  try { led = await ledRibbons(scene, [{pts: rectPath(76, 53), y: 0, h: 0.9, closed: true}], false, opts.boardsUrl); } catch (e) { led = null; }
  return {led: led};
}

export var DEF = {venue: VENUE, fallbackUrl: FALLBACK_URL, cameras: SOCCER_CAMERAS, chips: SOCCER_CHIPS,
  field: PITCH, outdoor: true, far: 600, build: buildSoccer};

export function mount(host, opts) {
  return mountVenue(host, opts, DEF);
}
