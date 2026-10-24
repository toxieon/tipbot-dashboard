/* Centre-court tennis arena for Game view (generic blue hard court, no marks). Ported
   from the 3D models pack (procedural-venues/tennis, three.js MIT); no player models.
   Handle contract: see ./kit.js.

   Doubles court 23.77 x 10.97 m (painted surround 36 x 18) centred on the origin, long
   axis along x, net across x = 0. Steep stands and two LED rings. */
import * as T from "../vendor/three/three.module.min.js";
import { box, canvasPlane, standRect, ledRibbons, rectPath, mountVenue } from "./kit.js";

export var VENUE = "tennis";
export var FALLBACK_URL = new URL("./tennis-fallback.png", import.meta.url).href;
export var SURROUND = {w: 34, d: 16};
// Inside the stands (|x| < 37, |z| < 28) except the overhead. Broadcast is end-on, as on TV.
export var TENNIS_CAMERAS = [
  {id: "broadcast", label: "Broadcast", fov: 46, pos: [-30, 13, 0], look: [0, 0, 0], minAspect: 1.2},
  {id: "goals-north", label: "Side", fov: 50, pos: [0, 20, 25], look: [0, 0, 0], minAspect: 1.2},
  {id: "goals-south", label: "Far end", fov: 46, pos: [30, 13, 0], look: [0, 0, 0], minAspect: 1.2},
  {id: "wing", label: "Corner", fov: 48, pos: [-22, 14, -20], look: [0, 0, 0], minAspect: 1.2},
  {id: "blimp", label: "Overhead", fov: 50, pos: [0, 42, 6], look: [0, 0, 0], minAspect: 1.2}
];
export var TENNIS_CHIPS = {ends: "Side", blimp: "Overhead"};

function drawCourt(x, p, W, H) {
  function X(m) { return W / 2 + m * p; }
  function Z(m) { return H / 2 + m * p; }
  x.fillStyle = "#2f6f9e"; x.fillRect(0, 0, W, H);
  x.fillStyle = "#1f4f8a"; x.fillRect(X(-11.885), Z(-5.485), 23.77 * p, 10.97 * p);
  x.strokeStyle = "#fff";
  x.lineWidth = 0.06 * p;
  x.strokeRect(X(-11.885), Z(-5.485), 23.77 * p, 10.97 * p);
  x.strokeRect(X(-11.885), Z(-4.115), 23.77 * p, 8.23 * p);
  x.beginPath();
  x.moveTo(X(-6.4), Z(-4.115)); x.lineTo(X(-6.4), Z(4.115));
  x.moveTo(X(6.4), Z(-4.115)); x.lineTo(X(6.4), Z(4.115));
  x.moveTo(X(-6.4), Z(0)); x.lineTo(X(6.4), Z(0));
  x.stroke();
}

export async function buildTennis(scene, opts) {
  opts = opts || {};
  box(scene, 60, 0.2, 44, 0x2a3442, 0, -0.1, 0);
  canvasPlane(scene, 36, 18, drawCourt, 40, 0.01);
  var net = new T.Mesh(new T.PlaneGeometry(12.8, 0.95),
    new T.MeshStandardMaterial({color: 0x111111, transparent: true, opacity: 0.7, side: T.DoubleSide}));
  net.position.set(0, 0.48, 0);
  net.rotation.y = Math.PI / 2;
  scene.add(net);
  box(scene, 0.05, 0.07, 12.8, 0xffffff, 0, 0.95, 0);
  [-6.4, 6.4].forEach(function (z) { box(scene, 0.1, 1.07, 0.1, 0x333333, 0, 0.53, z); });
  standRect(scene, {w: 36, d: 18, gap: 1, rows: 18, rowH: 0.8, rowD: 1.0, y0: 0.5});
  var led = null;
  try {
    led = await ledRibbons(scene, [
      {pts: rectPath(36, 18), y: 0, h: 0.8, closed: true},
      {pts: rectPath(36 + 2 * 19, 18 + 2 * 19), y: 15.2, h: 1.2, closed: true}
    ], false, opts.boardsUrl);
  } catch (e) { led = null; }
  return {led: led};
}

export var DEF = {venue: VENUE, fallbackUrl: FALLBACK_URL, cameras: TENNIS_CAMERAS, chips: TENNIS_CHIPS,
  field: SURROUND, outdoor: true, far: 300, build: buildTennis};

export function mount(host, opts) {
  return mountVenue(host, opts, DEF);
}
