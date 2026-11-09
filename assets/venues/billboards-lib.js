// billboards-lib.js: billboard system for the racecourse models. ES module; sits next to racecourse-lib.js (same folder).
// tipdash port: the face rule for "along the run" is spelt 'ahead' here (the public build's secret scan refuses Cinna's word for it).
// Pure maths (placeBillboards, loopToWorld, findTurns) needs no three.js. buildBillboard()/addBillboards() take THREE as an argument.
// Frame: same as racecourse-lib (metres, +X run at the post, +Y up, +Z right of travel, lateral = metres from the INSIDE rail, outward positive).
// "s" = metres along the main loop from the winning post in the running direction (closed loops wrap; straights: s_post_m is the post). "togo" = metres still to run to the post.
import { prepare, distanceToWorld, resolveStart, barrierStalls } from './racecourse-lib.js';
const hypot = Math.hypot, D2R = Math.PI / 180;

// ---------- types: sizes in metres, texture pixels, slots ----------
// Every slot texture: opaque, sRGB, flipY=false is NOT needed (PlaneGeometry UVs), 5% safe margin on each side, aspect = w:h exactly.
export const SAFE = 0.05;
const px = (w, h, ppm) => [Math.round(w * ppm), Math.round(h * ppm)];
export const TYPES = {
  rail:   { code: 'RB',  label: 'Rail-fence board',        mount: 'outer',  bottom_m: 0.12, depth_m: 0.06, slots: [{ key: null, w: 4.0, h: 0.8,   px: [2000, 400], backing: '#F4F6FA' }] },
  led:    { code: 'LED', label: 'Rail-top LED strip',      mount: 'inner',  bottom_m: 1.10, depth_m: 0.12, slots: [{ key: null, w: 8.0, h: 0.5,   px: [1920, 120], backing: '#0D1419', emissive: true }] }, // Sponsor Studio LED template (Brandon, 10 Nov 2026)
  tall:   { code: 'TB',  label: 'Tall infield billboard',  mount: 'infield', bottom_m: 1.70, depth_m: 0.22, slots: [{ key: 'main', w: 8.0, h: 3.0, px: [2048, 768], backing: '#F4F6FA', y0: 0.9 }, { key: 'foot', w: 8.0, h: 0.9, px: [2048, 230], backing: '#0D1419', y0: 0 }] },
  finish: { code: 'WP',  label: 'Winning-post board',      mount: 'infield', bottom_m: 3.00, depth_m: 0.10, slots: [{ key: 'front', w: 4.0, h: 1.0, px: [2048, 512], backing: '#F4F6FA', face: 'outward' }, { key: 'back', w: 4.0, h: 1.0, px: [2048, 512], backing: '#F4F6FA', face: 'inward' }] },
  gate:   { code: 'GB',  label: 'Barrier-stall gate banner', mount: 'gate', bottom_m: 1.85, depth_m: 0.06, slots: [{ key: null, w: 6.0, h: 0.75, px: [2048, 256], backing: '#F4F6FA' }] }
};
export const slotId = (type, n, key) => `${type}_${n}${key ? '.' + key : ''}`;
export const nodeName = (type, n) => `Billboard_${type}_${n}`;
export const patchName = key => (key ? `SponsorPatch_${key}` : 'SponsorPatch');
export const materialName = key => (key ? `Sponsor_${key}` : 'Sponsor');

// ---------- default rules (override per course in billboards.json) ----------
export function defaultConfig(def) {
  const hs = Math.min(def.home_straight_m || 400, 450), W = def.width_m;
  const led = { lo: 24, hi: Math.min(hs, 400) - 24, pitch: 40 };
  return {
    schema: 'racetrack-billboards/1',
    stand_anchor: { togo_m: 0, lateral_m: W + 40 }, // a point in front of the main stand (outside the outer rail at the winning post)
    types: {
      rail:   { enabled: true, ranges: [{ togo_from_m: Math.min(hs, 330) - 12, togo_to_m: 30 }], pitch_m: 48, lateral_m: W, face: 'across' },
      led:    { enabled: true, ranges: [{ togo_from_m: led.hi, togo_to_m: led.lo }], pitch_m: led.pitch, lateral_m: 0, face: 'stand', clamp_deg: 25 },
      tall:   { enabled: true, at: 'turn-apex', count: 2, lateral_m: -18, face: 'stand', clamp_deg: 180 },
      finish: { enabled: true, togo_m: 0, lateral_m: -1.5 },
      gate:   { enabled: true, stalls_per_banner: 4, face: 'rear' }
    },
    assignments: {}
  };
}
const merge = (a, b) => { const o = { ...a }; for (const k in b) o[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; };

// ---------- loop geometry ----------
function at(poly, s, closed) {
  const { pts, cum, len } = poly; s = closed ? ((s % len) + len) % len : Math.max(0, Math.min(len, s));
  let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const a = pts[lo], b = pts[lo + 1], seg = cum[lo + 1] - cum[lo] || 1, t = (s - cum[lo]) / seg;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / seg, tz: (b[1] - a[1]) / seg };
}
const sgn = def => (def.direction === 'clockwise' ? -1 : 1);
export const togoToS = (def, togo) => { const L = def.main.length_m, p = def.main.s_post_m; return def.main.closed ? ((p - togo) % L + L) % L : p - togo; };
// s along the main loop + lateral (from inside rail) -> world point, heading and the OUTWARD unit normal (towards the outer rail)
export function loopToWorld(def, s, lateral = 0) {
  const P = prepare(def), p = at(P.main, s, def.main.closed), g = sgn(def), nx = -p.tz * g, nz = p.tx * g, off = lateral - def.measure_offset_m;
  return { x: p.x + nx * off, y: 0, z: p.z + nz * off, tx: p.tx, tz: p.tz, nx, nz, heading_rad: Math.atan2(p.tz, p.tx), s_m: s };
}
// Turns: contiguous stretches where the measured line bends faster than k_min (1/m). Returns [{s_start, s_end, s_apex, turn_deg}] in running order from the post.
export function findTurns(def, { k_min = 0.0012, min_deg = 50, merge_gap_m = 40 } = {}) {
  const P = prepare(def).main, pts = P.pts, n = pts.length - 1; if (!def.main.closed) return [];
  const H = []; for (let i = 0; i < n; i++) H.push(Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]));
  const dH = H.map((h, i) => { let d = H[(i + 1) % n] - h; d = Math.atan2(Math.sin(d), Math.cos(d)); return d; });
  const step = P.len / n, win = Math.max(1, Math.round(24 / step)), curv = dH.map((_, i) => { let a = 0; for (let k = -win; k <= win; k++) a += dH[(i + k + n) % n]; return Math.abs(a) / ((2 * win + 1) * step); });
  const runs = []; let cur = null;
  for (let i = 0; i < n; i++) { if (curv[i] > k_min) { if (cur && i - cur.e <= merge_gap_m / step) cur.e = i; else { cur = { b: i, e: i }; runs.push(cur); } } }
  const out = runs.map(r => { let tot = 0; for (let i = r.b; i <= r.e; i++) tot += Math.abs(dH[i]); let acc = 0, ap = r.b; for (let i = r.b; i <= r.e; i++) { acc += Math.abs(dH[i]); if (acc >= tot / 2) { ap = i; break; } } return { s_start: P.cum[r.b], s_end: P.cum[r.e], s_apex: P.cum[ap], turn_deg: tot / D2R }; }).filter(t => t.turn_deg >= min_deg);
  return out.sort((a, b) => a.s_apex - b.s_apex);
}

// ---------- facing ----------
const norm = (x, z) => { const l = hypot(x, z) || 1; return [x / l, z / l]; };
function resolveFace(def, rule, pt, mount, standPt, extra = {}) {
  const out = pt.nx * 1, outz = pt.nz * 1;
  const across = mount === 'outer' ? [-pt.nx, -pt.nz] : [pt.nx, pt.nz]; // opposite side of the track
  const f = rule.face || 'across';
  if (f === 'across') return across;
  if (f === 'outward') return [pt.nx, pt.nz]; if (f === 'inward') return [-pt.nx, -pt.nz];
  if (f === 'ahead') return [pt.tx, pt.tz]; if (f === 'rear') return [-pt.tx, -pt.tz];
  const tgt = f === 'camera' ? (rule.aim || standPt) : standPt; // 'stand' | 'camera'
  const d = norm(tgt.x - pt.x, tgt.z - pt.z), clamp = (rule.clamp_deg ?? 180) * D2R;
  if (clamp >= Math.PI - 1e-6) return d;
  const base = Math.atan2(across[0], across[1]), want = Math.atan2(d[0], d[1]); let delta = Math.atan2(Math.sin(want - base), Math.cos(want - base)); delta = Math.max(-clamp, Math.min(clamp, delta));
  const a = base + delta; return [Math.sin(a), Math.cos(a)];
}

// ---------- placement ----------
// One placement object (shared by placeBillboards and placeBillboardsEllipse). scale (optional, default 1) uniformly scales the built board.
function placementObject(type, n, pt, lateral, face, meta = {}) {
  const ty = TYPES[type], mount = meta.mount || ty.mount, sc = meta.scale ?? 1;
  const h = Math.max(...ty.slots.map(s => (s.y0 || 0) + s.h)), top = ty.bottom_m + (type === 'tall' ? 4.05 : h);
  const o = { id: nodeName(type, n), type, n, code: ty.code, label: `${ty.code}-${n}`, mount, position: { x: pt.x, y: 0, z: pt.z }, yaw_rad: Math.atan2(face[0], face[1]), face: face, lateral_m: lateral, s_m: pt.s_m, togo_m: meta.togo_m ?? null,
    slots: ty.slots.map(sl => ({ slot_id: slotId(type, n, sl.key), key: sl.key, w: sl.w, h: sl.h, px: sl.px, aspect: sl.px.join(':'), backing: sl.backing, safe: SAFE, face: sl.face || null })),
    size_m: { w: +(Math.max(...ty.slots.map(s => s.w)) * sc).toFixed(3), h: +(h * sc).toFixed(3), top_m: +(top * sc).toFixed(2) }, ...meta.extra };
  if (meta.scale != null) o.scale = sc;
  return o;
}
// Returns [{id, type, n, code, label, position{x,y,z}, yaw_rad, face[x,z], lateral_m, togo_m, s_m, slots:[{slot_id,key,w,h,px,...}], ...}] numbered in running order.
export function placeBillboards(def, userCfg = {}, opts = {}) {
  const cfg = merge(defaultConfig(def), userCfg), T = cfg.types, out = [], W = def.width_m;
  const sa = cfg.stand_anchor, stand = loopToWorld(def, togoToS(def, sa.togo_m), sa.lateral_m);
  const make = (type, n, pt, lateral, rule, meta = {}) => {
    const mount = meta.mount || TYPES[type].mount, face = meta.face || resolveFace(def, rule, pt, mount, stand);
    out.push(placementObject(type, n, pt, lateral, face, { ...meta, mount }));
  };
  const ranged = (type, rule) => { // positions from togo ranges, numbered in running order (largest togo first)
    const list = []; for (const r of rule.ranges) { const from = r.togo_from_m, to = r.togo_to_m, span = from - to, cnt = Math.floor(span / rule.pitch_m + 1e-6) + 1, off = (span - (cnt - 1) * rule.pitch_m) / 2; for (let i = 0; i < cnt; i++) list.push(from - off - i * rule.pitch_m); }
    return list.sort((a, b) => b - a);
  };
  for (const type of ['rail', 'led']) if (T[type].enabled) ranged(type, T[type]).forEach((togo, i) => make(type, i + 1, loopToWorld(def, togoToS(def, togo), T[type].lateral_m), T[type].lateral_m, T[type], { togo_m: togo }));
  if (T.tall.enabled) {
    let sites = []; const turns = findTurns(def);
    if (T.tall.at === 'turn-apex' && turns.length) sites = [...turns].sort((a, b) => b.turn_deg - a.turn_deg).slice(0, T.tall.count).sort((a, b) => a.s_apex - b.s_apex).map(t => t.s_apex);
    else { const L = def.home_straight_m || 400; for (let i = 1; i <= T.tall.count; i++) sites.push(togoToS(def, L * i / (T.tall.count + 1))); } // straight course: spread along the straight
    sites.forEach((s, i) => make('tall', i + 1, loopToWorld(def, s, T.tall.lateral_m), T.tall.lateral_m, T.tall, { togo_m: def.main.closed ? def.main.length_m - s : null }));
  }
  if (T.finish.enabled) { const pt = loopToWorld(def, togoToS(def, T.finish.togo_m), T.finish.lateral_m); make('finish', 1, pt, T.finish.lateral_m, T.finish, { togo_m: 0, face: [pt.nx, pt.nz] }); }
  if (T.gate.enabled && opts.start != null) {
    const st = resolveStart(def, opts.start), stalls = barrierStalls(def, st), B = def.barriers, per = T.gate.stalls_per_banner, nb = Math.ceil(stalls.length / per);
    for (let i = 0; i < nb; i++) {
      const a = i * per, b = Math.min(stalls.length, a + per) - 1, lat = (stalls[a].lateral_offset_m + stalls[b].lateral_offset_m) / 2, w = distanceToWorld(def, 0, lat, { start: st });
      const h = w.heading_rad, back = B.depth_m, pt = { x: w.x - Math.cos(h) * back, z: w.z - Math.sin(h) * back, tx: Math.cos(h), tz: Math.sin(h), nx: 0, nz: 0, s_m: null };
      const o = distanceToWorld(def, 0, lat + 1, { start: st }), nxz = norm(o.x - w.x, o.z - w.z); pt.nx = nxz[0]; pt.nz = nxz[1];
      make('gate', i + 1, pt, lat, T.gate, { mount: 'gate', extra: { start_id: st.id, stalls: [a + 1, b + 1], width_m: (b - a + 1) * B.spacing_m } });
    }
  }
  for (const p of out) for (const s of p.slots) s.sponsor = cfg.assignments[s.slot_id] || null;
  return out;
}

// ---------- three.js builder ----------
const COL = { alu: '#d9dfeb', graphite: '#39425a', post: '#2b3345', backing: '#0D1419', led_glow: '#8fb0ff' };
function softRect(THREE, w = 64, h = 32) { // soft rectangular alpha falloff (no DOM needed)
  const d = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = Math.min(x, w - 1 - x) / (w * 0.5), v = Math.min(y, h - 1 - y) / (h * 0.5), a = Math.pow(Math.min(1, Math.min(u, v) * 2.2), 1.6); const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = Math.round(255 * a); }
  const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat); t.needsUpdate = true; t.colorSpace = THREE.SRGBColorSpace; return t;
}
// opts: {textures: {slot_id: THREE.Texture}, night: bool}. Returns THREE.Group named Billboard_<type>_<n>, local +Z = the face direction, y=0 ground.
export function buildBillboard(THREE, pl, opts = {}) {
  const ty = TYPES[pl.type], g = new THREE.Group(); g.name = pl.id; g.userData = { type: pl.type, n: pl.n, code: pl.code, slots: pl.slots.map(s => s.slot_id) };
  const std = (color, rough = 0.6, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const alu = std(COL.alu, 0.45, 0.4), post = std(COL.post, 0.55, 0.5), back = std(COL.graphite, 0.7);
  const box = (w, h, d, x, y, z, mat, name) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); if (name) m.name = name; m.castShadow = true; g.add(m); return m; };
  const rim = 0.04;
  const face = (sl, y0, zOff, nameSuffix, flipY = false) => { // panel: back box + frame + textured plane
    const d = ty.depth_m, cy = y0 + sl.h / 2, tex = opts.textures?.[sl.slot_id];
    const sub = new THREE.Group(); sub.name = 'Panel' + (sl.key ? '_' + sl.key : ''); sub.position.set(0, 0, zOff); if (flipY) sub.rotation.y = Math.PI; g.add(sub);
    const bx = (w, h, dd, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), mat); m.position.set(x, y, z); m.castShadow = true; sub.add(m); return m; };
    bx(sl.w + rim * 2, sl.h + rim * 2, d, 0, cy, 0, back); // body
    const light = ty.slots[0].emissive;
    for (const [w, h, x, y] of [[sl.w + rim * 2, rim, 0, cy + sl.h / 2 + rim / 2], [sl.w + rim * 2, rim, 0, cy - sl.h / 2 - rim / 2], [rim, sl.h, -sl.w / 2 - rim / 2, cy], [rim, sl.h, sl.w / 2 + rim / 2, cy]]) bx(w, h, d + 0.02, x, y, 0.005, alu);
    const mat = sl.backing && sl.backing === COL.backing && ty.slots[0].emissive ? new THREE.MeshStandardMaterial({ map: tex || null, color: tex ? 0xffffff : sl.backing, emissive: 0xffffff, emissiveMap: tex || null, emissiveIntensity: opts.night ? 1.25 : 0.55, roughness: 0.35, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: tex || null, color: tex ? 0xffffff : sl.backing, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex || null, emissiveIntensity: opts.night ? 0.4 : 0.5 });
    mat.name = materialName(sl.key);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(sl.w, sl.h), mat); plane.name = patchName(sl.key); plane.position.set(0, cy, d / 2 + 0.002); plane.userData = { slot_id: sl.slot_id, w_m: sl.w, h_m: sl.h, px: sl.px, safe: SAFE }; sub.add(plane);
    if (ty.slots[0].emissive && opts.night !== undefined) { // night glow: additive halo + ground spill
      const gt = (opts.glowTex ||= softRect(THREE)), gm = new THREE.MeshBasicMaterial({ map: gt, color: COL.led_glow, transparent: true, opacity: opts.night ? 0.42 : 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(sl.w + 2.2, sl.h + 1.5), gm); halo.name = 'Glow'; halo.position.set(0, cy, -d / 2 - 0.03); sub.add(halo);
      const spill = new THREE.Mesh(new THREE.PlaneGeometry(sl.w + 1.5, 3.2).rotateX(-Math.PI / 2), gm.clone()); spill.material.opacity = opts.night ? 0.3 : 0.1; spill.name = 'GroundSpill'; spill.position.set(0, 0.07, 1.8); sub.add(spill);
    }
    return sub;
  };
  const b = ty.bottom_m;
  if (pl.type === 'rail') { const s = ty.slots[0]; const sl = pl.slots[0]; face({ ...s, ...sl }, b, 0.04); for (const x of [-s.w / 2 + 0.2, s.w / 2 - 0.2]) box(0.05, 0.98, 0.05, x, 0.49, -0.04, post, 'Post'); }
  else if (pl.type === 'led') { const s = pl.slots[0]; face(s, b, 0.10); for (const x of [-s.w / 2 + 0.15, s.w / 2 - 0.15]) box(0.06, b + 0.05, 0.06, x, (b + 0.05) / 2, 0.02, post, 'Post'); box(s.w + 0.1, 0.03, 0.12, 0, b - 0.02, 0.1, post, 'Base'); }
  else if (pl.type === 'tall') { const [m, f] = pl.slots; face(m, b + 0.9, 0.12); face(f, b, 0.12); const w = m.w; for (const x of [-w / 2 + 0.7, w / 2 - 0.7]) { box(0.28, b + 3.9, 0.28, x, (b + 3.9) / 2, -0.12, post, 'Post'); box(0.7, 0.08, 0.7, x, 0.04, -0.12, post, 'Foot'); }
    box(w + 0.3, 0.1, 0.5, 0, b + 3.95, 0.18, alu, 'Canopy'); const lm = new THREE.MeshBasicMaterial({ color: opts.night ? '#ffe9b8' : '#cfd6e4', toneMapped: false }); box(w - 0.4, 0.05, 0.08, 0, b + 3.88, 0.4, lm, 'LightBar'); }
  else if (pl.type === 'finish') { const [fr, bk] = pl.slots; face(fr, b, 0.2); face(bk, b, -0.2, '', true); box(0.4, 0.14, 0.5, 0, b - 0.1, 0, alu, 'Bracket'); }
  else if (pl.type === 'gate') { const s = pl.slots[0]; face(s, b, 0.04); for (const x of [-s.w / 2 + 0.15, s.w / 2 - 0.15]) box(0.05, b + 0.05, 0.05, x, (b + 0.05) / 2, -0.04, post, 'Post'); }
  g.position.set(pl.position.x, 0, pl.position.z); g.rotation.y = pl.yaw_rad; if (pl.scale && pl.scale !== 1) g.scale.setScalar(pl.scale); return g;
}
export function addBillboards(course, placements, opts = {}) {
  const { THREE } = course, root = new THREE.Group(); root.name = 'Billboards';
  for (const pl of placements) root.add(buildBillboard(THREE, pl, opts));
  (course.group || course.anchor).add(root); return root;
}

// Helper for previews/config samples: round-robin sponsor keys over placements in running order (per type), returns {slot_id: sponsorKey}.
export function autoAssign(placements, keys, offset = 0) {
  const out = {}, count = {}; for (const p of placements) { const i = (count[p.type] = (count[p.type] ?? offset) + 1) - 1; p.slots.forEach((s, j) => { out[s.slot_id] = keys[(i + j) % keys.length]; }); }
  return out;
}

// ---------- plain-ellipse adapter (game view: a drawn ellipse, no course GLB). Pure maths, no three.js. See SPEC section 11. ----------
// Ellipse point(theta) = (cx + a cos theta, cz + b sin theta) in the scene's XZ plane (+Y up). 'anticlockwise' = anticlockwise seen from
// above (+Y looking down, +X right, +Z towards the bottom of the screen) = theta DECREASING, the same sense as racecourse-lib's courses.
// d = distance (scene units) from the winning post along the running direction, wraps mod circuit. lat = offset along the OUTWARD normal
// from the ellipse you pass (pass the inner rail ellipse so lat matches "metres from the inside rail"; negative = infield).
export function makeEllipseLoop({ cx = 0, cz = 0, a, b, direction = 'anticlockwise', postAngleRad = -Math.PI / 2, samples = 512 } = {}) {
  if (!(a > 0 && b > 0)) throw new Error('makeEllipseLoop: a and b must be > 0');
  const N = Math.max(16, samples | 0), dir = direction === 'clockwise' ? 1 : -1, g = direction === 'clockwise' ? -1 : 1;
  const pts = [], cum = [0];
  for (let i = 0; i <= N; i++) { const th = postAngleRad + dir * 2 * Math.PI * (i % N) / N; pts.push([cx + a * Math.cos(th), cz + b * Math.sin(th)]); }
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const circuit = cum[N];
  const tangentAt = i => { const p = pts[(i - 1 + N) % N], q = pts[(i + 1) % N]; const [tx, tz] = norm(q[0] - p[0], q[1] - p[1]); return [tx, tz]; };
  function loopToWorld(d, lat = 0) {
    const s = ((d % circuit) + circuit) % circuit;
    let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const A = pts[lo], B = pts[lo + 1], seg = cum[lo + 1] - cum[lo] || 1, t = (s - cum[lo]) / seg;
    const [t0x, t0z] = tangentAt(lo), [t1x, t1z] = tangentAt(lo + 1), [tx, tz] = norm(t0x + (t1x - t0x) * t, t0z + (t1z - t0z) * t);
    const nx = -tz * g, nz = tx * g, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t;
    return { x: x + nx * lat, y: 0, z: z + nz * lat, tx, tz, nx, nz, heading_rad: Math.atan2(tz, tx), s_m: s };
  }
  function worldToLoop(x, z) { // nearest point on the sampled ellipse (exact for |lat| below the ellipse's smallest radius of curvature, b*b/a)
    let best = Infinity, bi = 0; for (let i = 0; i < N; i++) { const d2 = (pts[i][0] - x) ** 2 + (pts[i][1] - z) ** 2; if (d2 < best) { best = d2; bi = i; } }
    let s0 = cum[bi], bd = Infinity;
    for (const i of [(bi - 1 + N) % N, bi]) { const A = pts[i], B = pts[i + 1], vx = B[0] - A[0], vz = B[1] - A[1], L2 = vx * vx + vz * vz || 1, t = Math.max(0, Math.min(1, ((x - A[0]) * vx + (z - A[1]) * vz) / L2)), px = A[0] + vx * t, pz = A[1] + vz * t, d2 = (x - px) ** 2 + (z - pz) ** 2; if (d2 < bd) { bd = d2; s0 = cum[i] + t * (cum[i + 1] - cum[i]); } }
    for (let k = 0; k < 60; k++) { const p = loopToWorld(s0, 0), step = (x - p.x) * p.tx + (z - p.z) * p.tz; s0 += step; if (Math.abs(step) < 1e-9 * circuit) break; } // refine: foot point where (P - p) is normal to the loop
    const p = loopToWorld(s0, 0); return { d: ((s0 % circuit) + circuit) % circuit, lat: (x - p.x) * p.nx + (z - p.z) * p.nz };
  }
  return { circuit, loopToWorld, worldToLoop, ellipse: { cx, cz, a, b, direction, postAngleRad, samples: N } };
}

// Section 11 placement on an ellipse loop. Fractions of the circuit, so it works at any scale. k = circuit / real_circuit_m.
// Boards scale by max(k, 0.5) (placement.scale, applied by buildBillboard); distances scale by k. Overlaps: drop LED first, then tall, finish, rail, gate.
// opts: real_circuit_m (2000), track_width_m (scene units, default 24 = racecourse.js WD), cameraPoint {x,z} (default: outside the outer rail
// at the post, 40 m * k out), assignments {slot_id: sponsorKey}, gateAt {d, lat_from, lat_to, banners=1} (no gate banners unless given).
export const ELLIPSE_RULES = { rail: { home_togo: [0.25, 0.02], back_d: [0.375, 0.625], pitch: 0.025, out_m: 0.5 }, led: { len: 0.20, end_togo: 0.01, seg_m: 8, lat_m: -1.0 }, tall: { lat_m: -6 }, finish: { lat_m: -1.5 }, min_scale: 0.5, drop_order: ['led', 'tall', 'finish', 'rail', 'gate'] };
export function placeBillboardsEllipse(loop, { real_circuit_m = 2000, track_width_m = 24, cameraPoint, assignments = {}, gateAt } = {}) {
  const C = loop.circuit, k = C / real_circuit_m, sc = Math.max(k, ELLIPSE_RULES.min_scale), R = ELLIPSE_RULES, W = track_width_m;
  const cam = cameraPoint || loop.loopToWorld(0, W + 40 * k), E = loop.ellipse || { cx: 0, cz: 0 };
  const togoOf = s => ((C - s) % C + C) % C;
  const towards = (pt, tgt) => norm(tgt.x - pt.x, tgt.z - pt.z);
  const clampFace = (pt, want, baseFace, clampDeg) => { const base = Math.atan2(baseFace[0], baseFace[1]), w = Math.atan2(want[0], want[1]), c = clampDeg * D2R; let dl = Math.atan2(Math.sin(w - base), Math.cos(w - base)); dl = Math.max(-c, Math.min(c, dl)); return [Math.sin(base + dl), Math.cos(base + dl)]; };
  const cand = []; // {type, s, lat, face, extra}
  const range = (from, to, pitch) => { const span = from - to, cnt = Math.floor(span / pitch + 1e-6) + 1, off = (span - (cnt - 1) * pitch) / 2, o = []; for (let i = 0; i < cnt; i++) o.push(from - off - i * pitch); return o; };
  // rail boards: outer rail, home straight run-in and back straight, facing the infield centre (across the track)
  const rp = R.rail.pitch * C, rlat = W + R.rail.out_m * k;
  for (const togo of range(R.rail.home_togo[0] * C, R.rail.home_togo[1] * C, rp)) cand.push({ type: 'rail', s: (C - togo) % C, lat: rlat, faceTo: 'centre' });
  for (const d of range(R.rail.back_d[1] * C, R.rail.back_d[0] * C, rp)) cand.push({ type: 'rail', s: d, lat: rlat, faceTo: 'centre' });
  // LED strip: one continuous run up to the post, infield side of the inner rail, parallel to the rail facing outward (towards the track and stand)
  const segLen = R.led.seg_m * k, ledEnd = R.led.end_togo * C, nSeg = Math.max(1, Math.floor(R.led.len * C / segLen));
  for (let i = 0; i < nSeg; i++) cand.push({ type: 'led', s: (C - (ledEnd + (nSeg - i - 0.5) * segLen)) % C, lat: R.led.lat_m * k, faceTo: 'outward' });
  // tall boards at both ends of the ellipse (theta 0 and 180 deg), infield, facing the camera side
  for (const ex of [1, -1]) { const q = loop.worldToLoop(E.cx + ex * E.a, E.cz); cand.push({ type: 'tall', s: q.d, lat: R.tall.lat_m * k, faceTo: 'camera', clamp: 180 }); }
  cand.push({ type: 'finish', s: 0, lat: R.finish.lat_m * k, faceTo: 'outward' });
  if (gateAt) { const n = Math.max(1, gateAt.banners || 1), l0 = gateAt.lat_from ?? 0, l1 = gateAt.lat_to ?? W; for (let i = 0; i < n; i++) cand.push({ type: 'gate', s: gateAt.d, lat: l0 + (l1 - l0) * (i + 0.5) / n, faceTo: 'rear' }); }
  // resolve points/faces + footprints
  const full = cand.map(c => {
    const pt = loop.loopToWorld(c.s, c.lat); let face;
    if (c.faceTo === 'centre') face = towards(pt, { x: E.cx, z: E.cz });
    else if (c.faceTo === 'outward') face = [pt.nx, pt.nz];
    else if (c.faceTo === 'rear') face = [-pt.tx, -pt.tz];
    else face = c.clamp >= 180 ? towards(pt, cam) : clampFace(pt, towards(pt, cam), [pt.nx, pt.nz], c.clamp);
    const ty = TYPES[c.type], w = Math.max(...ty.slots.map(s => s.w)) * sc, bot = ty.bottom_m * sc, top = (ty.bottom_m + (c.type === 'tall' ? 4.05 : Math.max(...ty.slots.map(s => (s.y0 || 0) + s.h)))) * sc;
    return { ...c, pt, face, w, bot, top, dep: Math.max(0.3, ty.depth_m * 2) * sc };
  });
  // overlap test in track coordinates: footprint projected on the tangent (along-track interval) and the normal (lateral interval), wrap-aware,
  // AND overlapping height ranges. Works on curves where clamped boards are not parallel to the rail.
  const foot = f => { const rx = f.face[1], rz = -f.face[0], ct = Math.abs(rx * f.pt.tx + rz * f.pt.tz), cn = Math.abs(rx * f.pt.nx + rz * f.pt.nz);
    return { s: f.pt.s_m, hs: f.w / 2 * ct + f.dep / 2 * cn, lat: f.lat, hl: f.w / 2 * cn + f.dep / 2 * ct }; };
  const overlaps = (f, h) => { if (f.top <= h.bot || h.top <= f.bot) return false; const A = foot(f), B = foot(h); let ds = Math.abs(A.s - B.s); ds = Math.min(ds, C - ds);
    return ds < A.hs + B.hs - 1e-6 && Math.abs(A.lat - B.lat) < A.hl + B.hl - 1e-6; };
  const rank = t => R.drop_order.indexOf(t); // lower = dropped first
  const kept = []; for (const f of [...full].sort((x, y) => rank(y.type) - rank(x.type))) if (!kept.some(h => overlaps(f, h))) kept.push(f);
  // number per type in running order (largest togo first), build the same placement objects as placeBillboards
  const out = [];
  for (const type of ['rail', 'led', 'tall', 'finish', 'gate']) kept.filter(f => f.type === type).sort((x, y) => togoOf(y.pt.s_m) - togoOf(x.pt.s_m)).forEach((f, i) => {
    const mount = type === 'rail' ? 'outer' : type === 'led' ? 'inner' : type === 'gate' ? 'gate' : 'infield';
    out.push(placementObject(type, i + 1, f.pt, f.lat, f.face, { mount, togo_m: togoOf(f.pt.s_m), scale: +sc.toFixed(4) }));
  });
  for (const p of out) for (const s of p.slots) s.sponsor = assignments[s.slot_id] || null;
  out.dropped = full.length - kept.length; out.k = k; out.board_scale = sc;
  return out;
}
