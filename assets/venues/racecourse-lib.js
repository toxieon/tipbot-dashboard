// racecourse-lib.js: ES module. Pure maths (no three.js needed) + optional three.js builders (pass THREE in).
// COORDINATES (metres, right-handed, three.js convention): origin = winning post on the INNER RAIL line; +X = running direction at the post;
// +Y = up; +Z = to the RIGHT of the running direction (so anticlockwise courses curve towards -Z and the infield is at -Z at the post).
// Lateral offset = metres from the inside rail, measured outwards (towards the outer rail). Distances = metres RUN from the start line
// ('run'), or metres still to go to the winning post ('togo').
const TAU = Math.PI * 2;
const hypot = Math.hypot;

// ---------- preparation ----------
function polyPrep(points) { // [[x,z]...] -> {pts, cum, len}
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return { pts: points, cum, len: cum[cum.length - 1] };
}
export function prepare(def) {
  if (def.__p) return def.__p;
  const main = polyPrep(def.main.points);
  const chutes = {};
  for (const c of def.chutes || []) chutes[c.id] = { ...polyPrep(c.points), def: c };
  return (def.__p = { main, chutes });
}
function at(poly, s, closed) { // point + tangent at arc position s
  const { pts, cum, len } = poly;
  if (closed) s = ((s % len) + len) % len; else s = Math.max(0, Math.min(len, s));
  let lo = 0, hi = cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const a = pts[lo], b = pts[lo + 1], seg = cum[lo + 1] - cum[lo] || 1, t = (s - cum[lo]) / seg;
  return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, tx: (b[0] - a[0]) / seg, tz: (b[1] - a[1]) / seg };
}

// ---------- starts / routes ----------
export function resolveStart(def, ref) {
  const list = def.starts;
  if (ref == null) ref = def.default_start_m;
  if (typeof ref === 'object') return ref;
  return list.find(s => s.id === ref) || list.find(s => s.distance_m === ref) || (() => { throw new Error('unknown start ' + ref); })();
}
// A route = centreline (the measured line) from the start line to the post, as {pts,cum,len}.
export function makeRoute(def, startRef) {
  const P = prepare(def), st = resolveStart(def, startRef), closed = def.main.closed;
  const out = [];
  let rem = st.distance_m;
  if (st.chute) {
    const ch = P.chutes[st.chute], from = ch.len - st.lead_in_m;
    const pa = at(ch, from, false); out.push([pa.x, pa.z]);
    for (let i = 0; i < ch.pts.length; i++) if (ch.cum[i] > from + 1e-6) out.push(ch.pts[i]);
    rem -= st.lead_in_m;
  }
  const M = P.main; let s = st.main_begin_s_m;
  const step = 4;
  const p0 = at(M, s, closed); if (!st.chute) out.push([p0.x, p0.z]);
  for (let d = step; d < rem; d += step) { const p = at(M, s + d, closed); out.push([p.x, p.z]); }
  const pe = at(M, s + rem, closed); out.push([pe.x, pe.z]);
  return polyPrep(out);
}
const routeCache = new WeakMap();
function routeFor(def, startRef) {
  const st = resolveStart(def, startRef); let m = routeCache.get(def); if (!m) routeCache.set(def, m = {});
  return m[st.id] || (m[st.id] = makeRoute(def, st));
}
const outwardSign = def => (def.direction === 'clockwise' ? -1 : 1); // +1: outward = right of travel
// (distance, lateral) -> world.   opts: {start, mode:'run'|'togo'}   d may be outside [0,D] (clamped).
export function distanceToWorld(def, d, lateral = 0, opts = {}) {
  const st = resolveStart(def, opts.start), R = routeFor(def, st);
  const run = opts.mode === 'togo' ? st.distance_m - d : d;
  const p = at(R, run, false);
  const sg = outwardSign(def), nx = -p.tz * sg, nz = p.tx * sg, off = lateral - def.measure_offset_m;
  return { x: p.x + nx * off, y: 0, z: p.z + nz * off, heading_rad: Math.atan2(p.tz, p.tx), run_m: Math.max(0, Math.min(R.len, run)), togo_m: st.distance_m - Math.max(0, Math.min(R.len, run)) };
}
// world -> {distance_m (run), togo_m, lateral_m, off_route_m}. opts {start, hint_m, window_m}. Nearest point on the route centreline; lateral is signed from the inside rail.
export function worldToDistance(def, p, opts = {}) {
  const st = resolveStart(def, opts.start), R = routeFor(def, st), x = p.x, z = p.z;
  let best = Infinity, bs = 0, bl = 0;
  const hint = opts.hint_m, win = opts.window_m ?? 150; // hint_m: expected run distance; needed to pick the right lap when the route overlaps itself (races longer than one circuit)
  for (let i = 0; i < R.pts.length - 1; i++) {
    if (hint != null && Math.abs(R.cum[i] - hint) > win + 8) continue;
    const a = R.pts[i], b = R.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t));
    const qx = a[0] + dx * t, qz = a[1] + dz * t, dd = hypot(x - qx, z - qz);
    if (dd < best) { best = dd; bs = R.cum[i] + t * Math.sqrt(L2); const L = Math.sqrt(L2), sg = outwardSign(def); bl = ((x - qx) * (-dz / L) + (z - qz) * (dx / L)) * sg + def.measure_offset_m; }
  }
  return { distance_m: bs, togo_m: st.distance_m - bs, lateral_m: bl, off_route_m: best };
}
// Barrier stall centres for a start (stall 1 = nearest the inside rail). The start line is the FRONT of the stalls; stalls extend `depth` behind it.
export function barrierStalls(def, startRef, n) {
  const st = resolveStart(def, startRef), B = def.barriers, count = Math.min(n || B.max_stalls, st.stalls_available ?? B.max_stalls), out = [];
  for (let i = 1; i <= count; i++) {
    const lat = B.first_stall_offset_m + (i - 1) * B.spacing_m, w = distanceToWorld(def, 0, lat, { start: st });
    out.push({ stall: i, lateral_offset_m: lat, x: w.x - Math.cos(w.heading_rad) * B.depth_m / 2, y: 0, z: w.z - Math.sin(w.heading_rad) * B.depth_m / 2, heading_rad: w.heading_rad });
  }
  return out;
}
// Distance posts: to-go positions on the inner rail (main loop + chutes). Returns [{togo_m, x,z, label}]
export function distancePosts(def) {
  const P = prepare(def), M = P.main, closed = def.main.closed, every = def.distance_posts.every_m, lbl = def.distance_posts.label_every_m, posts = [];
  const maxTogo = closed ? M.len : def.main.s_post_m;
  for (let k = every; k <= maxTogo + 1e-6; k += every) { const p = at(M, def.main.s_post_m - k, closed); posts.push(post(def, p, k, lbl, null)); }
  for (const c of def.chutes || []) { const ch = P.chutes[c.id]; for (let k = Math.ceil((c.join_back_m + 1) / every) * every; k <= c.join_back_m + ch.len; k += every) { const p = at(ch, ch.len - (k - c.join_back_m), false); posts.push(post(def, p, k, lbl, c.id)); } }
  return posts;
}
function post(def, p, k, lbl, chute) { const sg = outwardSign(def), off = -def.measure_offset_m; return { togo_m: k, x: p.x + -p.tz * sg * off, z: p.z + p.tx * sg * off, label: k % lbl === 0, chute }; }

// ---------- geometry (raw arrays, no three.js) ----------
function tangents(pts, closed) {
  const n = pts.length, T = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closed ? (i - 1 + n - 1) % (n - 1) : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % (n - 1) : Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dz = b[1] - a[1], L = hypot(dx, dz) || 1; T.push([dx / L, dz / L]);
  }
  return T;
}
export function offsetLine(def, pts, closed, lat, y) { // lateral from inside rail
  const T = tangents(pts, closed), sg = outwardSign(def), off = lat - def.measure_offset_m;
  return pts.map((p, i) => [p[0] + -T[i][1] * sg * off, y, p[1] + T[i][0] * sg * off]);
}
class Mesh { constructor() { this.pos = []; this.nor = []; this.idx = []; } get n() { return this.pos.length / 3; } }
function addStrip(M, A, B, closed) { // two polylines of [x,y,z]; normal up
  const base = M.n, n = A.length;
  for (let i = 0; i < n; i++) { M.pos.push(...A[i], ...B[i]); M.nor.push(0, 1, 0, 0, 1, 0); }
  const m = closed ? n - 1 : n - 1;
  for (let i = 0; i < m; i++) { const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3; M.idx.push(a, b, c, b, d, c); }
}
function addBoxTube(M, def, pts, closed, lat, y0, y1, w) { // rectangular rail tube following the polyline
  const L = offsetLine(def, pts, closed, lat, 0), T = tangents(pts, closed), sg = outwardSign(def), base = M.n, hw = w / 2;
  const prof = [[-hw, y0], [hw, y0], [hw, y1], [-hw, y1]]; // (lateral, y)
  L.forEach((p, i) => { const nx = -T[i][1] * sg, nz = T[i][0] * sg; for (let k = 0; k < 4; k++) { const a = prof[k], b = prof[(k + 1) % 4]; /* face normal */ const fx = b[1] - a[1], fy = -(b[0] - a[0]); const fl = hypot(fx, fy) || 1; for (const q of [a, b]) { M.pos.push(p[0] + nx * q[0], q[1], p[2] + nz * q[0]); M.nor.push(nx * fx / fl, fy / fl, nz * fx / fl); } } });
  const m = pts.length - 1;
  for (let i = 0; i < m; i++) for (let k = 0; k < 4; k++) { const a = base + i * 8 + k * 2, b = a + 1, c = a + 8, d = a + 9; M.idx.push(a, c, b, b, c, d); }
}
function addBox(M, cx, cy, cz, sx, sy, sz, yaw) { // oriented box; local x along heading
  const c = Math.cos(yaw), s = Math.sin(yaw), base = M.n;
  const F = [[[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]], [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]], [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]]];
  const rot = (x, z) => [x * c - z * s, x * s + z * c];
  for (const [n, vs] of F) { const nn = rot(n[0], n[2]); const b0 = M.n; for (const v of vs) { const r = rot(v[0] * sx / 2, v[2] * sz / 2); M.pos.push(cx + r[0], cy + v[1] * sy / 2, cz + r[1]); M.nor.push(nn[0], n[1], nn[1]); } M.idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); }
}
const sub = (pts, a, b) => pts.slice(a, b);
// Returns {nodes:[{name, parts:[{material, mesh:{pos,nor,idx}}], extras}], bounds}
export function courseGeometry(def, opts = {}) {
  const P = prepare(def), closed = def.main.closed, W = def.width_m, Y = { surf: 0.03, line: 0.05 };
  const mats = def.style || {};
  const surf = new Mesh(), rin = new Mesh(), rout = new Mesh(), bar = new Mesh(), sl = new Mesh(), fl = new Mesh(), dp = new Mesh();
  const lines = [{ pts: def.main.points, closed, chute: null }, ...(def.chutes || []).map(c => ({ pts: c.points, closed: false, chute: c }))];
  for (const L of lines) {
    addStrip(surf, offsetLine(def, L.pts, L.closed, 0, Y.surf), offsetLine(def, L.pts, L.closed, W, Y.surf), L.closed);
    for (const [M, lat] of [[rin, 0], [rout, W]]) { addBoxTube(M, def, L.pts, L.closed, lat, 0.95, 1.05, 0.08); addBoxTube(M, def, L.pts, L.closed, lat, 0.5, 0.58, 0.06); }
  }
  // start lines + barriers
  for (const st of def.starts) {
    const a = distanceToWorld(def, 0, 0, { start: st }), b = distanceToWorld(def, 0, W, { start: st }), yaw = Math.atan2(b.z - a.z, b.x - a.x);
    addBox(sl, (a.x + b.x) / 2, Y.line, (a.z + b.z) / 2, 0.5, 0.02, hypot(b.x - a.x, b.z - a.z), a.heading_rad);
    const stalls = barrierStalls(def, st), B = def.barriers; if (!stalls.length) continue;
    const h = a.heading_rad;
    for (let i = 0; i <= stalls.length; i++) { // walls between stalls
      const lat = B.first_stall_offset_m - B.spacing_m / 2 + i * B.spacing_m, w = distanceToWorld(def, 0, lat, { start: st });
      addBox(bar, w.x - Math.cos(h) * B.depth_m / 2, 0.85, w.z - Math.sin(h) * B.depth_m / 2, B.depth_m, 1.7, 0.07, h);
    }
    const l0 = B.first_stall_offset_m - B.spacing_m / 2, l1 = l0 + stalls.length * B.spacing_m, w0 = distanceToWorld(def, 0, l0, { start: st }), w1 = distanceToWorld(def, 0, l1, { start: st });
    for (const back of [0, B.depth_m]) addBox(bar, (w0.x + w1.x) / 2 - Math.cos(h) * back, 1.75, (w0.z + w1.z) / 2 - Math.sin(h) * back, 0.12, 0.12, hypot(w1.x - w0.x, w1.z - w0.z), h); // front + rear top bars
    addBox(bar, (w0.x + w1.x) / 2 - Math.cos(h) * B.depth_m, 0.35, (w0.z + w1.z) / 2 - Math.sin(h) * B.depth_m, 0.08, 0.7, hypot(w1.x - w0.x, w1.z - w0.z), h); // low rear rail
  }
  // finish line (post at s_post) + winning post pole
  { const M = P.main, p = at(M, def.main.s_post_m, closed), sg = outwardSign(def), ox = -p.tz * sg, oz = p.tx * sg, h = Math.atan2(p.tz, p.tx);
    const i0 = -def.measure_offset_m, i1 = W - def.measure_offset_m;
    addBox(fl, p.x + ox * (i0 + i1) / 2, Y.line, p.z + oz * (i0 + i1) / 2, 0.6, 0.02, W, h);
    addBox(fl, p.x + ox * (i0 - 1.5), 2.2, p.z + oz * (i0 - 1.5), 0.25, 4.4, 0.25, h); // winning post (infield side)
    addBox(fl, p.x + ox * (i1 + 1.5), 2.2, p.z + oz * (i1 + 1.5), 0.25, 4.4, 0.25, h); }
  for (const q of distancePosts(def)) { const hgt = q.label ? 1.6 : 1.1; addBox(dp, q.x, hgt / 2, q.z, 0.16, hgt, 0.16, 0); }
  // bounds + terrain
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const m of [surf]) for (let i = 0; i < m.pos.length; i += 3) { x0 = Math.min(x0, m.pos[i]); x1 = Math.max(x1, m.pos[i]); z0 = Math.min(z0, m.pos[i + 2]); z1 = Math.max(z1, m.pos[i + 2]); }
  const mg = opts.margin ?? 120, ter = new Mesh();
  ter.pos.push(x0 - mg, -0.4, z0 - mg, x1 + mg, -0.4, z0 - mg, x1 + mg, -0.4, z1 + mg, x0 - mg, -0.4, z1 + mg); ter.nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0); ter.idx.push(0, 3, 2, 0, 2, 1);
  const N = (name, material, m, extras) => ({ name, parts: [{ material, mesh: m }], extras });
  return { bounds: { x0, x1, z0, z1 }, nodes: [
    N('Terrain', 'Terrain', ter), N('Surface', 'Surface', surf, { note: 'running surface between the rails, lateral 0..width_m; chute strips included' }),
    N('RailInner', 'Rail', rin), N('RailOuter', 'Rail', rout), N('Barriers', 'Barrier', bar, { note: 'stall frames for every start option (stall 1 nearest the inside rail)' }),
    N('StartLines', 'Line', sl), N('FinishLine', 'Line', fl), N('DistancePosts', 'Post', dp) ] };
}
export const MATERIALS = { Terrain: ['#16241c', 1], Surface: ['#4b7d44', 0.95], Rail: ['#f2f4f8', 0.5], Barrier: ['#4d68a8', 0.6], Line: ['#ffffff', 0.7], Post: ['#e8ecf6', 0.7] };

// ---------- three.js builders (pass THREE in; r169 tested) ----------
export function buildCourse(def, THREE, opts = {}) {
  const geo = courseGeometry(def, opts), root = new THREE.Group(); root.name = 'Course_' + def.id;
  const colours = { ...Object.fromEntries(Object.entries(MATERIALS).map(([k, v]) => [k, v[0]])), ...(def.style || {}), ...(opts.colours || {}) };
  const mats = {};
  const material = n => mats[n] ||= new THREE.MeshStandardMaterial({ name: n, color: colours[n], roughness: MATERIALS[n][1], metalness: 0, side: n === 'Surface' || n === 'Terrain' ? THREE.FrontSide : THREE.DoubleSide });
  const nodes = {};
  for (const n of geo.nodes) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(n.parts[0].mesh.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n.parts[0].mesh.nor, 3)); g.setIndex(n.parts[0].mesh.idx);
    const m = new THREE.Mesh(g, material(n.parts[0].material)); m.name = n.name; m.receiveShadow = true; m.castShadow = n.name !== 'Terrain' && n.name !== 'Surface'; m.userData = n.extras || {}; root.add(m); nodes[n.name] = m;
  }
  const anchor = new THREE.Object3D(); anchor.name = 'PathOverlayAnchor'; anchor.userData = { note: 'addPathOverlay() parents overlays here' }; root.add(anchor); nodes.PathOverlayAnchor = anchor;
  return { def, THREE, group: root, nodes, anchor, bounds: geo.bounds, dispose() { root.traverse(o => { o.geometry?.dispose(); }); Object.values(mats).forEach(m => m.dispose()); } };
}
// path: [{distance_m, lateral_offset_m}] (run or togo per opts.mode) OR [{x,z}] / [[x,z]] world points.
export function samplePath(def, path, opts = {}) {
  if (path.length && (path[0].x !== undefined || Array.isArray(path[0]))) return path.map(p => Array.isArray(p) ? { x: p[0], y: 0, z: p[1] } : { x: p.x, y: p.y || 0, z: p.z });
  const pts = [...path].sort((a, b) => (opts.mode === 'togo' ? b.distance_m - a.distance_m : a.distance_m - b.distance_m)), step = opts.step_m || 2, out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], span = Math.abs(b.distance_m - a.distance_m), n = Math.max(1, Math.ceil(span / step));
    for (let k = 0; k < n; k++) { const t = k / n, d = a.distance_m + (b.distance_m - a.distance_m) * t, lat = a.lateral_offset_m + (b.lateral_offset_m - a.lateral_offset_m) * (t * t * (3 - 2 * t)); out.push(distanceToWorld(def, d, lat, opts)); }
  }
  const l = pts[pts.length - 1]; out.push(distanceToWorld(def, l.distance_m, l.lateral_offset_m, opts));
  return out;
}
// Draws a coloured ribbon on the track surface + a horse marker. Returns {group, setMarker(distance, mode), dispose}.
export function addPathOverlay(course, path, opts = {}) {
  const { THREE, def } = course, colour = opts.colour ?? '#5B8CFF', w = opts.width_m ?? 0.7, y = opts.y ?? 0.12;
  const P = samplePath(def, path, opts), g = new THREE.Group(); g.name = opts.name || 'PathOverlay';
  const pos = [], idx = [];
  for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], dx = b.x - a.x, dz = b.z - a.z, L = hypot(dx, dz) || 1, nx = -dz / L * w / 2, nz = dx / L * w / 2; pos.push(P[i].x + nx, y, P[i].z + nz, P[i].x - nx, y, P[i].z - nz); if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } }
  const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geom.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false });
  const line = new THREE.Mesh(geom, mat); line.name = 'PathLine'; line.renderOrder = 5; g.add(line);
  const marker = new THREE.Group(); marker.name = 'HorseMarker';
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.9, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }));
  const pin = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 16).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: colour })); pin.position.y = 3.4;
  ring.position.y = y + 0.02; ring.renderOrder = 6; marker.add(ring, pin); g.add(marker);
  const setMarker = (d, mode = opts.mode) => { const p = P[Math.max(0, Math.min(P.length - 1, Math.round((d - (opts.mode === 'togo' ? 0 : 0)) / (opts.step_m || 2))))]; marker.position.set(p.x, 0, p.z); return p; };
  setMarker(path.length && path[0].distance_m !== undefined ? path[0].distance_m - path[0].distance_m : 0);
  (course.anchor || course.group).add(g);
  return { group: g, marker, points: P, setMarker, setMarkerIndex(i) { const p = P[Math.max(0, Math.min(P.length - 1, i))]; marker.position.set(p.x, 0, p.z); return p; }, dispose() { g.removeFromParent(); geom.dispose(); mat.dispose(); } };
}

// Example hypothesised run for any start: drawn wide, settles 3-wide, finishes mid-track. Same shape as Husker's input.
export function sampleHypothesis(def, D) {
  const lim = def.width_m - 1.5;
  return [[0, 9], [0.12, 8], [0.3, 4.5], [0.55, 4.5], [0.8, 6], [1, 9]].map(([f, lat]) => ({ distance_m: Math.round(f * (D - 1)), lateral_offset_m: Math.min(lat, lim) }));
}
