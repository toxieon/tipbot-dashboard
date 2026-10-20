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

// ── Settings → Channels: tag suggestions from channel names (job 11) ─────────
function settingsPayload(extra) {
  return Object.assign({ok: true, enabled: true, can_admin: true, default_channel_id: "99", multi_sport_mode: "ask", memory: [],
    channels: [{id: "99", name: "tips"}, {id: "11", name: "afl-tips"}, {id: "12", name: "nrl-multis"}, {id: "13", name: "🏇racing"}, {id: "14", name: "general"}],
    tags: [
      {tag: "AFL", label: "AFL", enabled: true, channel_ids: [], keywords: "", priority: 10, mode: "ask"},
      {tag: "NRL", label: "NRL", enabled: true, channel_ids: [], keywords: "", priority: 10, mode: "ask"},
      {tag: "RACING", label: "Racing", enabled: true, channel_ids: [], keywords: "", priority: 10, mode: "ask"},
      {tag: "NBA", label: "NBA", enabled: true, channel_ids: [], keywords: "", priority: 10, mode: "ask"},
    ],
    suggestions: [
      {tag: "AFL", channel_id: "11", channel_name: "afl-tips", score: 0.95, reason: "channel name contains 'afl'"},
      {tag: "NRL", channel_id: "12", channel_name: "nrl-multis", score: 0.9, reason: "channel name contains 'nrl'"},
      {tag: "RACING", channel_id: "13", channel_name: "🏇racing", score: 0.9, reason: "channel name contains 'racing'"},
    ]}, extra || {});
}

test("suggestions: grouped per tag, best first, at most 3, nothing for tags without a match", () => {
  const d = settingsPayload({suggestions: [
    {tag: "AFL", channel_id: "14", score: 0.3, reason: "weak"},
    {tag: "AFL", channel_id: "11", score: 0.95, reason: "channel name contains 'afl'"},
    {tag: "AFL", channel_id: "12", score: 0.4}, {tag: "AFL", channel_id: "13", score: 0.35}, {tag: "AFL", channel_id: "11", score: 0.1},
    {tag: "NRL", channel_id: "12", score: 0.9},
  ]});
  const s = R.pendingSuggestions(d);
  assert.deepEqual(Object.keys(s).sort(), ["AFL", "NRL"]);
  assert.deepEqual(s.AFL.map((x) => x.channel_id), ["11", "12", "13"], "sorted by score, duplicates dropped, capped at 3");
  assert.equal(s.AFL[0].name, "afl-tips");
  assert.equal(s.AFL[0].reason, "channel name contains 'afl'");
  assert.equal(s.NBA, undefined);
});

test("suggestions: never the default channel, an already-mapped channel, an unknown channel or a deleted tag", () => {
  const d = settingsPayload({suggestions: [
    {tag: "AFL", channel_id: "99", score: 1}, {tag: "AFL", channel_id: "404", score: 1}, {tag: "GOLF", channel_id: "11", score: 1},
    {tag: "NRL", channel_id: "12", score: 1}, {tag: "RACING", channel_id: "13", score: 1},
  ]});
  d.tags[1].channel_ids = ["12"];
  assert.deepEqual(R.pendingSuggestions(d, ["RACING"]), {});
  assert.deepEqual(R.pendingSuggestions(settingsPayload({suggestions: undefined})), {}, "older TipBot: no field, no chips");
  assert.deepEqual(R.pendingSuggestions(null), {});
});

test("Apply all is offered only for an empty setup", () => {
  const d = settingsPayload();
  assert.equal(R.emptySetup(d), true);
  d.tags[3].channel_ids = ["14"];
  assert.equal(R.emptySetup(d), false);
  assert.equal(R.emptySetup(d, ["NBA"]), true, "a deleted tag doesn't count");
});

test("a suggestion chip is a 44px button that names the channel and tag, escaped", () => {
  const html = R.suggestionChip("AFL", {channel_id: "11", name: "afl<tips>", reason: "channel name contains 'afl'"});
  assert.match(html, /^<button type="button" class="sr-sugg-chip" data-tag="AFL" data-ch="11"/);
  assert.match(html, /min-height:44px/);
  assert.match(html, /\+ #afl&lt;tips&gt;<\/button>$/);
  assert.match(html, /aria-label="Add #afl&lt;tips&gt; to AFL"/);
  assert.match(html, /title="channel name contains &#39;afl&#39;"/);
  assert.doesNotMatch(html, /target=|window\.open/);
});

test("tapping a chip ticks the existing channel checkbox, so Save's request shape is unchanged", () => {
  const fs = require("node:fs");
  const src = fs.readFileSync(require.resolve("../assets/routing.js"), "utf8");
  // The chip path only ticks .sr-ch checkboxes; collect() (unchanged) builds the Save body from them.
  assert.match(src, /function pickSuggestion\(tag, id\) \{[\s\S]{0,400}if \(cb && !cb\.disabled\) cb\.checked = true;/);
  assert.match(src, /var body = \{guild_id: ctx\.gid, tags: c\.tags, multi_sport_mode: box\.querySelector\("#sr-multi"\)\.value,\s*delete_tags: S\.deleted\.slice\(\), forget: S\.forget\.slice\(\)\};/);
  assert.doesNotMatch(src.slice(src.indexOf("function pickSuggestion"), src.indexOf("function wire()")), /ctx\.api\(/, "a chip never saves on its own");
  // Read-only viewers (non-admins, or while saving) get no chips.
  assert.match(src, /var sugg = ro \? \{\} : pendingSuggestions\(d, S\.deleted\)/);
});
