/* Racecourse for Game view. Handle contract: see ./kit.js.

   Two tracks:
   - generic (any meeting without a course model): the elliptical turf track
     (260 x 110 m semi-axes, 24 m wide) with white rails, the grandstand along the home
     straight (+z), LED ribbons and the follower billboards (./billboards/).
   - named (opts.course = "flemington" | "caulfield" | "moonee-valley" |
     "sandown-hillside"): Cinna's course model (./racecourses/<id>.glb, meshopt) and its
     definition (./racecourses/courses/<id>.json), fitted into the same frame so the
     stand, cameras and still are shared.
   If a course fails to load, the generic track is built instead.

   Billboards (Cinna's racetrack-billboards, ./billboards-lib.js): named courses place
   them with placeBillboards(def, rules) from ./racecourses/billboards.json; the generic
   ellipse uses makeEllipseLoop + placeBillboardsEllipse (same slot ids), plus the
   follower rooftop / infield billboards (./billboards/). handle.setBillboards({course:
   {slot: {url}}}) puts sponsor images (the /api/ground/scene "billboards", as blob URLs)
   on the SponsorPatch* meshes by slot id; an empty slot keeps the plain backing.

   The field (opts.field, from assets/racing-track.js fieldFromEvent) parades at a
   canter before the jump, in barrier order; the tipped runner carries a marker.
   handle.setField(field) swaps the field in place (a scratching removes its horse).
   Horses are code-built boxes on shared, instanced geometry. Each horse's rider comes
   from makeRider(runner): Cinna's jockey GLB (./riders/jockey.glb, LOD1 on phones or
   fields over 8; root "JockeyRoot", material "Silk", clips ride_gallop / ride_idle), seated
   in horse-group space at (0, 2.05, -0.05) x 1.3 with the body bob, its gallop clip
   locked to its own horse's stride (syncGallop). The box jockey is the fallback only
   when the GLB fails to load. Silk images arrive through opts.silkLoader(url) -> Promise<Blob>
   (TipBot's /api/racing/silk proxy; the silk CDN has no CORS). */
import * as T from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/three/addons/libs/meshopt_decoder.module.js";
import { box, mat, ellPath, crowdMat, facadeMat, ledRibbons, rng, mountVenue } from "./kit.js";
import { placeBillboards, makeEllipseLoop, placeBillboardsEllipse, addBillboards as addLibBillboards } from "./billboards-lib.js";
import { syncGallop, FALLBACK_SILK } from "./riders/jockey-silk.js";
import { mergeGeometries } from "../vendor/three/addons/utils/BufferGeometryUtils.js";
import { distanceToWorld, barrierStalls, resolveStart } from "./racecourse-lib.js";
import { racePlan, seedOf } from "./sim-race.js";

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
export var RIDER = {url: new URL("./riders/jockey.glb", import.meta.url).href,
  lod1Url: new URL("./riders/jockey-lod1.glb", import.meta.url).href,
  seat: [0, 2.05, -0.05], scale: 1.3, lod1Above: 8};
/** LOD1 on a phone-sized or touch-first screen, or a field over cfg.lod1Above. */
export function useLod1(count, cfg, phone) {
  cfg = cfg || RIDER;
  if (!cfg.lod1Url) return false;
  if (phone === undefined) {
    try { phone = !!(globalThis.matchMedia && (matchMedia("(max-width: 820px)").matches || matchMedia("(pointer: coarse)").matches)); }
    catch (e) { phone = false; }
  }
  return !!phone || (count || 0) > (cfg.lod1Above || 8);
}
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
  return {len: len, width: width, at: at, points: points,
    // Point ``lat`` metres out from the inside rail at arc position s, and the heading.
    place: function (s, lat) {
      var p = at(s), nx = -p.tz * outward, nz = p.tx * outward;
      return {x: p.x + nx * lat, z: p.z + nz * lat, yaw: Math.atan2(p.tx, p.tz)};
    }};
}

export function genericPath() {
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

export function coursePath(def, fit) {
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
    setScale: function (k) { sc.set(k, k, k); },
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
export function silkTexture(blob, colour, flipY) {
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
  var silk = new T.MeshStandardMaterial({color: new T.Color(runner && runner.colour || FALLBACK_SILK), roughness: 0.6});
  var obj = new T.Group(), inner = new T.Group();
  obj.add(inner);
  var torso = new T.Mesh(g.torso, silk); torso.position.set(0, 2.3, 0.2); torso.rotation.x = 0.7; inner.add(torso);
  var cap = new T.Mesh(g.cap, silk); cap.position.set(0, 2.65, 0.55); inner.add(cap);
  return {obj: obj, kind: "box", flipY: true, material: silk,
    setSilk: function (tex) { if (!tex) return; silk.map = tex; silk.color.set(0xffffff); silk.needsUpdate = true; },
    update: function (dt, g2, bob) { inner.position.y = bob || 0; },
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
  // Clone the whole scene: the skinned meshes and their bones live under JockeyRoot, and
  // cloning a mesh on its own would leave its skeleton behind.
  var obj = model.SU.clone(model.gltf.scene);
  obj.traverse(function (n) { if (n.isSkinnedMesh) n.frustumCulled = false; });
  // Horse-group space: the outer group takes the horse's place, yaw and scale each frame;
  // the seat sits at cfg.seat x cfg.scale and rises with the body bob.
  var outer = new T.Group(), seat = new T.Group(), seatAt = (cfg.seat || RIDER.seat).slice();
  seat.position.fromArray(seatAt);
  seat.scale.setScalar(cfg.scale || 1);
  seat.add(obj);
  outer.add(seat);
  var base = findMaterial(obj, "Silk");
  var silk = base ? base.clone() : null;
  if (silk) {
    obj.traverse(function (n) {
      if (!n.isMesh) return;
      if (Array.isArray(n.material)) n.material = n.material.map(function (m) { return m && m.name === "Silk" ? silk : m; });
      else if (n.material && n.material.name === "Silk") n.material = silk;
    });
    silk.map = null;
    silk.color = new T.Color(runner && runner.colour || FALLBACK_SILK);
  }
  var mixer = new T.AnimationMixer(obj), clips = model.gltf.animations || [];
  var gallop = T.AnimationClip.findByName(clips, "ride_gallop");
  var idle = T.AnimationClip.findByName(clips, "ride_idle");
  var action = (gallop || idle) ? mixer.clipAction(gallop || idle) : null;
  if (action) action.play();
  return {obj: outer, kind: "gltf", flipY: false, material: silk,
    setSilk: function (tex) { if (!tex || !silk) return; silk.map = tex; silk.color.set(0xffffff); silk.needsUpdate = true; },
    // g: this horse's gallop phase (the same value that swings its legs); bob: body.y - 1.6.
    update: function (dt, g, bob) {
      seat.position.y = seatAt[1] + (bob || 0);
      if (action && gallop && g != null) { syncGallop(action, g); mixer.update(0); }
      else mixer.update(dt);
    },
    dispose: function () { mixer.stopAllAction(); if (silk) { if (silk.map) silk.map.dispose(); silk.dispose(); } }};
}

/** One rider per runner. Cinna's jockey when RIDER.url (or opts.rider.url) loads, else
    the box jockey. Returns a Promise so the caller never waits on a missing file. */
export function makeRider(runner, opts) {
  var cfg = Object.assign({}, RIDER, (opts && opts.rider) || {});
  var count = (opts && opts.count) || 0;
  var url = useLod1(count, cfg, opts && opts.phone) ? cfg.lod1Url : cfg.url;
  return loadRiderModel(url).then(function (model) {
    if (model) { try { return gltfRider(model, runner, cfg); } catch (e) {} }
    return boxRider(runner);
  });
}

/** Where the parade's leader starts: on the home straight in front of the stand (the
    Grandstand camera), so the field is in shot on load, then it canters round. */
export function paradeStart(path) {
  var best = 0, bd = Infinity, n = 400;
  for (var i = 0; i < n; i++) {
    var sx = path.len * i / n, p = path.at(sx), d = Math.hypot(p.x - 0, p.z - B);
    if (d < bd) { bd = d; best = sx; }
  }
  return best + 25;
}

/* ---------- the field ---------- */
function demoField() {
  return DEMO_SILKS.map(function (c, i) {
    return {number: i + 1, name: "", barrier: i + 1, colour: "#" + new T.Color(c).getHexString(), silk_url: "", tipped: false};
  });
}

/* ---------- the simulated race: where a run of (metres, lateral) sits on this track ---------- */
// Lanes horses settle into after the break (metres from the inside rail, by finishing place).
export var RACE_LANES = {first: 1.2, step: 1.6, count: 4};

/** The course start for a race distance: the exact start, else the nearest one. */
export function startFor(def, distance) {
  var list = (def && def.starts) || [], d = +distance || (def && def.default_start_m) || 1200, best = null;
  for (var i = 0; i < list.length; i++) {
    if (list[i].distance_m === d) return list[i];
    if (!best || Math.abs(list[i].distance_m - d) < Math.abs(best.distance_m - d)) best = list[i];
  }
  return best;
}

/** Winning post on the generic loop: the inside-rail point in front of the stand. */
export function genericPost(path) {
  var best = 0, bd = Infinity, n = 720;
  for (var i = 0; i < n; i++) {
    var s = path.len * i / n, p = path.at(s), d = Math.hypot(p.x, p.z - (B - WD / 2));
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

/**
 * Maps a run onto this track. Named courses: the start's own route (chute included) from
 * racecourse-lib's distanceToWorld in the course frame, fitted into the scene; past the
 * post the horses pull up along the main loop. Generic ellipse: the race starts
 * ``distance`` metres before the post (world metres, laps wrap) and runs to it.
 * raceScale shrinks the horses so neighbouring barrier stalls don't overlap.
 */
export function raceTrack(named, path) {
  var cur = null;
  if (named) {
    var def = named.def, fit = named.fit, Bd = def.barriers || {first_stall_offset_m: 0.75, spacing_m: 1.5, max_stalls: 20};
    return {
      kind: "named", lanes: RACE_LANES,
      raceScale: Math.max(0.45, Math.min(1.3, Bd.spacing_m * fit.s / 0.9 * 0.95)),
      start: function (distance) {
        var st = startFor(def, distance);
        cur = {st: resolveStart(def, st.id)};
        return {distance: st.distance_m, start: st.id};
      },
      stallLat: function (b) {
        var n = (cur && cur.st.stalls_available) || Bd.max_stalls || 20;
        return Bd.first_stall_offset_m + ((Math.max(1, b) - 1) % n) * Bd.spacing_m;
      },
      stalls: function () { return cur ? barrierStalls(def, cur.st) : []; },
      toWorld: function (d, lat) {
        var D = cur.st.distance_m;
        if (d <= D) {
          var w = distanceToWorld(def, Math.max(0, d), lat, {start: cur.st}), f = fitPoint(fit, w.x, w.z);
          return {x: f[0], z: f[1]};
        }
        var p = path.place((d - D) * fit.s, lat * fit.s);
        return {x: p.x, z: p.z};
      }
    };
  }
  var post = genericPost(path);
  return {
    kind: "generic", lanes: RACE_LANES, raceScale: 1.55,
    start: function (distance) {
      var D = Math.max(400, Math.min(4000, +distance || 1200));
      cur = {D: D};
      return {distance: D, start: "generic-" + D};
    },
    stallLat: function (b) { return 0.75 + ((Math.max(1, b) - 1) % 20) * 1.5; },
    stalls: function () { return []; },
    toWorld: function (d, lat) { var p = path.place(post - cur.D + d, lat); return {x: p.x, z: p.z}; }
  };
}

/** Follow-camera for the leader: outside the track, alongside and a touch behind. */
export function followCamera(track, pose) {
  if (!pose) return null;
  var k = pose.scale / 1.3;
  var a = track.toWorld(pose.d, pose.lat), b = track.toWorld(pose.d, pose.lat + 10), c = track.toWorld(pose.d + 5, pose.lat);
  var nx = b.x - a.x, nz = b.z - a.z, nl = Math.hypot(nx, nz) || 1;
  var hx = c.x - a.x, hz = c.z - a.z, hl = Math.hypot(hx, hz) || 1;
  nx /= nl; nz /= nl; hx /= hl; hz /= hl;
  // Broadcast-style tracking shot: alongside, a touch behind, so the chasers trail off to one side.
  return {pos: [pose.x + nx * 34 * k - hx * 8 * k, 14 * k, pose.z + nz * 34 * k - hz * 8 * k],
    look: [pose.x - hx * 4 * k, 1.5 * k, pose.z - hz * 4 * k]};
}

function Field(scene, path, opts) {
  var horses = null, riders = [], markers = [], runners = [], lead = paradeStart(path), t = 0, gen = 0;
  var scale = opts.horseScale || 1.6;
  var track = opts.track || null, race = null;   // race: {spec, info, plan, t, scale} after the jump
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
      makeRider(rn, {rider: opts.rider, count: runners.length, phone: opts.phone}).then(function (rider) {
        if (my !== gen) { rider.dispose(); return; }
        rider.obj.scale.setScalar(race ? race.scale : scale);
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
    // A new field mid-race (a late scratching) re-runs the same race from where it was.
    if (race) { var at = race.t; setRace(race.spec); race.t = at; }
    update(0);
  }
  function raceUpdate(dt) {
    var R = race, k = R.scale;
    R.t = Math.min(R.t + dt, R.plan.duration);
    var moving = R.t > 0 && R.t < R.plan.duration;
    runners.forEach(function (rn, i) {
      var q = R.plan.at(i, R.t);
      var w = track.toWorld(q.d, q.lat), ahead = track.toWorld(q.d + 1, q.lat);
      var dx = ahead.x - w.x, dz = ahead.z - w.z;
      var p = {x: w.x, z: w.z, yaw: Math.abs(dx) + Math.abs(dz) > 1e-6 ? Math.atan2(dx, dz) : (rn._p ? rn._p.yaw : 0)};
      // Gallop while running, slow to a canter after the post, stand still in the gates.
      rn._stride = (rn._stride || 0) + dt * (moving && R.t > 0 ? (q.done ? 4 : 11) : 0);
      var stride = rn._stride + i * 0.7, bob = moving ? Math.abs(Math.sin(stride)) * 0.1 * k : 0;
      horses.set(i, p.x, p.z, p.yaw, bob, stride);
      var r = riders[i];
      if (r) {
        r.obj.position.set(p.x, 0, p.z);
        r.obj.rotation.set(0, p.yaw, 0);
        r.update(dt, stride, bob);
      }
      rn._p = p; rn._q = q;
    });
  }
  function applyScale(k) {
    if (horses) horses.setScale(k);
    riders.forEach(function (r) { if (r) r.obj.scale.setScalar(k); });
  }
  /** spec: {distance, order: [saddle numbers, winner first], key, source}; null = parade. */
  function setRace(spec) {
    if (!spec || !track || !runners.length) {
      if (race) { race = null; applyScale(scale); }
      return null;
    }
    var idx = {}, order = [];
    runners.forEach(function (rn, i) { if (rn.number != null) idx[rn.number] = i; });
    (spec.order || []).forEach(function (n) { if (idx[n] != null && order.indexOf(idx[n]) < 0) order.push(idx[n]); });
    runners.forEach(function (rn, i) { if (order.indexOf(i) < 0) order.push(i); });   // not placed: behind, field order
    var stalls = runners.map(function (rn, i) { return track.stallLat(rn.barrier || i + 1); });
    var info = track.start(spec.distance);
    race = {spec: spec, info: info, t: -1, scale: Math.min(scale, track.raceScale),
      plan: racePlan({distance: info.distance, order: order, stalls: stalls, lanes: track.lanes,
        seed: seedOf(spec.key || order.join(","))})};
    applyScale(race.scale);
    raceUpdate(0);
    return info;
  }
  function update(dt) {
    if (!horses) return;
    t += dt;
    if (race) raceUpdate(dt);
    else paradeUpdate(dt);
    var k = race ? race.scale : scale;
    markers.forEach(function (m) {
      var p = runners[m.userData.i]._p;
      m.scale.setScalar(k / scale);
      m.position.set(p.x, (7.5 + Math.sin(t * 3) * 0.4 * 1.6 / scale) * k / 1.6, p.z);
    });
    horses.flush();
  }
  function paradeUpdate(dt) {
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
        r.obj.position.set(p.x, 0, p.z);
        r.obj.rotation.set(0, p.yaw, 0);
        r.update(dt, stride, bob);
      }
      runners[i]._p = p;
    });
  }
  function raceState() {
    if (!race) return {phase: "parade"};
    var rn = runners[race.plan.leader(Math.max(0, race.t))] || {};
    return {phase: race.t >= race.plan.duration ? "finished" : "race", t: race.t, duration: race.plan.duration,
      distance: race.info.distance, start: race.info.start, source: race.spec.source || "",
      leader: rn.number == null ? null : rn.number, winnerAt: race.plan.finishAt[race.plan.order[0]],
      order: race.plan.order.map(function (i) { return runners[i].number; })};
  }
  function leaderPose() {
    if (!race) return null;
    var rn = runners[race.plan.leader(Math.max(0, race.t))];
    return rn && rn._p ? {x: rn._p.x, z: rn._p.z, yaw: rn._p.yaw, d: rn._q.d, lat: rn._q.lat, scale: race.scale} : null;
  }
  return {set: set, update: update, count: function () { return runners.length; },
    setRace: setRace, raceState: raceState, leaderPose: leaderPose,
    // Jump the run to playback time t (seconds; -1 = in the gates). Tests and screenshots.
    seek: function (at) {
      if (!race) return false;
      race.t = Math.max(-1, Math.min(+at || 0, race.plan.duration));
      raceUpdate(0);
      return true;
    },
    replay: function () {
      if (!race) return false;
      race.t = -1;
      runners.forEach(function (rn) { rn._stride = 0; });
      raceUpdate(0);
      return true;
    },
    riderKinds: function () { return riders.map(function (r) { return r ? r.kind : ""; }); },
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
  return {path: coursePath(def, fit), def: def, fit: fit, group: g, base: base};
}

/* ---------- billboards ---------- */
// Generic ellipse in Cinna's makeEllipseLoop terms: the inside rail (248 x 98 m), horses
// run with the angle (clockwise in her convention), winning post at the stand (+z).
export var GENERIC_LOOP = {cx: 0, cz: 0, a: A - WD / 2, b: B - WD / 2, direction: "clockwise", postAngleRad: Math.PI / 2};

// The stand's front rows (z 132..154) on the centre line: tall boards turn to face it.
export var GENERIC_CAMERA = {x: 0, z: 142};
// The ellipse's LED strip is ~50 segments of 8 m x k; Sponsor Studio sells it as this many
// runs. Each run is one slot id on consecutive segments, so its image repeats along the run.
export var GENERIC_LED_SLOTS = 6;

/** Map n LED segments (running order) onto ``slots`` runs: [1,1,..,2,2,..]. Pure. */
export function ledRuns(n, slots) {
  var out = [], k = Math.max(1, Math.min(slots || 1, n));
  for (var i = 0; i < n; i++) out.push(Math.floor(i * k / n) + 1);
  return out;
}

/** Slot placements for a track. Pure (no three.js). named = {def, rules, start_m} or null. */
export function billboardPlacements(named) {
  if (named && named.def) return placeBillboards(named.def, named.rules || {}, named.start_m != null ? {start: named.start_m} : {});
  var pl = placeBillboardsEllipse(makeEllipseLoop(GENERIC_LOOP), {track_width_m: WD, cameraPoint: GENERIC_CAMERA});
  var leds = pl.filter(function (p) { return p.type === "led"; }).sort(function (a, b) { return a.n - b.n; });
  var runs = ledRuns(leds.length, GENERIC_LED_SLOTS);
  leds.forEach(function (p, i) {
    p.run = runs[i];
    p.slots.forEach(function (sl) { sl.slot_id = "led_" + runs[i]; });   // node ids (Billboard_led_<n>) stay unique
  });
  return pl;
}

async function courseRules(base, id) {
  try {
    var res = await fetch(new URL("billboards.json", base).href);
    if (!res.ok) return {};
    var all = await res.json();
    return (all && all.courses && all.courses[id]) || {};
  } catch (e) { return {}; }
}

// Each SponsorPatch* mesh (prefix match) under root, by slot id; remembers its backing so a
// cleared slot goes back to plain. flipY: true for PlaneGeometry boards, false for glTF UVs.
function indexPatches(root, slots, flipY, slotOf) {
  root.traverse(function (n) {
    if (!n.isMesh || !/^SponsorPatch/.test(n.name || "")) return;
    var id = (n.userData && n.userData.slot_id) || (slotOf && slotOf(n)) || "";
    if (!id) return;
    var m = n.material;
    var glow = !!(m.emissive && m.emissive.getHex && m.emissive.getHex());
    // A dark backing (the LED strip) that glows with no image shows as a grey slab; an
    // empty dark slot stays dark until it has sponsor art. Intensity is never touched.
    var dark = !!(m.color && (m.color.r + m.color.g + m.color.b) / 3 < 0.2 && !m.map);
    n.userData.patch = {flipY: flipY, color: m.color ? m.color.clone() : null, map: m.map || null, emissiveMap: m.emissiveMap || null,
      glow: glow, emissive: glow ? m.emissive.getHex() : 0, darkEmpty: glow && dark};
    if (glow && dark && !m.emissiveMap) { m.emissive.setHex(0x000000); m.needsUpdate = true; }
    (slots[id] = slots[id] || []).push(n);
  });
}

// Named-course board size in the course's own frame. The models are fitted at 0.39-0.56
// scene units per metre, so 1.6 gives boards ~0.63-0.9 x real size, a touch above the
// generic ellipse (0.57) so they read from the Grandstand camera. Gate banners stay 1:1
// (they span barrier stalls and would overlap their neighbours).
export var NAMED_BOARD_SCALE = 1.6;

function inside(pts, x, z) {
  var c = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var a = pts[i], b = pts[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

/** Where infield_C stands, picked by projecting the board and the parade field through
    the Grandstand camera (.harness/infield.mjs): deep enough in the infield that it never
    covers the horses. Named courses run anticlockwise, so at (18, 75) the board stays
    clear of the field for the whole lap. The generic loop runs clockwise, so the field
    rounds the far turn behind any infield spot; (-20, 72) keeps the parade clear for its
    first ~10 s and the board readable. */
export var INFIELD_BOARD = {named: {x: 18, z: 75}, generic: {x: -20, z: 72}};

/** infield_C's spot for a track: the preferred point if it lies inside the rail outline,
    else step in from the inside rail nearest it, else the infield centroid. Faces the
    Grandstand camera. */
export function infieldSpot(path, want) {
  want = want || INFIELD_BOARD.named;
  var cam = RACECOURSE_CAMERAS[0].pos, pts = path.points || [];
  function at(x, z) { return {x: x, z: z, rotationY: Math.atan2(cam[0] - x, cam[2] - z)}; }
  if (!pts.length || inside(pts, want.x, want.z)) return at(want.x, want.z);
  var best = 0, bd = Infinity, n = 600;
  for (var i = 0; i < n; i++) {
    var sx = path.len * i / n, p = path.at(sx), d = Math.hypot(p.x - want.x, p.z - want.z);
    if (d < bd) { bd = d; best = sx; }
  }
  for (var lat = -22; lat >= -52; lat -= 10) {
    var q = path.place(best, lat);
    if (inside(pts, q.x, q.z)) return at(q.x, q.z);
  }
  var cx = 0, cz = 0;
  pts.forEach(function (p) { cx += p[0]; cz += p[1]; });
  return at(cx / Math.max(1, pts.length), cz / Math.max(1, pts.length));
}

async function addFollowerBillboards(scene, base, slots, infield) {
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
    // Rooftop boards ride the shared stand on every track; the infield board goes to the
    // track's own clear infield spot (infieldSpot).
    if (infield && p.name === "infield_C") { obj.position.set(infield.x, 0, infield.z); obj.rotation.y = infield.rotationY; }
    obj.scale.setScalar(p.scale);
    obj.traverse(function (n) {
      if (n.isMesh && /^SponsorPatch/.test(n.name)) {
        n.material = n.material.clone();
        n.material.map = null;           // published view: plain panel until the studio sends a sponsor
        n.material.color && n.material.color.set(0xf4f6fa);
        n.material.needsUpdate = true;
        n.userData.slot_id = p.name;     // Studio slot = placement name (rooftop_A, rooftop_B, infield_C)
      }
    });
    scene.add(obj);
    indexPatches(obj, slots, false);
  }
}

/** Merge every billboard's frame, posts and backing (all but the SponsorPatch* faces and
    the glow) into one mesh per material look, so ~70 boards cost a handful of draw calls
    plus one per sponsor face. Returns the number of meshes merged. */
export function bakeFrames(root) {
  root.updateMatrixWorld(true);
  var inv = new T.Matrix4().copy(root.matrixWorld).invert(), rel = new T.Matrix4();
  var groups = {}, drop = [];
  root.traverse(function (n) {
    if (!n.isMesh || /^(SponsorPatch|Glow|GroundSpill)/.test(n.name || "")) return;
    var m = n.material;
    if (!m || Array.isArray(m)) return;
    var key = [m.type, m.color ? m.color.getHex() : 0, m.roughness, m.metalness, m.toneMapped].join("|");
    var g = n.geometry.index ? n.geometry.toNonIndexed() : n.geometry.clone();
    Object.keys(g.attributes).forEach(function (a) { if (a !== "position" && a !== "normal") g.deleteAttribute(a); });
    g.applyMatrix4(rel.multiplyMatrices(inv, n.matrixWorld));
    (groups[key] = groups[key] || {mat: m, geos: []}).geos.push(g);
    drop.push(n);
  });
  drop.forEach(function (n) { n.parent.remove(n); n.geometry.dispose(); });
  Object.keys(groups).forEach(function (key) {
    var merged = mergeGeometries(groups[key].geos, false);
    groups[key].geos.forEach(function (g) { g.dispose(); });
    if (!merged) return;
    var mesh = new T.Mesh(merged, groups[key].mat);
    mesh.name = "BillboardFrames";
    root.add(mesh);
  });
  return drop.length;
}

function Billboards(onChange) {
  var slots = {}, texCache = {}, want = {};
  function tex(url, flipY) {
    var key = (flipY ? "1|" : "0|") + url;
    if (!texCache[key]) {
      texCache[key] = new Promise(function (resolve) {
        new T.TextureLoader().load(url, function (t) {
          t.flipY = flipY; t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; t.needsUpdate = true; resolve(t);
        }, undefined, function () { resolve(null); });
      });
    }
    return texCache[key];
  }
  function paint(mesh, t) {
    var m = mesh.material, b = mesh.userData.patch;
    m.map = t || b.map;
    if (m.color) { if (t) m.color.set(0xffffff); else if (b.color) m.color.copy(b.color); }
    // The LED and lit boards keep their own emissive colour and intensity; the sponsor
    // image only becomes the emissive map, so it glows instead of a flat white panel.
    if (b.glow) {
      m.emissiveMap = t || b.emissiveMap;
      if (b.darkEmpty) m.emissive.setHex(t ? b.emissive : 0x000000);
    }
    m.needsUpdate = true;
  }
  return {
    slots: slots,
    set: function (rows) {
      rows = rows || {};
      var jobs = [];
      Object.keys(slots).forEach(function (id) {
        var url = rows[id] && rows[id].url || "";
        want[id] = url;
        slots[id].forEach(function (mesh) {
          if (!url) { paint(mesh, null); return; }
          jobs.push(tex(url, mesh.userData.patch.flipY).then(function (t) { if (want[id] === url) paint(mesh, t); }));
        });
      });
      return Promise.all(jobs).then(function () { if (onChange) onChange(); });
    },
    dispose: function () {
      Object.keys(texCache).forEach(function (k) { texCache[k].then(function (t) { if (t) t.dispose(); }); });
    }
  };
}

export async function buildRacecourse(scene, opts) {
  opts = opts || {};
  // Wide enough for the chute starts the simulated race uses (Flemington's straight runs off the fitted box).
  box(scene, 1600, 0.2, 1000, 0x2f5b2c, 0, -0.1, 0);
  var path = null, course = "", named = null;
  var want = COURSES.indexOf(opts.course) >= 0 ? opts.course : "";
  if (want) {
    try {
      named = await namedTrack(scene, want, opts);
      path = named.path; course = want;
    } catch (e) { path = null; course = ""; named = null; }
  }
  if (!path) { genericTrack(scene); path = genericPath(); }
  stand(scene);
  var led = null;
  try {
    var ribbons = [{pts: [[-110, B + WD / 2 + 3], [110, B + WD / 2 + 3]], y: 0.3, h: 2.2}];
    if (!course) ribbons.push({pts: ellPath(A - WD / 2 - 1, B - WD / 2 - 1, 160), y: 0, h: 0.7, closed: true});
    led = await ledRibbons(scene, ribbons, false, opts.boardsUrl);
  } catch (e) { led = null; }
  var boards = Billboards(opts.onChange);
  if (opts.billboards !== false) {
    // Sponsor slots: named courses in the course's own frame (child of its model), the
    // generic ellipse in the scene frame. A failure leaves the track without boards.
    try {
      var rules = named ? await courseRules(named.base, course) : null;
      var placed = billboardPlacements(named ? {def: named.def, rules: rules.rules, start_m: rules.start_m} : null);
      if (named) placed.forEach(function (p) { if (p.type !== "gate") p.scale = NAMED_BOARD_SCALE; });
      var root = addLibBillboards({THREE: T, group: named ? named.group : scene}, placed, {});
      indexPatches(root, boards.slots, true);
      bakeFrames(root);
    } catch (e) {}
    try {
      await addFollowerBillboards(scene, opts.billboardsBase || new URL("./billboards/", import.meta.url).href, boards.slots,
        infieldSpot(path, named ? INFIELD_BOARD.named : INFIELD_BOARD.generic));
    } catch (e) {}
  }
  var rtrack = raceTrack(named, path);
  var field = Field(scene, path, {silkLoader: opts.silkLoader, rider: opts.rider, onChange: opts.onChange,
    horseScale: course ? 1.3 : 1.6, track: rtrack});
  field.set(opts.field || null);
  return {led: led, update: field.update, course: course, path: path,
    setField: function (list) { field.set(list || null); }, fieldCount: field.count, riderKinds: field.riderKinds,
    // Simulated race after the jump: spec {distance, order, key, source}; null = parade.
    setRace: field.setRace, raceState: field.raceState, replayRace: field.replay, seekRace: field.seek,
    follow: function () { return followCamera(rtrack, field.leaderPose()); },
    billboardSlots: function () { return Object.keys(boards.slots); },
    // map: the scene's "billboards" ({course: {slot: {url}}}); this track's rows apply.
    setBillboards: function (map) { return boards.set((map || {})[course || "generic"] || {}); },
    dispose: function () { field.dispose(); boards.dispose(); }};
}

export var DEF = {venue: VENUE, fallbackUrl: FALLBACK_URL, cameras: RACECOURSE_CAMERAS, chips: RACECOURSE_CHIPS,
  field: INFIELD, outdoor: true, far: 1600, build: buildRacecourse};

export function mount(host, opts) {
  return mountVenue(host, opts, DEF);
}
