// node --test tests/   Sport routing post-time decisions (Phase 1.1): single, conflict, multi-confirm, none, missing endpoint.
const test = require("node:test");
const assert = require("node:assert/strict");
const R = require("../assets/routing.js");

function res(extra) {
  return Object.assign({status: "single", channel_ids: ["11"], auto_channel_ids: ["11"], tags: ["AFL"], reasons: {AFL: ["sport is AFL"]},
    candidates: [{channel_id: "11", name: "afl-plays", tags: ["AFL"], reasons: ["AFL: sport is AFL"]}],
    channels: [{id: "11", name: "afl-plays"}], default_channel_id: "99", default_channel_name: "tips", needs_choice: false}, extra || {});
}
function fakeApi(status, body, seen) {
  return async (path, opts) => {
    if (seen) seen.push({path, body: JSON.parse(opts.body)});
    return {status, ok: status < 400, json: async () => body};
  };
}
function ui(answers, calls) {
  return {
    conflict: async (r) => { calls.push("conflict"); return answers.conflict; },
    none: async (r) => { calls.push("none"); return answers.none; },
    confirm: async (ids) => { calls.push("confirm:" + ids.join(",")); return answers.confirm; },
  };
}

test("decide: single, conflict, none, multi-confirm", () => {
  assert.equal(R.decide(res()).kind, "single");
  assert.equal(R.decide(res({needs_choice: true, auto_channel_ids: ["11"]})).kind, "conflict");
  assert.equal(R.decide(res({status: "none", channel_ids: ["99"]})).kind, "none");
  assert.equal(R.decide(res({status: "multiple", channel_ids: ["11", "12"]})).kind, "confirm");
});

test("fromPreview: missing endpoint and routing off send no route", () => {
  assert.equal(R.fromPreview(404, null).state, "unavailable");
  assert.equal(R.fromPreview(405, {}).state, "unavailable");
  assert.equal(R.fromPreview(200, {ok: true, enabled: false}).state, "off");
  assert.equal(R.fromPreview(503, {ok: false, error: "db_busy"}).state, "error");
  assert.equal(R.fromPreview(200, {ok: true, enabled: true, results: []}).state, "ok");
});

test("single: no popup, chip only, route carried", async () => {
  const calls = [], seen = [];
  const out = await R.beforePost({api: fakeApi(200, {ok: true, enabled: true, results: [res()]}, seen), guildId: "5",
    tips: [{sport: "AFL", game_name: "Carlton v Hawthorn", legs: [{player: "X", stat: "Disposals", line: 19.5, game_id: "CD1"}]}],
    ui: ui({}, calls)});
  assert.deepEqual(calls, []);
  assert.deepEqual(out.chips, ["→ #afl-plays"]);
  assert.deepEqual(out.routes[0], {channel_ids: ["11"], tags: ["AFL"], remember: false, source: "single"});
  assert.equal(seen[0].path, "/api/routing/preview");
  assert.equal(seen[0].body.tips[0].legs[0].game_id, "CD1");
});

test("conflict popup: chosen channels and remember travel with the tip", async () => {
  const calls = [];
  const r = res({status: "multiple", needs_choice: true, tags: ["NRL", "NFL"], channel_ids: ["21"], auto_channel_ids: ["21"],
    candidates: [{channel_id: "21", name: "nrl-plays"}, {channel_id: "22", name: "nfl-plays"}]});
  const out = await R.beforePost({api: fakeApi(200, {ok: true, enabled: true, can_admin: true, results: [r]}), guildId: "5",
    tips: [{}], ui: ui({conflict: {ids: ["22"], remember: true}}, calls)});
  assert.deepEqual(calls, ["conflict"]);
  assert.deepEqual(out.routes[0], {channel_ids: ["22"], tags: ["NRL", "NFL"], remember: true, source: "popup"});
  assert.deepEqual(out.chips, ["→ #nfl-plays"]);
});

test("conflict resolved to two channels still asks for the multi-channel confirm", async () => {
  const calls = [];
  const r = res({needs_choice: true, candidates: [{channel_id: "21", name: "a"}, {channel_id: "22", name: "b"}]});
  const out = await R.beforePost({api: fakeApi(200, {ok: true, enabled: true, results: [r]}), guildId: "5", tips: [{}],
    ui: ui({conflict: {ids: ["21", "22"]}, confirm: true}, calls)});
  assert.deepEqual(calls, ["conflict", "confirm:21,22"]);
  assert.deepEqual(out.routes[0].channel_ids, ["21", "22"]);
});

test("post-to-all rule: confirm popup before submitting; cancel stops the post", async () => {
  const calls = [];
  const r = res({status: "multiple", channel_ids: ["11", "12"], channels: [{id: "11", name: "afl-plays"}, {id: "12", name: "all-plays"}]});
  const out = await R.beforePost({api: fakeApi(200, {ok: true, enabled: true, results: [r]}), guildId: "5", tips: [{}],
    ui: ui({confirm: true}, calls)});
  assert.deepEqual(calls, ["confirm:11,12"]);
  assert.deepEqual(out.routes[0], {channel_ids: ["11", "12"], tags: ["AFL"], remember: false, source: "confirm"});
  assert.equal(out.chips[0], "→ #afl-plays, #all-plays");
  const cancelled = await R.beforePost({api: fakeApi(200, {ok: true, enabled: true, results: [r]}), guildId: "5", tips: [{}],
    ui: ui({confirm: null}, [])});
  assert.equal(cancelled.cancelled, true);
});

test("none: default, pick or cancel", async () => {
  const r = res({status: "none", channel_ids: ["99"], candidates: [], tags: []});
  const body = {ok: true, enabled: true, results: [r], all_channels: [{id: "99", name: "tips"}, {id: "13", name: "misc"}]};
  const def = await R.beforePost({api: fakeApi(200, body), guildId: "5", tips: [{}], ui: ui({none: {ids: ["99"], source: "none"}}, [])});
  assert.deepEqual(def.routes[0].channel_ids, ["99"]);
  assert.equal(def.chips[0], "→ #tips");
  const pick = await R.beforePost({api: fakeApi(200, body), guildId: "5", tips: [{}], ui: ui({none: {ids: ["13"], source: "popup"}}, [])});
  assert.equal(pick.chips[0], "→ #misc");
  const cancel = await R.beforePost({api: fakeApi(200, body), guildId: "5", tips: [{}], ui: ui({none: null}, [])});
  assert.equal(cancel.cancelled, true);
});

test("routing off / old TipBot / network error: post exactly as before (no route)", async () => {
  for (const [status, body] of [[404, null], [200, {ok: true, enabled: false}], [503, {ok: false, error: "db_busy"}]]) {
    const out = await R.beforePost({api: fakeApi(status, body), guildId: "5", tips: [{}], ui: ui({}, [])});
    assert.equal(out.routes, null);
    assert.ok(!out.cancelled);
  }
  const net = await R.beforePost({api: async () => { throw new Error("offline"); }, guildId: "5", tips: [{}], ui: ui({}, [])});
  assert.equal(net.routes, null);
  await assert.rejects(R.beforePost({api: async () => { throw {unauth: true}; }, guildId: "5", tips: [{}]}));
});

test("batch: one route per tip, popups only where needed", async () => {
  const calls = [];
  const body = {ok: true, enabled: true, results: [res(), res({needs_choice: true, candidates: [{channel_id: "21", name: "a"}, {channel_id: "22", name: "b"}]})]};
  const out = await R.beforePost({api: fakeApi(200, body), guildId: "5", tips: [{}, {}], ui: ui({conflict: {ids: ["22"]}}, calls)});
  assert.deepEqual(calls, ["conflict"]);
  assert.deepEqual(out.routes.map((r) => r.channel_ids), [["11"], ["22"]]);
});
