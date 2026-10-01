// 6.1c: prop counts merged after paint; one game's roster for the builder.
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../assets/light-data.js");

function detail() {
  return { tips: {
    queued: [{ tip_id: "t1", legs: [{ description: "a" }, { description: "b", line: 19.5 }] }],
    settled: [{ tip_id: "t2", legs: [{ description: "c", current: 30 }] }],
  } };
}

test("prop counts land on the right legs and never remove anything", () => {
  const d = detail();
  const n = L.mergePropCounts(d, { tips: { t1: [{}, { current: 21, emoji: "🟢", status: "live", line: 19.5 }] } });
  assert.equal(n, 1);
  assert.deepEqual(d.tips.queued[0].legs[1], { description: "b", line: 19.5, current: 21, emoji: "🟢", status: "live" });
  assert.deepEqual(d.tips.queued[0].legs[0], { description: "a" });
  assert.equal(d.tips.settled[0].legs[0].current, 30);
  assert.equal(L.mergePropCounts(d, { tips: { t1: [{}, { current: 21 }] } }), 0);  // nothing new
  assert.equal(L.mergePropCounts(d, null), 0);
  assert.equal(L.mergePropCounts({}, { tips: { t1: [] } }), 0);
});

const lean = () => ({ id: 101, aflMatchId: "CD_M1",
  hteam: { name: "Carlton", players: [], ins: [], outs: [] }, ateam: { name: "Hawthorn", players: [], ins: [], outs: [] } });
const roster = { id: 101, hteam: { players: [{ name: "Patrick Cripps" }], ins: [], outs: [] },
                 ateam: { players: [{ name: "James Sicily" }], ins: [{ name: "X" }], outs: [] } };

test("roster endpoint fills only the picked game, once", async () => {
  const g = lean(); const calls = [];
  const out = await L.loadRoster(g, (p) => { calls.push(p); return Promise.resolve({ ok: true, status: 200, data: roster }); });
  assert.equal(out, "roster");
  assert.deepEqual(calls, ["/api/fixtures/roster?game=101"]);
  assert.equal(g.hteam.players[0].name, "Patrick Cripps");
  assert.equal(g.hteam.name, "Carlton");
  assert.equal(g.ateam.ins[0].name, "X");
  assert.equal(await L.loadRoster(g, () => { throw new Error("no second call"); }), "skip");
});

test("older TipBot: roster endpoint missing -> full payload fallback", async () => {
  const g = lean(); const calls = [];
  const full = { games: [{ id: 999, hteam: { players: [{ name: "nope" }] } }, Object.assign({}, roster, { aflMatchId: "CD_M1" })] };
  const out = await L.loadRoster(g, (p) => {
    calls.push(p);
    return Promise.resolve(p.startsWith("/api/fixtures/roster") ? { ok: false, status: 404, data: null } : { ok: true, status: 200, data: full });
  });
  assert.equal(out, "full");
  assert.deepEqual(calls, ["/api/fixtures/roster?game=101", "/api/fixtures"]);
  assert.equal(g.ateam.players[0].name, "James Sicily");
});

test("older TipBot ignoring ?rosters=0: players already there, nothing fetched", async () => {
  const g = lean(); g.hteam.players = [{ name: "Already" }];
  assert.equal(L.needsRoster(g), false);
  assert.equal(await L.loadRoster(g, () => { throw new Error("no fetch"); }), "skip");
});

test("network failure falls back, unauth propagates", async () => {
  const g = lean();
  assert.equal(await L.loadRoster(g, () => Promise.reject(new Error("net"))), "none");
  await assert.rejects(L.loadRoster(lean(), () => Promise.reject({ unauth: true })), (e) => e.unauth === true);
});

test("lean fixtures URL", () => { assert.equal(L.FIXTURES_LEAN, "/api/fixtures?rosters=0"); });
