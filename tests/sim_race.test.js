// Simulated race after the jump (0.72.0): finish order (results > model rank > barrier),
// the jump, the run maths, and where the run sits on the named courses and the generic loop.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const RT = require("../assets/racing-track.js");

const ROOT = path.join(__dirname, "..");
const sim = () => import("../assets/venues/sim-race.js");
const rc = () => import("../assets/venues/racecourse.js");
const lib = () => import("../assets/venues/racecourse-lib.js");
const COURSES = ["flemington", "caulfield", "moonee-valley", "sandown-hillside"];
const courseDef = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, "assets/venues/racecourses/courses", id + ".json"), "utf8"));

function event(extra = {}) {
  return Object.assign({
    id: "evt-1", status: "Open", distance: 1200, start_time: "2026-11-10T05:00:00Z",
    runners: [
      { id: "a", number: 1, name: "One", barrier: 5 },
      { id: "b", number: 2, name: "Two", barrier: 2 },
      { id: "c", number: 3, name: "Three", barrier: 1, scratched: true },
      { id: "d", number: 4, name: "Four", barrier: 3 },
      { id: "e", number: 5, name: "Five", barrier: 4 }
    ]
  }, extra);
}
const AFTER = Date.parse("2026-11-10T05:01:00Z"), BEFORE = Date.parse("2026-11-10T04:59:00Z");

test("finish order: barrier order without a result or model rank; scratchings never run", () => {
  const ev = event(), field = RT.fieldFromEvent(ev, []);
  assert.deepEqual(RT.raceOrder(ev, field), { order: [2, 4, 5, 1], source: "barrier" });
});

test("finish order: the With-price model rank when TipBot sends it (unranked runners behind)", () => {
  const ev = event();
  ev.runners[0].model_rank = 2; ev.runners[3].model_rank = 1; ev.runners[2].model_rank = 3;  // the scratched one is ranked too
  const o = RT.raceOrder(ev, RT.fieldFromEvent(ev, []));
  assert.deepEqual(o, { order: [4, 1, 2, 5], source: "model" });
});

test("finish order: results win over the model, by runner number, runner id or the runner's own result", () => {
  const ev = event({ results: [{ runner_id: "e", position: 1 }, { runner_number: 2, position: 2 }] });
  ev.runners[0].model_rank = 1;
  ev.runners[3].result = { position: 3 };
  assert.deepEqual(RT.raceOrder(ev, RT.fieldFromEvent(ev, [])), { order: [5, 2, 4, 1], source: "results" });
});

test("the jump: start time or a post-jump status; abandoned never runs", () => {
  assert.equal(RT.jumped(event(), BEFORE), false);
  assert.equal(RT.jumped(event(), AFTER), true);
  assert.equal(RT.jumped(event({ status: "Closed" }), BEFORE), true);
  assert.equal(RT.jumped(event({ status: "Interim" }), BEFORE), true);
  assert.equal(RT.jumped(event({ status: "Abandoned" }), AFTER), false);
  const ev = event(), field = RT.fieldFromEvent(ev, []);
  assert.deepEqual(RT.simFromEvent(ev, field, BEFORE), { phase: "parade", jumpAt: Date.parse(ev.start_time) });
  const s = RT.simFromEvent(ev, field, AFTER);
  assert.equal(s.phase, "race");
  assert.equal(s.distance, 1200);
  assert.deepEqual(s.order, [2, 4, 5, 1]);
  assert.equal(s.key, "evt-1|1200|barrier|2.4.5.1");
  assert.equal(RT.simFromEvent(ev, [], AFTER).phase, "parade");
  assert.match(RT.raceBarHtml(s), /Barrier order.*Replay/);
  assert.equal(RT.raceBarHtml({ phase: "parade" }), "");
});

test("run maths: gates, monotone progress, exact finish order, pulled up in order, same race on replay", async () => {
  const { racePlan } = await sim();
  const order = [3, 0, 5, 1, 4, 2], stalls = [0.75, 2.25, 3.75, 5.25, 6.75, 8.25];
  const p = racePlan({ distance: 1400, order, stalls, seed: 42 });
  for (let i = 0; i < 6; i++) {
    const a = p.at(i, 0);
    assert.equal(a.d, 0);
    assert.equal(a.lat, stalls[i], "breaks from its own stall");
    let prev = -1;
    for (let t = 0; t <= p.duration; t += 0.05) {
      const q = p.at(i, t);
      assert.ok(q.d >= prev - 1e-9, `runner ${i} never goes backwards at ${t}`);
      prev = q.d;
    }
    assert.ok(Math.abs(p.at(i, p.finishAt[i]).d - 1400) < 1e-6, "passes the post at its finish time");
  }
  for (let k = 1; k < order.length; k++) assert.ok(p.finishAt[order[k]] > p.finishAt[order[k - 1]], "finishes in order");
  // When the winner is at the post nobody is past it; after the line the field stays in order.
  const tw = p.finishAt[order[0]];
  for (const i of order.slice(1)) assert.ok(p.at(i, tw).d < 1400);
  const end = order.map((i) => p.at(i, p.duration).d);
  for (let k = 1; k < end.length; k++) assert.ok(end[k] < end[k - 1]);
  assert.equal(p.leader(p.duration), order[0]);
  // Real pace at 2x playback: 1400 m in roughly 40-45 s.
  assert.ok(tw > 40 && tw < 46, String(tw));
  const again = racePlan({ distance: 1400, order, stalls, seed: 42 });
  assert.deepEqual(again.finishAt, p.finishAt);
  // Mid-race the order isn't simply the finish order (a bounded reshuffle).
  const mid = order.slice().sort((a, b) => p.at(b, tw / 2).d - p.at(a, tw / 2).d);
  assert.notDeepEqual(mid, order);
});

test("named courses: the start for the distance, the break at the barrier stalls, the post at the end", async () => {
  const { raceTrack, startFor, coursePath, courseFit } = await rc();
  const { barrierStalls } = await lib();
  for (const id of COURSES) {
    const def = courseDef(id), fit = courseFit(def), track = raceTrack({ def, fit }, coursePath(def, fit));
    for (const st of def.starts) assert.equal(startFor(def, st.distance_m).id, st.id);
    const info = track.start(1200);
    assert.equal(info.distance, startFor(def, 1200).distance_m);
    const st = def.starts.find((s) => s.id === info.start);
    // Stall b's centre sits half a stall depth behind the start line on its own lateral.
    const stalls = barrierStalls(def, st);
    for (const b of [1, 4, stalls.length]) {
      const lat = track.stallLat(b), w = track.toWorld(0, lat), s = stalls[b - 1];
      assert.equal(lat, s.lateral_offset_m);
      const fx = (s.x + Math.cos(s.heading_rad) * def.barriers.depth_m / 2 + fit.dx) * fit.s;
      const fz = fit.outerZ + (s.z + Math.sin(s.heading_rad) * def.barriers.depth_m / 2 + fit.dz) * fit.s;
      assert.ok(Math.hypot(w.x - fx, w.z - fz) < 1e-6, `${id} stall ${b}`);
    }
    // The route ends at the post, and the pull-up carries on from there without a jump.
    const atPost = track.toWorld(info.distance, 2), past = track.toWorld(info.distance + 0.5, 2);
    assert.ok(Math.hypot(atPost.x - past.x, atPost.z - past.z) < 2 * fit.s + 0.5, `${id} post continuity`);
    // Neighbouring stalls are wider apart than a race-scale horse.
    assert.ok(def.barriers.spacing_m * fit.s >= 0.9 * track.raceScale - 1e-9, id);
  }
  const fl = courseDef("flemington");
  assert.equal(startFor(fl, 1300).id, "d1200");   // nearest start when the distance has none
});

test("generic loop: the race starts `distance` metres before the post and ends at it", async () => {
  const { raceTrack, genericPath, genericPost } = await rc();
  const p = genericPath(), track = raceTrack(null, p), post = genericPost(p);
  assert.deepEqual(track.start(1600), { distance: 1600, start: "generic-1600" });
  const end = track.toWorld(1600, 0), want = p.place(post, 0);
  assert.ok(Math.hypot(end.x - want.x, end.z - want.z) < 1e-6);
  assert.ok(Math.abs(end.x) < 3 && end.z > 90, "post in front of the stand");
  const s0 = track.toWorld(0, 0), w0 = p.place(post - 1600, 0);
  assert.ok(Math.hypot(s0.x - w0.x, s0.z - w0.z) < 1e-6);
  assert.equal(track.stallLat(3), 3.75);
});
