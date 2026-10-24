/* Racecourse for Game view (generic, Flemington-style; no club or race marks). Ported
   from the 3D models pack (procedural-venues/racecourse, three.js MIT). The low-poly
   horses with plain silks are part of the venue, not the player models. Handle
   contract: see ./kit.js.

   Elliptical turf track (260 x 110 m semi-axes, 24 m wide) with white rails, the
   grandstand along the home straight (+z), a roof, and LED ribbons on the straight
   and the inner rail. Eight horses gallop round. */
import * as T from "../vendor/three/three.module.min.js";
import { box, mat, ellPath, crowdMat, facadeMat, ledRibbons, rng, mountVenue } from "./kit.js";

export var VENUE = "racecourse";
export var FALLBACK_URL = new URL("./racecourse-fallback.png", import.meta.url).href;
var A = 260, B = 110, WD = 24;
// Floor logos sit in the infield, inside the inner rail.
export var INFIELD = {w: 380, d: 150};
export var RACECOURSE_CAMERAS = [
  {id: "broadcast", label: "Grandstand", fov: 46, pos: [70, 18, 70], look: [0, 2, 110], minAspect: 1.3},
  {id: "goals-north", label: "Turn", fov: 50, pos: [-150, 30, 60], look: [-250, 0, 0], minAspect: 1.3},
  {id: "goals-south", label: "Turn", fov: 50, pos: [150, 30, 60], look: [250, 0, 0], minAspect: 1.3},
  {id: "wing", label: "Back straight", fov: 46, pos: [0, 30, -40], look: [0, 2, -110], minAspect: 1.3},
  {id: "blimp", label: "Blimp", fov: 50, pos: [0, 330, 210], look: [0, 0, 0], minAspect: 1.3}
];
export var RACECOURSE_CHIPS = {ends: "Turn", blimp: "Blimp"};
var SILKS = [0xc8202f, 0x1f4fbf, 0xf2c230, 0x13804a, 0xf07a1a, 0x7b3fbf, 0xffffff, 0x111111];
var COATS = [0x6b3e1f, 0x3b2416, 0x8a5a30, 0x222222];

function ringShape(a, b) {
  var sh = new T.Shape();
  ellPath(a + WD / 2, b + WD / 2, 128).forEach(function (v, i) { if (i) sh.lineTo(v[0], v[1]); else sh.moveTo(v[0], v[1]); });
  var hole = new T.Path();
  ellPath(a - WD / 2, b - WD / 2, 128).forEach(function (v, i) { if (i) hole.lineTo(v[0], v[1]); else hole.moveTo(v[0], v[1]); });
  sh.holes.push(hole);
  return sh;
}

// Low-poly horse with jockey silks.
function horse(silk, coat) {
  var g = new T.Group(), c = mat(coat);
  var body = new T.Mesh(new T.BoxGeometry(0.9, 0.9, 2.2), c); body.position.y = 1.6; g.add(body);
  var neck = new T.Mesh(new T.BoxGeometry(0.45, 1.1, 0.5), c); neck.position.set(0, 2.15, 1.15); neck.rotation.x = 0.6; g.add(neck);
  var head = new T.Mesh(new T.BoxGeometry(0.35, 0.4, 0.85), c); head.position.set(0, 2.6, 1.6); head.rotation.x = 0.3; g.add(head);
  var legs = [];
  [[-0.3, 0.85], [0.3, 0.85], [-0.3, -0.85], [0.3, -0.85]].forEach(function (p) {
    var pv = new T.Group(); pv.position.set(p[0], 1.25, p[1]);
    var l = new T.Mesh(new T.BoxGeometry(0.16, 1.25, 0.16), c); l.position.y = -0.62; pv.add(l);
    g.add(pv); legs.push(pv);
  });
  var jockey = new T.Mesh(new T.BoxGeometry(0.5, 0.6, 0.5), mat(silk)); jockey.position.set(0, 2.3, 0.2); jockey.rotation.x = 0.7; g.add(jockey);
  var cap = new T.Mesh(new T.SphereGeometry(0.17, 8, 6), mat(silk)); cap.position.set(0, 2.65, 0.55); g.add(cap);
  g.userData.legs = legs;
  g.userData.body = body;
  g.scale.setScalar(1.6);
  return g;
}

export async function buildRacecourse(scene, opts) {
  opts = opts || {};
  box(scene, 700, 0.2, 400, 0x2f5b2c, 0, -0.1, 0);
  var track = new T.Mesh(new T.ShapeGeometry(ringShape(A, B)), mat(0x5aa04d, {side: T.DoubleSide}));
  track.rotation.x = Math.PI / 2;
  track.position.y = 0.02;
  scene.add(track);
  var rail = mat(0xffffff);
  [-WD / 2, WD / 2].forEach(function (off) {
    var pts = ellPath(A + off, B + off, 160).map(function (v) { return new T.Vector3(v[0], 1.1, v[1]); });
    scene.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 320, 0.12, 5, true), rail));
  });
  // Grandstand along the home straight.
  var seats = crowdMat(18);
  for (var k = 0; k < 14; k++) box(scene, 220, 0.8, 1.6, seats, 0, 0.4 + k * 0.8, B + WD / 2 + 10 + k * 1.6);
  var zBack = B + WD / 2 + 10 + 14 * 1.6;
  var back = new T.Mesh(new T.BoxGeometry(222, 12, 0.4), facadeMat());
  back.position.set(0, 6, zBack);
  scene.add(back);
  [-1, 1].forEach(function (sx) {
    var endShape = new T.Shape([new T.Vector2(-0.8, 0), new T.Vector2(14 * 1.6, 0), new T.Vector2(14 * 1.6, 12), new T.Vector2(-0.8, 1.2)]);
    var fm = facadeMat();
    fm.side = T.DoubleSide;
    var end = new T.Mesh(new T.ShapeGeometry(endShape), fm);
    end.rotation.y = -Math.PI / 2;
    end.position.set(sx * 111, 0, B + WD / 2 + 10);
    scene.add(end);
  });
  box(scene, 230, 1, 26, 0xe9ecef, 0, 13.5, B + WD / 2 + 20);
  var led = null;
  try {
    led = await ledRibbons(scene, [
      {pts: [[-110, B + WD / 2 + 3], [110, B + WD / 2 + 3]], y: 0.3, h: 2.2},
      {pts: ellPath(A - WD / 2 - 1, B - WD / 2 - 1, 160), y: 0, h: 0.7, closed: true}
    ], false, opts.boardsUrl);
  } catch (e) { led = null; }
  var r = rng(11);
  var field = SILKS.map(function (silk, i) {
    var h = horse(silk, COATS[(r() * COATS.length) | 0]);
    scene.add(h);
    return {h: h, lane: (i % 4 - 1.5) * 4, ph: -i * 0.012 - (i > 3 ? 0.006 : 0), sp: 0.022 + r() * 0.002};
  });
  var t = 0;
  function update(dt) {
    t += dt;
    field.forEach(function (o) {
      o.ph += o.sp * dt;
      var a = o.ph * Math.PI * 2 + Math.PI / 2;
      var x = Math.cos(a) * (A + o.lane), z = Math.sin(a) * (B + o.lane);
      var dx = -Math.sin(a) * (A + o.lane), dz = Math.cos(a) * (B + o.lane);
      o.h.position.set(x, 0, z);
      o.h.rotation.y = Math.atan2(dx, dz);
      var g = t * 11 + o.lane;
      o.h.userData.legs.forEach(function (L, k) { L.rotation.x = Math.sin(g + [0, 0.5, Math.PI, Math.PI + 0.5][k]) * 0.8; });
      o.h.userData.body.position.y = 1.6 + Math.abs(Math.sin(g)) * 0.12;
    });
  }
  update(0);
  return {led: led, update: update};
}

export var DEF = {venue: VENUE, fallbackUrl: FALLBACK_URL, cameras: RACECOURSE_CAMERAS, chips: RACECOURSE_CHIPS,
  field: INFIELD, outdoor: true, far: 1600, build: buildRacecourse};

export function mount(host, opts) {
  return mountVenue(host, opts, DEF);
}
