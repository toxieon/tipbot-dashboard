// Game view racetrack (0.71.0): course pick, the field from the race, silks, jockey LOD,
// billboard slots on the named courses and the generic ellipse.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const V = require("../assets/venues/select.js");
const RT = require("../assets/racing-track.js");

const ROOT = path.join(__dirname, "..");
const rc = () => import("../assets/venues/racecourse.js");
const bb = () => import("../assets/venues/billboards-lib.js");

// The slot catalogue TipBot 0.92.21's Sponsor Studio lists for the named courses.
const STUDIO = {
  flemington: [7, 9, 5], caulfield: [7, 8, 5], "moonee-valley": [3, 4, 4], "sandown-hillside": [7, 9, 5]
};
function studioSlots(c) {
  const [rail, led, gate] = STUDIO[c], out = [];
  for (let i = 1; i <= rail; i++) out.push("rail_" + i);
  for (let i = 1; i <= led; i++) out.push("led_" + i);
  out.push("tall_1.main", "tall_1.foot", "tall_2.main", "tall_2.foot", "finish_1.front", "finish_1.back");
  for (let i = 1; i <= gate; i++) out.push("gate_" + i);
  return out.sort();
}

test("courseFor: the four course models by meeting name and alias", () => {
  const cases = {
    "Flemington": "flemington", "FLEMINGTON": "flemington", "Flemington Racecourse": "flemington",
    "Caulfield": "caulfield", "Caulfield Heath": "caulfield",
    "Moonee Valley": "moonee-valley", "The Valley": "moonee-valley", "Ladbrokes Park Moonee Valley": "moonee-valley",
    "Sandown": "sandown-hillside", "Sandown-Hillside": "sandown-hillside", "Sandown Hillside": "sandown-hillside"
  };
  for (const [name, id] of Object.entries(cases)) assert.equal(V.courseFor(name), id, name);
});

test("courseFor: anything else is the generic track", () => {
  for (const name of ["Randwick", "Sandown Lakeside", "Eagle Farm", "", null, undefined, "Valley Forge Downs"]) {
    assert.equal(V.courseFor(name), "", String(name));
  }
});

test("courseFiles: every course has its model and definition in the repo", () => {
  assert.deepEqual([...V.COURSES].sort(), ["caulfield", "flemington", "moonee-valley", "sandown-hillside"]);
  for (const id of V.COURSES) {
    const f = V.courseFiles(id);
    assert.ok(fs.existsSync(path.join(ROOT, f.glb)), f.glb);
    assert.ok(fs.existsSync(path.join(ROOT, f.json)), f.json);
  }
  assert.equal(V.courseFiles("randwick"), null);
  assert.equal(V.venueFor("Horse Racing"), "racecourse");
  assert.equal(V.venueFor("gallops"), "racecourse");
});

test("parseGameName and raceRef find the race and the tipped runners", () => {
  assert.deepEqual(RT.parseGameName("Flemington · R7"), {meeting: "Flemington", race: 7});
  assert.deepEqual(RT.parseGameName("Moonee Valley R10"), {meeting: "Moonee Valley", race: 10});
  assert.deepEqual(RT.parseGameName("Geelong v Collingwood"), {meeting: "", race: null});
  const tips = [
    {sport: "Racing", legs: [{kind: "racing", event_id: "ev1", meeting_name: "Flemington", race_number: 7, runner_number: 4}]},
    {legs: [{kind: "racing", event_id: "ev1", runner_number: 9}, {kind: "racing", event_id: "ev2", runner_number: 1}]}
  ];
  assert.deepEqual(RT.raceRef(tips, "Flemington R7"), {event_id: "ev1", meeting_name: "Flemington", race_number: 7, tipped: [4, 9]});
  // An older bot (no racing fields yet) still gets its course from the game name.
  assert.deepEqual(RT.raceRef([{sport: "Horse Racing", legs: []}], "Caulfield R3"), {event_id: "", meeting_name: "Caulfield", race_number: 3, tipped: []});
  assert.equal(RT.raceRef([{sport: "AFL", legs: [{leg_type: "h2h"}]}], "Geelong v Collingwood"), null);
});

test("fieldFromEvent drops scratchings, sorts by barrier, caps at 24 and keeps only https silks", () => {
  const runners = [];
  for (let n = 1; n <= 30; n++) runners.push({number: n, name: "H" + n, barrier: n, silk_url: n === 2 ? "http://x/s.png" : "https://cdn.example/s" + n + ".png"});
  runners[4].scratched = true;
  runners[5].status = "Late Scratching";
  const field = RT.fieldFromEvent({runners}, [3, 6]);
  assert.equal(field.length, 24);
  assert.ok(!field.some((r) => r.number === 5 || r.number === 6));
  assert.deepEqual(field.slice(0, 2).map((r) => r.barrier), [1, 2]);
  assert.equal(field.find((r) => r.number === 3).tipped, true);
  assert.equal(field.find((r) => r.number === 2).silk_url, "");
  assert.match(field[0].colour, /^#[0-9A-F]{6}$/);
});

test("sameField notices a scratching; silkPath only proxies https silks", () => {
  const a = RT.fieldFromEvent({runners: [{number: 1, barrier: 1}, {number: 2, barrier: 2}]}, []);
  const b = RT.fieldFromEvent({runners: [{number: 1, barrier: 1}, {number: 2, barrier: 2, scratched: true}]}, []);
  assert.equal(RT.sameField(a, a.slice()), true);
  assert.equal(RT.sameField(a, b), false);
  assert.equal(RT.silkPath("https://cdn.example/a b.png"), "/api/racing/silk?url=" + encodeURIComponent("https://cdn.example/a b.png"));
  assert.equal(RT.silkPath("javascript:alert(1)"), "");
});

test("legendHtml escapes runner names and marks the tip", () => {
  const html = RT.legendHtml({meeting_name: "Flemington", race_number: 7}, {distance: 1200},
    [{number: 4, name: "<b>Bold</b>", barrier: 2, colour: "#E5484D", silk_url: "", tipped: true}]);
  assert.match(html, /Flemington R7/);
  assert.match(html, /1200m · 1 runners/);
  assert.match(html, /&lt;b&gt;Bold&lt;\/b&gt;/);
  assert.match(html, /fl-rr-tip/);
});

test("jockey: Cinna's LOD0 / LOD1 files ship, LOD1 on phones or fields over 8", async () => {
  const {RIDER, useLod1} = await rc();
  for (const f of ["jockey.glb", "jockey-lod1.glb", "jockey-silk.js"]) assert.ok(fs.existsSync(path.join(ROOT, "assets/venues/riders", f)), f);
  assert.deepEqual(RIDER.seat, [0, 2.05, -0.05]);
  assert.equal(RIDER.scale, 1.3);
  assert.match(RIDER.url, /riders\/jockey\.glb$/);
  assert.equal(useLod1(8, RIDER, false), false);
  assert.equal(useLod1(9, RIDER, false), true);
  assert.equal(useLod1(4, RIDER, true), true);
  assert.equal(useLod1(20, Object.assign({}, RIDER, {lod1Url: ""}), false), false);
});

test("jockey silk helpers: gallop clip follows the horse's phase", async () => {
  const {syncGallop, FALLBACK_SILK} = await import("../assets/venues/riders/jockey-silk.js");
  assert.equal(FALLBACK_SILK, "#5E6E8C");
  const action = {time: 0, getClip: () => ({duration: 0.5712})};
  syncGallop(action, Math.PI);
  assert.ok(Math.abs(action.time - 0.2856) < 1e-9);
  syncGallop(action, -Math.PI / 2);
  assert.ok(Math.abs(action.time - 0.4284) < 1e-9);
});

test("generic ellipse billboards: Cinna's ellipse mapping, post at the stand, spec slot ids", async () => {
  const {billboardPlacements, GENERIC_LOOP} = await rc();
  assert.deepEqual([GENERIC_LOOP.a, GENERIC_LOOP.b, GENERIC_LOOP.direction], [248, 98, "clockwise"]);
  const pl = billboardPlacements(null);
  const ids = pl.filter((p) => p.type !== "led").flatMap((p) => p.slots.map((s) => s.slot_id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(pl.map((p) => p.id)).size, pl.length, "board nodes stay unique");
  // The LED strip sells as 6 runs: consecutive segments share a slot, in running order.
  const led = pl.filter((p) => p.type === "led").sort((a, b) => a.n - b.n).map((p) => p.slots[0].slot_id);
  assert.ok(led.length > 6);
  assert.deepEqual([...new Set(led)], ["led_1", "led_2", "led_3", "led_4", "led_5", "led_6"]);
  for (let i = 1; i < led.length; i++) assert.ok(Number(led[i].slice(4)) - Number(led[i - 1].slice(4)) <= 1 && led[i] >= led[i - 1]);
  for (const id of ids) assert.match(id, /^(rail|led|tall|finish)_\d+(\.(main|foot|front|back))?$/);
  const fin = pl.find((p) => p.type === "finish");
  assert.ok(fin.position.z > 90 && Math.abs(fin.position.x) < 1e-6, "winning post on the stand side");
  assert.equal(pl.filter((p) => p.type === "tall").length, 2);
  assert.deepEqual(pl.find((p) => p.type === "led").slots[0].px, [1920, 120]);
});

test("ledRuns splits a strip into even consecutive runs", async () => {
  const {ledRuns} = await rc();
  assert.deepEqual(ledRuns(12, 6), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);
  assert.deepEqual(ledRuns(4, 6), [1, 2, 3, 4]);
  const r = ledRuns(50, 6), counts = [1, 2, 3, 4, 5, 6].map((k) => r.filter((x) => x === k).length);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, counts.join(","));
});

test("named course billboards match the Sponsor Studio slot list", async () => {
  const {billboardPlacements} = await rc();
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/racecourses/billboards.json"), "utf8")).courses;
  for (const id of Object.keys(STUDIO)) {
    const def = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/racecourses/courses", id + ".json"), "utf8"));
    const pl = billboardPlacements({def, rules: rules[id].rules, start_m: rules[id].start_m});
    assert.deepEqual(pl.flatMap((p) => p.slots.map((s) => s.slot_id)).sort(), studioSlots(id), id);
  }
});

const FOLLOWER = ["rooftop_A", "rooftop_B", "infield_C"];
test("billboard-slots.json (TipBot's Studio list) is exactly what each track builds", async () => {
  const {billboardPlacements} = await rc();
  const shared = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/racecourses/billboard-slots.json"), "utf8"));
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/racecourses/billboards.json"), "utf8")).courses;
  const follower = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/billboards/placements.json"), "utf8")).placements.map((p) => p.name);
  assert.deepEqual(follower, FOLLOWER);
  const uniq = (pl) => [...new Set(pl.flatMap((p) => p.slots.map((s) => s.slot_id)))];
  assert.deepEqual(shared.courses.generic, uniq(billboardPlacements(null)).concat(FOLLOWER));
  for (const id of Object.keys(STUDIO)) {
    const def = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/racecourses/courses", id + ".json"), "utf8"));
    assert.deepEqual(shared.courses[id], uniq(billboardPlacements({def, rules: rules[id].rules, start_m: rules[id].start_m})).concat(FOLLOWER), id);
  }
});

// Project infield_C's box and the parade field (12 runners, 3 lanes) through the
// Grandstand camera at the 390 px card's aspect; screen rects must never meet.
async function boardClearOfField(path, spot, secs) {
  const T = await import("../assets/vendor/three/three.module.min.js");
  const {RACECOURSE_CAMERAS, paradeStart} = await rc();
  const c = RACECOURSE_CAMERAS[0], cam = new T.PerspectiveCamera(c.fov, 780 / 496, 0.5, 2000);
  cam.position.fromArray(c.pos); cam.lookAt(...c.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  // Anything behind the camera (or past the far plane) is off screen: an empty rect.
  const rect = (pts) => pts.map((p) => new T.Vector3(...p).project(cam)).reduce((r, v) =>
    Math.abs(v.z) > 1 || r[0] === 9 && r[2] === 9 ? [9, 9, 9, 9]
      : [Math.min(r[0], v.x), Math.min(r[1], v.y), Math.max(r[2], v.x), Math.max(r[3], v.y)], [8, 8, -8, -8]);
  const cs = Math.cos(spot.rotationY), sn = Math.sin(spot.rotationY), corners = [];
  for (const lx of [-6.45, 6.45]) for (const lz of [-3.5, 1.9]) for (const y of [0, 10.1])
    corners.push([spot.x + lx * cs + lz * sn, y, spot.z - lx * sn + lz * cs]);
  const board = rect(corners), lead = paradeStart(path);
  for (let t = 0; t <= secs; t += 0.5) for (let i = 0; i < 12; i++) for (const lane of [0.22, 0.48, 0.74]) {
    const p = path.place(lead + 9 * t - i * 5.6, path.width * lane);
    const h = rect([[p.x - 2.5, 0, p.z - 2.5], [p.x + 2.5, 6, p.z + 2.5], [p.x + 2.5, 0, p.z - 2.5], [p.x - 2.5, 6, p.z + 2.5]]);
    if (board[0] < h[2] && h[0] < board[2] && board[1] < h[3] && h[1] < board[3]) return {t, board};
  }
  return null;
}
const BOARD_BOX = [[-6.45, 6.45], [-0.05, 10.1], [-3.5, 1.9]];   // infield_C GLB bounds
function boardBlocks(spot, from, to) {
  const cs = Math.cos(spot.rotationY), sn = Math.sin(spot.rotationY);
  const loc = (p) => { const dx = p[0] - spot.x, dz = p[2] - spot.z; return [dx * cs - dz * sn, p[1], dx * sn + dz * cs]; };
  const a = loc(from), b = loc(to); let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const [lo, hi] = BOARD_BOX[i], d = b[i] - a[i];
    if (Math.abs(d) < 1e-9) { if (a[i] < lo || a[i] > hi) return false; continue; }
    let u = (lo - a[i]) / d, v = (hi - a[i]) / d; if (u > v) [u, v] = [v, u];
    t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) return false;
  }
  return true;
}
// The board in front of a parading horse (camera -> horse ray through the board).
async function boardHidesParade(path, spot, secs) {
  const {RACECOURSE_CAMERAS, paradeStart} = await rc(), c = RACECOURSE_CAMERAS[0], lead = paradeStart(path);
  for (let t = 0; t <= secs; t += 0.5) for (let i = 0; i < 12; i++) for (const lane of [0.22, 0.48, 0.74]) {
    const p = path.place(lead + 9 * t - i * 5.6, path.width * lane);
    for (const y of [1, 3]) if (boardBlocks(spot, c.pos, [p.x, y, p.z])) return {t, i, lane};
  }
  return null;
}
async function boardOnScreen(spot, W, H) {
  const T = await import("../assets/vendor/three/three.module.min.js");
  const {RACECOURSE_CAMERAS} = await rc(), { effectiveFov } = await import("../assets/mcg/cameras.js"), c = RACECOURSE_CAMERAS[0];
  const cam = new T.PerspectiveCamera(effectiveFov(c, W / H), W / H, 0.1, 1600);
  cam.position.fromArray(c.pos); cam.lookAt(...c.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const cs = Math.cos(spot.rotationY), sn = Math.sin(spot.rotationY), xs = [], ys = [];
  for (const lx of BOARD_BOX[0]) for (const y of BOARD_BOX[1]) for (const lz of BOARD_BOX[2]) {
    const v = new T.Vector3(spot.x + lx * cs + lz * sn, y, spot.z - lx * sn + lz * cs).project(cam);
    xs.push((v.x + 1) / 2 * W); ys.push((1 - v.y) / 2 * H);
  }
  return {left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys)};
}
const insideRail = (pts, x, z) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
};

test("infield board: inside the rail and never in front of the parade field from the Grandstand camera", async () => {
  const {infieldSpot, coursePath, courseFit, genericPath, INFIELD_BOARD, NAMED_BOARD_SCALE} = await rc();
  assert.ok(NAMED_BOARD_SCALE > 1);
  for (const id of Object.keys(STUDIO)) {
    const def = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/racecourses/courses", id + ".json"), "utf8"));
    const fit = courseFit(def), p = coursePath(def, fit), spot = infieldSpot(p, INFIELD_BOARD.named);
    assert.deepEqual([spot.x, spot.z], [INFIELD_BOARD.named.x, INFIELD_BOARD.named.z], id + " uses the preferred spot");
    assert.ok(insideRail(p.points, spot.x, spot.z), id + " infield_C inside the rail");
    assert.equal(await boardClearOfField(p, spot, 170), null, id + ": clear for a whole lap");
    assert.ok(fit.s * NAMED_BOARD_SCALE >= 0.6, id + " boards at least 0.6 x real size");
  }
  // Generic loop (0.72.0): horses may pass behind the board, never be hidden by it; the
  // board sits in the 390 px hero (sim-race leader/tipped horse: tests/sim_race.test.js).
  const g = genericPath(), gs = infieldSpot(g, INFIELD_BOARD.generic);
  assert.ok(insideRail(g.points, gs.x, gs.z), "generic infield_C inside the rail");
  assert.equal(await boardHidesParade(g, gs, 170), null, "generic: never in front of the parade for a lap");
  const r = await boardOnScreen(gs, 390, 248);
  assert.ok(r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 248, "generic: whole board in the 390 px hero " + JSON.stringify(r));
});

test("billboards: patches matched by prefix keep the LED's own emissive, frames merge", async () => {
  const T = await import("../assets/vendor/three/three.module.min.js");
  const {buildBillboard, placeBillboardsEllipse, makeEllipseLoop} = await bb();
  const {bakeFrames} = await rc();
  const pl = placeBillboardsEllipse(makeEllipseLoop({a: 248, b: 98}), {track_width_m: 24});
  const root = new T.Group();
  pl.forEach((p) => root.add(buildBillboard(T, p, {})));
  const before = [];
  root.traverse((n) => { if (n.isMesh) before.push(n); });
  const patches = before.filter((n) => /^SponsorPatch/.test(n.name));
  assert.ok(patches.every((n) => n.userData.slot_id));
  const led = patches.find((n) => /^led_/.test(n.userData.slot_id));
  assert.equal(led.material.toneMapped, false);
  const merged = bakeFrames(root);
  const after = [];
  root.traverse((n) => { if (n.isMesh) after.push(n); });
  assert.ok(merged > patches.length, "frames were merged");
  assert.ok(after.length <= patches.length + 6, `${after.length} meshes left for ${patches.length} faces`);
  assert.equal(after.filter((n) => /^SponsorPatch/.test(n.name)).length, patches.length);
});

test("the racecourse wires slots to the scene and Game view passes them through", () => {
  const src = fs.readFileSync(path.join(ROOT, "assets/venues/racecourse.js"), "utf8");
  assert.match(src, /\/\^SponsorPatch\//);
  assert.match(src, /setBillboards/);
  assert.doesNotMatch(src, /emissiveIntensity\s*=/, "never overrides a board's emissive intensity");
  const page = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(page, /handle\.setBillboards/);
  assert.match(page, /fliveBillboards\(/);
});

test("named board sizes: rail, LED and tall at least 1.35 x, finish 1.6 x, gate 1:1, nothing crosses a rail or overlaps", async () => {
  const { billboardPlacements, scaleNamedBoards, boardFootprint, NAMED_BOARD_SCALES, NAMED_BOARD_MIN } = await rc();
  for (const t of ["rail", "led", "tall"]) assert.ok(NAMED_BOARD_SCALES[t] >= NAMED_BOARD_MIN && NAMED_BOARD_MIN === 1.35, t);
  assert.equal(NAMED_BOARD_SCALES.finish, 1.6);
  assert.equal(NAMED_BOARD_SCALES.gate, 1);
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/racecourses/billboards.json"), "utf8")).courses;
  const apart = (A, B) => {   // separating axis on two rectangles (corner order 0,1,3,2)
    for (const P of [A, B]) for (let i = 0; i < 4; i++) {
      const o = [0, 1, 3, 2], a = P[o[i]], b = P[o[(i + 1) % 4]], n = [b[1] - a[1], a[0] - b[0]], l = Math.hypot(...n);
      const pa = A.map((c) => (c[0] * n[0] + c[1] * n[1]) / l), pb = B.map((c) => (c[0] * n[0] + c[1] * n[1]) / l);
      if (Math.max(...pa) <= Math.min(...pb) + 0.01 || Math.max(...pb) <= Math.min(...pa) + 0.01) return true;
    }
    return false;
  };
  for (const id of Object.keys(STUDIO)) {
    const def = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/racecourses/courses", id + ".json"), "utf8"));
    const placed = scaleNamedBoards(def, billboardPlacements({ def, rules: rules[id].rules, start_m: rules[id].start_m }));
    const fp = placed.map((p) => boardFootprint(def, p)), W = def.width_m;
    placed.forEach((p, i) => {
      assert.equal(p.scale || 1, NAMED_BOARD_SCALES[p.type], `${id} ${p.id} scale`);
      const lat = fp[i].lat;
      if (!lat) return;   // gate banners sit behind the stalls (unchanged)
      const lo = Math.min(...lat), hi = Math.max(...lat);
      if (p.type === "rail") assert.ok(lo > W - 0.5 && hi < W + 0.5, `${id} ${p.id} on the outer rail fence (${lo.toFixed(2)}..${hi.toFixed(2)})`);
      else assert.ok(hi < 0, `${id} ${p.id} stays inside the inside rail (${hi.toFixed(2)} m)`);
    });
    // Gate banners are Cinna's (unchanged in 0.72.0); a short last banner can butt into its
    // neighbour (Moonee Valley's 3-stall gate_4), so gate pairs are left to her.
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++)
      if (placed[i].type !== "gate" || placed[j].type !== "gate") assert.ok(apart(fp[i].pts, fp[j].pts), `${id}: ${placed[i].id} overlaps ${placed[j].id}`);
  }
});

test("stand-top boards fit the 390 px hero: 12 px clear at the top and clear of the back button", async () => {
  const T = await import("../assets/vendor/three/three.module.min.js");
  const { RACECOURSE_CAMERAS, ROOFTOP_NUDGE } = await rc();
  const { effectiveFov } = await import("../assets/mcg/cameras.js");
  const pl = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/billboards/placements.json"), "utf8")).placements;
  const c = RACECOURSE_CAMERAS[0];
  assert.equal(c.id, "broadcast");   // the default camera on every course (the stand is shared)
  for (const [W, H] of [[390, 248], [430, 270]]) {
    const cam = new T.PerspectiveCamera(effectiveFov(c, W / H), W / H, 0.1, 1600);
    cam.position.fromArray(c.pos); cam.lookAt(...c.look); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const rects = {};
    for (const name of ["rooftop_A", "rooftop_B"]) {
      const p = pl.find((q) => q.name === name), n = ROOFTOP_NUDGE[name], k = p.scale;
      const x0 = p.position[0] + n[0], y0 = p.position[1] + n[1], z0 = p.position[2] + n[2];
      const cs = Math.cos(p.rotationY), sn = Math.sin(p.rotationY), xs = [], ys = [];
      // Rooftop GLB bounds: 21 m wide, 21.7 m tall over its base, -5.6..0.5 m deep (x scale).
      for (const lx of [-10.5, 10.5]) for (const y of [0, 21.7]) for (const lz of [-5.6, 0.5]) {
        const v = new T.Vector3(x0 + (lx * cs + lz * sn) * k, y0 + y * k, z0 + (-lx * sn + lz * cs) * k).project(cam);
        xs.push((v.x + 1) / 2 * W); ys.push((1 - v.y) / 2 * H);
      }
      const r = rects[name] = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys) };
      assert.ok(r.top >= 12, `${name} at ${W}px: ${r.top.toFixed(1)} px from the top`);
      assert.ok(r.left > 50 || r.top > 50, `${name} at ${W}px: under the back button`);
      assert.ok(r.right < W, `${name} at ${W}px: inside the right edge`);
      assert.ok(y0 < p.position[1] && y0 >= p.position[1] - 2.5, `${name} about 2 m lower`);
    }
    assert.ok(rects.rooftop_A.right < rects.rooftop_B.left || rects.rooftop_B.right < rects.rooftop_A.left, "side by side");
  }
});

test("published view: empty rail, tall and finish panels show the dark LED backing", () => {
  const src = fs.readFileSync(path.join(ROOT, "assets/venues/racecourse.js"), "utf8");
  assert.match(src, /EMPTY_BACKING = 0x0d1419/);
  assert.match(src, /DARK_EMPTY = \/\^\(rail\|tall\|finish\)_\//);
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /YOUR LOGO HERE/i, "the placeholder is Sponsor Studio's, not the published view's");
});
