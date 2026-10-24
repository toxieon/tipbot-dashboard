/* Baseball park for Game view (generic, no club or league marks). Ported from the 3D
   models pack (procedural-venues/baseball, three.js MIT); no player models. Handle
   contract: see ./kit.js.

   Home plate at the origin, first base along +x and third base along +z (90 ft =
   27.4 m bases), dirt infield, mound, foul lines, an outfield fence at 110 m with an
   LED ribbon, and a curved grandstand behind home. */
import * as T from "../vendor/three/three.module.min.js";
import { box, mat, crowdMat, facadeMat, ledRibbons, mountVenue } from "./kit.js";

export var VENUE = "baseball";
export var FALLBACK_URL = new URL("./baseball-fallback.png", import.meta.url).href;
var R = 110;
// Floor logos sit in the outfield grass between the infield and the fence.
export var OUTFIELD = {w: 70, d: 70, x: 52, z: 52};
// Behind home is -x/-z; the outfield is +x/+z.
export var BASEBALL_CAMERAS = [
  {id: "broadcast", label: "Broadcast", fov: 48, pos: [-34, 26, -34], look: [40, 0, 40], minAspect: 1.3},
  {id: "goals-north", label: "1st base", fov: 48, pos: [60, 18, -26], look: [24, 0, 30], minAspect: 1.3},
  {id: "goals-south", label: "3rd base", fov: 48, pos: [-26, 18, 60], look: [30, 0, 24], minAspect: 1.3},
  {id: "wing", label: "Outfield", fov: 46, pos: [96, 24, 96], look: [14, 0, 14], minAspect: 1.3},
  {id: "blimp", label: "Blimp", fov: 50, pos: [-20, 150, -20], look: [45, 0, 45], minAspect: 1.3}
];
export var BASEBALL_CHIPS = {ends: "Base line", blimp: "Blimp"};

export async function buildBaseball(scene, opts) {
  opts = opts || {};
  box(scene, 260, 0.2, 260, 0x2f5b2c, 40, -0.1, 40);
  var fan = new T.Mesh(new T.CircleGeometry(R, 48, -Math.PI / 4, Math.PI / 2), mat(0x4a9a43, {side: T.DoubleSide}));
  fan.rotation.x = Math.PI / 2;
  fan.rotation.z = Math.PI / 4;
  fan.position.y = 0.01;
  scene.add(fan);
  var dirt = new T.Mesh(new T.CircleGeometry(29, 40, 0, Math.PI / 2), mat(0xb5835a, {side: T.DoubleSide}));
  dirt.rotation.x = Math.PI / 2;
  dirt.position.y = 0.02;
  scene.add(dirt);
  var inf = new T.Mesh(new T.PlaneGeometry(23, 23), mat(0x4a9a43));
  inf.rotation.x = -Math.PI / 2;
  inf.position.set(13.7, 0.03, 13.7);
  scene.add(inf);
  [[27.4, 0], [27.4, 27.4], [0, 27.4]].forEach(function (b) { box(scene, 0.6, 0.15, 0.6, 0xffffff, b[0], 0.1, b[1]); });
  box(scene, 0.6, 0.1, 0.6, 0xffffff, 0, 0.1, 0);
  var mound = new T.Mesh(new T.CylinderGeometry(2.7, 2.9, 0.25, 24), mat(0xb5835a));
  mound.position.set(13.7, 0.1, 13.7);
  scene.add(mound);
  var lineM = mat(0xffffff);
  [0, Math.PI / 2].forEach(function (a) {
    var l = new T.Mesh(new T.BoxGeometry(R, 0.05, 0.12), lineM);
    l.position.set(Math.cos(a) * R / 2, 0.05, Math.sin(a) * R / 2);
    l.rotation.y = -a;
    scene.add(l);
  });
  var fence = new T.Mesh(new T.CylinderGeometry(R, R, 3, 48, 1, true, 0, Math.PI / 2), mat(0x1f4f3a, {side: T.DoubleSide}));
  fence.position.y = 1.5;
  fence.rotation.y = Math.PI / 2;
  scene.add(fence);
  // Grandstand behind home: 14 stepped rows on an arc, then a curved facade.
  var stand = new T.Group(), seats = crowdMat(2);
  for (var k = 0; k < 14; k++) {
    var rr = 23 + k * 1.2;
    for (var j = 0; j < 24; j++) {
      var ang = Math.PI * 1.25 - Math.PI / 3 + (j + 0.5) / 24 * (Math.PI * 2 / 3);
      var m = new T.Mesh(new T.BoxGeometry(rr * (Math.PI * 2 / 3) / 24 + 0.1, 0.7, 1.2), seats);
      m.position.set(Math.cos(ang) * rr, 0.35 + k * 0.7, Math.sin(ang) * rr);
      m.rotation.y = -ang + Math.PI / 2;
      stand.add(m);
    }
  }
  scene.add(stand);
  var Rf = 23 + 14 * 1.2 - 0.45, Hf = 0.35 + 14 * 0.7;
  var fm = facadeMat();
  fm.side = T.DoubleSide;
  var facade = new T.Mesh(new T.CylinderGeometry(Rf, Rf, Hf, 40, 1, true, Math.PI / 2 - (Math.PI * 1.25 + Math.PI / 3), Math.PI * 2 / 3), fm);
  facade.position.y = Hf / 2;
  scene.add(facade);
  var wall = [], behind = [];
  for (var i = 0; i <= 40; i++) {
    var a = i / 40 * Math.PI / 2;
    wall.push([Math.cos(a) * R, Math.sin(a) * R]);
    var b = Math.PI * 1.25 - Math.PI / 3 + i / 40 * (Math.PI * 2 / 3);
    behind.push([Math.cos(b) * 22.2, Math.sin(b) * 22.2]);
  }
  var led = null;
  try { led = await ledRibbons(scene, [{pts: wall, y: 3, h: 1.4}, {pts: behind, y: 0.2, h: 1}], false, opts.boardsUrl); } catch (e) { led = null; }
  return {led: led};
}

export var DEF = {venue: VENUE, fallbackUrl: FALLBACK_URL, cameras: BASEBALL_CAMERAS, chips: BASEBALL_CHIPS,
  field: OUTFIELD, outdoor: true, far: 700, build: buildBaseball};

export function mount(host, opts) {
  return mountVenue(host, opts, DEF);
}
