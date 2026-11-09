/* Racecourse for Game view. Handle contract: see ./kit.js.

   Two tracks:
   - generic (any meeting without a course model): the elliptical turf track
     (260 x 110 m semi-axes, 24 m wide) with white rails, the grandstand along the home
     straight (+z), LED ribbons and the follower billboards (./billboards/).
   - named (opts.course = "flemington" | "caulfield" | "moonee-valley" |
     "sandown-hillside"): Cinna's course model (./racecourses/<id>.glb, meshopt) and its
     definition (./racecourses/courses/<id>.json), fitted into the same frame so the
     stand, cameras and still are shared. No billboards on named courses.
   If a course fails to load, the generic track is built instead.

   The field (opts.field, from assets/racing-track.js fieldFromEvent) parades at a
   canter before the jump, in barrier order; the tipped runner carries a marker.
   handle.setField(field) swaps the field in place (a scratching removes its horse).
   Horses are code-built boxes on shared, instanced geometry. Each horse's rider comes
   from makeRider(runner): a box jockey in the runner's colour or silk now, or Cinna's
   jockey GLB (root "Jockey", material "Silk", clips ride_gallop / ride_idle) once
   RIDER.url is set. Silk images arrive through opts.silkLoader(url) -> Promise<Blob>
   (TipBot's /api/racing/silk proxy; the silk CDN has no CORS). */
import * as T from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/three/addons/libs/meshopt_decoder.module.js";
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
export var COURSES = ["flemington", "caulfield", "moonee-valley", "sandown-hillside"];
// Cinna's jockey (assets/venues/riders/jockey.glb + jockey-lod1.glb). Empty until the
// files land: set url / lod1Url then, and seat / scale from her SPEC.md. opts.rider
// overrides any field for one mount.
export var RIDER = {url: "", lod1Url: "", seat: [0, 2.3, 0.2], scale: 1, lod1Above: 12};
var DEMO_SILKS = [0xc8202f, 0x1f4fbf, 0xf2c230, 0x13804a, 0xf07a1a, 0x7b3fbf, 0xffffff, 0x111111];
var COATS = [0x6b3e1f, 0x3b2416, 0x8a5a30, 0x222222];
var ACCENT = 0x5b8cff;
// The fitted frame: a named course is scaled into this box with its outer rail at the
// home straight on z = B + WD / 2, where the generic track's outer rail sits.
var FIT_W = 520, FIT_D = 232, OUTER_Z = B + WD / 2;
var CANTER = 9;        // world m/s before the jump
var GAP = 7;           // metres between horses in the string

function ringShape(a, b) {
  var sh = new T.Shape();
  ellPath(a + WD / 2, b + WD / 2, 128).forEach(function (v, i) { if (i) sh.lineTo(v[0], v[1]); else sh.moveTo(v[0], v[1]); });
  var hole = new T.Path();
  ellPath(a - WD / 2, b - WD / 2, 128).forEach(function (v, i) { if (i) hole.lineTo(v[0], v[1]); else hole.moveTo(v[0], v[1]); });
  sh.holes.push(hole);
  return sh;
}

/* ---------- path along the inside rail (world metres) ---------- */
export function makePath(points, outward, width) {
  var cum = [0];
  for (var i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  var len = cum[cum.length - 1] || 1;
  function at(s) {
    s = ((s % len) + len) % len;
    var lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    var a = points[lo], b = points[lo + 1] || points[0], seg = (cum[lo + 1] - cum[lo]) || 1, t = (s - cum[lo]) / seg;
    var tx = (b[0] - a[0]) / seg, tz = (b[1] - a[1]) / seg;
    return {x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: tx, tz: tz};
  }
  return {len: len, width: width, at: at,
    // Point ``lat`` metres out from the inside rail at arc position s, and the heading.
    place: function (s, lat) {
      var p = at(s), nx = -p.tz * outward, nz = p.tx * outward;
      return {x: p.x + nx * lat, z: p.z + nz * lat, yaw: Math.atan2(p.tx, p.tz)};
    }};
}

function genericPath() {
  var pts = ellPath(A - WD / 2, B - WD / 2, 256);
  pts.push(pts[0].slice());
  // ellPath runs with the angle; its right-hand normal points inwards, so flip it.
  return makePath(pts, -1, WD);
}

/** Fit a course definition (metres, post at the origin, +x the running direction at the
    post, infield at -z) into the shared frame. Pure; returns {s, dx, dz}. */
export function courseFit(def) {
  var pts = def.main.points, minX = Infinity, maxX = -Infinity, minZ = Infinity;
  pts.forEach(function (p) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minZ) minZ = p[1]; });
  var outer = (def.width_m || 30) - (def.measure_offset_m || 0);
  var w = maxX - minX + 2 * outer, d = outer - minZ + outer;
  var s = Math.min(FIT_W / w, FIT_D / d);
  return {s: s, dx: -(minX + maxX) / 2, dz: -outer, outerZ: OUTER_Z};
}
function fitPoint(fit, x, z) { return [(x + fit.dx) * fit.s, OUTER_Z + (z + fit.dz) * fit.s]; }

function coursePath(def, fit) {
  var sign = def.direction === "clockwise" ? -1 : 1;
  var off = -(def.measure_offset_m || 0) * fit.s;   // measured line -> inside rail
  var raw = def.main.points.map(function (p) { return fitPoint(fit, p[0], p[1]); });
  // Shift the measured line onto the inside rail so lateral 0 is the rail.
  var rail = raw.map(function (p, i) {
    var a = raw[Math.max(0, i - 1)], b = raw[Math.min(raw.length - 1, i + 1)];
    var tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
    return [p[0] + (-tz / L) * sign * off, p[1] + (tx / L) * sign * off];
  });
  return makePath(rail, sign, (def.width_m || 30) * fit.s);
}

/* ---------- horses (instanced) ---------- */
var PARTS = [
  {key: "body", geo: [0.9, 0.9, 2.2], at: [0, 1.6, 0], rx: 0},
  {key: "neck", geo: [0.45, 1.1, 0.5], at: [0, 2.15, 1.15], rx: 0.6},
  {key: "head", geo: [0.35, 0.4, 0.85], at: [0, 2.6, 1.6], rx: 0.3}
];
var LEGS = [[-0.3, 0.85], [0.3, 0.85], [-0.3, -0.85], [0.3, -0.85]];
var PHASE = [0, 0.5, Math.PI, Math.PI + 0.5];

function herd(scene, n, scale) {
  var coat = new T.MeshStandardMaterial({color: 0xffffff, roughness: 0.8});
  var meshes = {}, r = rng(11);
  PARTS.forEach(function (p) {
    var m = new T.InstancedMesh(new T.BoxGeometry(p.geo[0], p.geo[1], p.geo[2]), coat, Math.max(1, n));
    m.count = n; m.frustumCulled = false; meshes[p.key] = m; scene.add(m);
  });
  var legGeo = new T.BoxGeometry(0.16, 1.25, 0.16);
  legGeo.translate(0, -0.62, 0);
  var legs = new T.InstancedMesh(legGeo, coat, Math.max(1, n * 4));
  legs.count = n * 4; legs.frustumCulled = false; scene.add(legs);
  var c = new T.Color();
  for (var i = 0; i < n; i++) {
    c.setHex(COATS[(r() * COATS.length) | 0]);
    PARTS.forEach(function (p) { meshes[p.key].setColorAt(i, c); });
    for (var k = 0; k < 4; k++) legs.setColorAt(i * 4 + k, c);
  }
  PARTS.forEach(function (p) { if (meshes[p.key].instanceColor) meshes[p.key].instanceColor.needsUpdate = true; });
  if (legs.instanceColor) legs.instanceColor.needsUpdate = true;
  var root = new T.Matrix4(), local = new T.Matrix4(), out = new T.Matrix4(), q = new T.Quaternion(), e = new T.Euler(), v = new T.Vector3(), one = new T.Vector3(1, 1, 1), sc = new T.Vector3(scale, scale, scale);
  return {
    set: function (i, x, z, yaw, bob, stride) {
      e.set(0, yaw, 0); q.setFromEuler(e);
      root.compose(v.set(x, 0, z), q, sc);
      PARTS.forEach(function (p) {
        e.set(p.rx, 0, 0); q.setFromEuler(e);
        local.compose(v.set(p.at[0], p.at[1] + (p.key === "body" ? bob : bob * 0.6), p.at[2]), q, one);
        meshes[p.key].setMatrixAt(i, out.multiplyMatrices(root, local));
      });
      for (var k = 0; k < 4; k++) {
        e.set(Math.sin(stride + PHASE[k]) * 0.8, 0, 0); q.setFromEuler(e);
        local.compose(v.set(LEGS[k][0], 1.25, LEGS[k][1]), q, one);
        legs.setMatrixAt(i * 4 + k, out.multiplyMatrices(root, local));
      }
    },
    flush: function () {
      PARTS.forEach(function (p) { meshes[p.key].instanceMatrix.needsUpdate = true; });
      legs.instanceMatrix.needsUpdate = true;
    },
    dispose: function () {
      PARTS.forEach(function (p) { scene.remove(meshes[p.key]); meshes[p.key].geometry.dispose(); meshes[p.key].dispose(); });
      scene.remove(legs); legs.geometry.dispose(); legs.dispose(); coat.dispose();
    }
  };
}

/* ---------- riders ---------- */
var shared = null;
function sharedRiderGeo() {
  if (!shared) shared = {torso: new T.BoxGeometry(0.5, 0.6, 0.5), cap: new T.SphereGeometry(0.17, 8, 6)};
  return shared;
}

// Silk icon -> canvas texture on the runner's colour (the icons are transparent round the jacket).
function silkTexture(blob, colour, flipY) {
  if (!blob || typeof createImageBitmap !== "function") return Promise.resolve(null);
  return createImageBitmap(blob).then(function (bmp) {
    var c = document.createElement("canvas");
    c.width = 128; c.height = 128;
    var x = c.getContext("2d");
    x.fillStyle = colour || "#ffffff";
    x.fillRect(0, 0, 128, 128);
    x.drawImage(bmp, 0, 0, 128, 128);
    try { bmp.close(); } catch (e) {}
    var t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.flipY = !!flipY;
    t.anisotropy = 4;
    return t;
  }).catch(function () { return null; });
}

/** The default rider: a box jockey with a cap, flat in the runner's colour; setSilk(tex)
    puts the silk icon on the jacket and cap. */
export function boxRider(runner) {
  var g = sharedRiderGeo();
  var silk = new T.MeshStandardMaterial({color: new T.Color(runner && runner.colour || "#c8202f"), roughness: 0.6});
  var obj = new T.Group();
  var torso = new T.Mesh(g.torso, silk); torso.position.set(0, 2.3, 0.2); torso.rotation.x = 0.7; obj.add(torso);
  var cap = new T.Mesh(g.cap, silk); cap.position.set(0, 2.65, 0.55); obj.add(cap);
  return {obj: obj, flipY: true, material: silk,
    setSilk: function (tex) { if (!tex) return; silk.map = tex; silk.color.set(0xffffff); silk.needsUpdate = true; },
    update: function () {},
    dispose: function () { if (silk.map) silk.map.dispose(); silk.dispose(); }};
}

/** Find the material called ``name`` on a model (the jockey's "Silk"). */
export function findMaterial(rootObj, name) {
  var hit = null;
  rootObj.traverse(function (n) {
    if (hit || !n.isMesh) return;
    (Array.isArray(n.material) ? n.material : [n.material]).forEach(function (m) { if (!hit && m && m.name === name) hit = m; });
  });
  return hit;
}

var riderCache = {};
function loadRiderModel(url) {
  if (!url) return Promise.resolve(null);
  if (!riderCache[url]) {
    riderCache[url] = Promise.resolve(MeshoptDecoder && MeshoptDecoder.ready).then(function () {
      var loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      return loader.loadAsync(url);
    }).then(function (gltf) {
      return import("../vendor/three/addons/utils/SkeletonUtils.js").then(function (SU) { return {gltf: gltf, SU: SU}; });
    }).catch(function () { return null; });
  }
  return riderCache[url];
}

function gltfRider(model, runner, cfg) {
  var src = model.gltf.scene.getObjectByName("Jockey") || model.gltf.scene;
  var obj = model.SU.clone(src);
  var seat = new T.Group();
  seat.position.fromArray(cfg.seat || RIDER.seat);
  seat.scale.setScalar(cfg.scale || 1);
  seat.add(obj);
  var base = findMaterial(obj, "Silk");
  var silk = base ? base.clone() : null;
  if (silk) {
    obj.traverse(function (n) {
      if (!n.isMesh) return;
      if (Array.isArray(n.material)) n.material = n.material.map(function (m) { return m && m.name === "Silk" ? silk : m; });
      else if (n.material && n.material.name === "Silk") n.material = silk;
    });
    silk.map = null;
    silk.color = new T.Color(runner && runner.colour || "#ffffff");
  }
  var mixer = new T.AnimationMixer(obj), clips = model.gltf.animations || [];
  var gallop = T.AnimationClip.findByName(clips, "ride_gallop");
  var idle = T.AnimationClip.findByName(clips, "ride_idle");
  var act = gallop || idle;
  if (act) mixer.clipAction(act).play();
  return {obj: seat, flipY: false, material: silk,
    setSilk: function (tex) { if (!tex || !silk) return; silk.map = tex; silk.color.set(0xffffff); silk.needsUpdate = true; },
    update: function (dt) { mixer.update(dt); },
    dispose: function () { mixer.stopAllAction(); if (silk) { if (silk.map) silk.map.dispose(); silk.dispose(); } }};
}

/** One rider per runner. Cinna's jockey when RIDER.url (or opts.rider.url) loads, else
    the box jockey. Returns a Promise so the caller never waits on a missing file. */
export function makeRider(runner, opts) {
  var cfg = Object.assign({}, RIDER, (opts && opts.rider) || {});
  var count = (opts && opts.count) || 0;
  var url = cfg.lod1Url && count > cfg.lod1Above ? cfg.lod1Url : cfg.url;
  return loadRiderModel(url).then(function (model) {
    if (model) { try { return gltfRider(model, runner, cfg); } catch (e) {} }
    return boxRider(runner);
  });
}

/* ---------- the field ---------- */
function demoField() {
  return DEMO_SILKS.map(function (c, i) {
    return {number: i + 1, name: "", barrier: i + 1, colour: "#" + new T.Color(c).getHexString(), silk_url: "", tipped: false};
  });
}

function Field(scene, path, opts) {
  var horses = null, riders = [], markers = [], runners = [], lead = path.len * 0.15, t = 0, gen = 0;
  var scale = opts.horseScale || 1.6;
  var markerGeo = new T.ConeGeometry(0.9, 1.8, 10), markerMat = new T.MeshBasicMaterial({color: ACCENT});
  markerGeo.rotateX(Math.PI);
  function clear() {
    if (horses) horses.dispose();
    horses = null;
    riders.forEach(function (r) { if (r) { scene.remove(r.obj); r.dispose(); } });
    markers.forEach(function (m) { scene.remove(m); });
    riders = []; markers = [];
  }
  function set(list) {
    gen++;
    var my = gen;
    clear();
    runners = (list && list.length ? list : demoField()).slice(0, 24);
    horses = herd(scene, runners.length, scale);
    runners.forEach(function (rn, i) {
      riders.push(null);
      if (rn.tipped) {
        var mk = new T.Mesh(markerGeo, markerMat);
        mk.userData.i = i;
        scene.add(mk); markers.push(mk);
      }
      makeRider(rn, {rider: opts.rider, count: runners.length}).then(function (rider) {
        if (my !== gen) { rider.dispose(); return; }
        rider.obj.scale.multiplyScalar(scale);
        scene.add(rider.obj);
        riders[i] = rider;
        if (rn.silk_url && opts.silkLoader) {
          Promise.resolve(opts.silkLoader(rn.silk_url)).then(function (blob) {
            return silkTexture(blob, rn.colour, rider.flipY);
          }).then(function (tex) {
            if (my !== gen || !tex) { if (tex) tex.dispose(); return; }
            rider.setSilk(tex);
            if (opts.onChange) opts.onChange();
          }).catch(function () {});
        }
        if (opts.onChange) opts.onChange();
      });
    });
    update(0);
  }
  function update(dt) {
    if (!horses) return;
    t += dt;
    lead += CANTER * dt;
    var lanes = [0.22, 0.48, 0.74];
    runners.forEach(function (rn, i) {
      var s = lead - i * GAP * 0.8;
      var lat = path.width * lanes[i % 3];
      var p = path.place(s, lat);
      var stride = t * 7 + i * 0.7;
      var bob = Math.abs(Math.sin(stride)) * 0.1;
      horses.set(i, p.x, p.z, p.yaw, bob, stride);
      var r = riders[i];
      if (r) {
        r.obj.position.set(p.x, bob * scale, p.z);
        r.obj.rotation.set(0, p.yaw, 0);
        r.update(dt);
      }
      runners[i]._p = p;
    });
    markers.forEach(function (m) {
      var p = runners[m.userData.i]._p;
      m.position.set(p.x, 7.5 * scale / 1.6 + Math.sin(t * 3) * 0.4, p.z);
    });
    horses.flush();
  }
  return {set: set, update: update, count: function () { return runners.length; },
    dispose: function () { clear(); markerGeo.dispose(); markerMat.dispose(); }};
}

/* ---------- scene ---------- */
function stand(scene) {
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
}

function genericTrack(scene) {
  var track = new T.Mesh(new T.ShapeGeometry(ringShape(A, B)), mat(0x5aa04d, {side: T.DoubleSide}));
  track.rotation.x = Math.PI / 2;
  track.position.y = 0.02;
  scene.add(track);
  var rail = mat(0xffffff);
  [-WD / 2, WD / 2].forEach(function (off) {
    var pts = ellPath(A + off, B + off, 160).map(function (v) { return new T.Vector3(v[0], 1.1, v[1]); });
    scene.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts, true), 320, 0.12, 5, true), rail));
  });
}

async function namedTrack(scene, id, opts) {
  var base = opts.courseBase || new URL("./racecourses/", import.meta.url).href;
  var defRes = await fetch(new URL("courses/" + id + ".json", base).href);
  if (!defRes.ok) throw new Error("course json");
  var def = await defRes.json();
  if (MeshoptDecoder && MeshoptDecoder.ready) await MeshoptDecoder.ready;
  var loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  var gltf = await loader.loadAsync(new URL(id + ".glb", base).href);
  var fit = courseFit(def);
  var g = gltf.scene;
  g.scale.setScalar(fit.s);
  g.position.set(fit.dx * fit.s, 0.03, OUTER_Z + fit.dz * fit.s);
  // The course's own terrain would cover the shared ground; keep it under the track.
  g.traverse(function (n) { if (n.isMesh) n.frustumCulled = true; });
  scene.add(g);
  return {path: coursePath(def, fit), def: def, fit: fit};
}

async function addBillboards(scene, base) {
  var res = await fetch(new URL("placements.json", base).href);
  if (!res.ok) return;
  var placements = (await res.json()).placements || [];
  var loader = new GLTFLoader(), cache = {};
  for (var i = 0; i < placements.length; i++) {
    var p = placements[i], key = String(p.glb || "").split("/").pop();
    if (!key) continue;
    cache[key] = cache[key] || loader.loadAsync(new URL("glb/" + key, base).href);
    var obj = (await cache[key]).scene.clone(true);
    obj.name = p.name;
    obj.position.fromArray(p.position);
    obj.rotation.y = p.rotationY;
    obj.scale.setScalar(p.scale);
    obj.traverse(function (n) {
      if (n.isMesh && /^SponsorPatch/.test(n.name)) {
        n.material = n.material.clone();
        n.material.map = null;           // published view: plain panel until the studio sends a sponsor
        n.material.color && n.material.color.set(0xf4f6fa);
        n.material.needsUpdate = true;
      }
    });
    scene.add(obj);
  }
}

export async function buildRacecourse(scene, opts) {
  opts = opts || {};
  box(scene, 700, 0.2, 400, 0x2f5b2c, 0, -0.1, 0);
  var path = null, course = "";
  var want = COURSES.indexOf(opts.course) >= 0 ? opts.course : "";
  if (want) {
    try {
      var named = await namedTrack(scene, want, opts);
      path = named.path; course = want;
    } catch (e) { path = null; course = ""; }
  }
  if (!path) { genericTrack(scene); path = genericPath(); }
  stand(scene);
  var led = null;
  try {
    var ribbons = [{pts: [[-110, B + WD / 2 + 3], [110, B + WD / 2 + 3]], y: 0.3, h: 2.2}];
    if (!course) ribbons.push({pts: ellPath(A - WD / 2 - 1, B - WD / 2 - 1, 160), y: 0, h: 0.7, closed: true});
    led = await ledRibbons(scene, ribbons, false, opts.boardsUrl);
  } catch (e) { led = null; }
  if (!course && opts.billboards !== false) {
    try { await addBillboards(scene, opts.billboardsBase || new URL("./billboards/", import.meta.url).href); } catch (e) {}
  }
  var field = Field(scene, path, {silkLoader: opts.silkLoader, rider: opts.rider, onChange: opts.onChange,
    horseScale: course ? 1.3 : 1.6});
  field.set(opts.field || null);
  return {led: led, update: field.update, course: course, path: path,
    setField: function (list) { field.set(list || null); }, fieldCount: field.count,
    dispose: field.dispose};
}

export var DEF = {venue: VENUE, fallbackUrl: FALLBACK_URL, cameras: RACECOURSE_CAMERAS, chips: RACECOURSE_CHIPS,
  field: INFIELD, outdoor: true, far: 1600, build: buildRacecourse};

export function mount(host, opts) {
  return mountVenue(host, opts, DEF);
}
