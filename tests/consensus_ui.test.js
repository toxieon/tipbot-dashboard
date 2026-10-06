// node --test tests/   Master → Consensus tab helpers (Phase 1.2).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../assets/consensus-ui.js");

test("readForm validates and types the settings", () => {
  const body = C.readForm({min_servers: "2", min_pct: "0", window_hours: "24", line_tolerance: "0.5",
    require_before_start: true, include_multi_legs: false, sports: ["NFL", "AFL"], show_sources: "servers_only"});
  assert.deepEqual(body, {min_servers: 2, min_pct: 0, window_hours: 24, line_tolerance: 0.5, require_before_start: true,
    include_multi_legs: false, sports: ["AFL", "NFL"], show_sources: "servers_only"});
  assert.throws(() => C.readForm({min_servers: "0"}), /Minimum servers/);
  assert.throws(() => C.readForm({window_hours: "500"}), /Window/);
  assert.throws(() => C.readForm({sports: []}), /at least one sport/);
});

test("preview query carries the unsaved overrides", () => {
  assert.equal(C.previewQuery({min_servers: 2, sports: ["AFL", "AFLW"], require_before_start: false, show_sources: "anonymous"}),
    "/api/consensus/preview?min_servers=2&require_before_start=0&sports=AFL%2CAFLW");
  assert.equal(C.previewQuery({}), "/api/consensus/preview");
});

test("summary text", () => {
  assert.equal(C.summary({qualifying: 1, needed: 2, active_servers: 2}), "1 qualifies · need 2 of 2 active servers");
  assert.equal(C.summary({qualifying: 0, needed: 3, active_servers: 1}), "0 qualify · need 3 of 1 active server");
});

test("missing endpoint shows the deploy message with Retry", async () => {
  const calls = [];
  let painted = 0;
  const ui = C.create({call: async (p) => { calls.push(p); return {_status: 404}; }, paint: () => { painted++; }});
  await ui.load();
  assert.deepEqual(calls, ["/api/consensus/settings"]);
  assert.match(ui.view(), /This needs TipBot’s latest deploy\./);
  assert.match(ui.view(), /id="cons-retry"/);
});

test("loaded settings render the form and the preview table", async () => {
  const settings = {enabled: false, dry_run: true, paused: false, min_servers: 3, min_pct: 0, window_hours: 24, line_tolerance: 0,
    require_before_start: true, include_multi_legs: true, sports: ["AFL", "AFLW", "NBA", "NFL"], show_sources: "servers_and_tipsters"};
  const preview = {ok: true, qualifying: 1, needed: 2, active_servers: 2, legs_considered: 3, late_sources: 0, unmatched: {"no game": 1},
    clusters: [{label: "Erone Fitzpatrick 15+ Disposals", sport: "AFLW", game_label: "Carlton v Hawthorn", count: 2, needed: 2,
      qualifies: true, started: false, lines_seen: {"15+": 1, "14.5": 1}, servers: [{name: "Tip2"}, {name: "Toxieon"}]}]};
  const seen = [];
  const ui = C.create({call: async (p) => { seen.push(p); return p.startsWith("/api/consensus/settings")
    ? {ok: true, _status: 200, settings, gates: {beta_enabled: true, master_verified: true}, sports_available: ["AFL", "AFLW", "NFL", "NBA"],
       show_sources_options: ["servers_and_tipsters", "servers_only", "anonymous"]}
    : preview; }, paint: () => {}});
  await ui.load();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(seen[1], "/api/consensus/preview?include_multi_legs=1&line_tolerance=0&min_pct=0&min_servers=3&require_before_start=1&sports=AFL%2CAFLW%2CNBA%2CNFL&window_hours=24");
  const html = ui.view();
  assert.match(html, /Consensus on/);
  assert.match(html, /Erone Fitzpatrick 15\+ Disposals/);
  assert.match(html, /2\/2/);
  assert.match(html, /1 no game/);
});

test("master page loads the consensus tab (no placeholder)", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "master", "index.html"), "utf8");
  assert.match(html, /<script src="\.\.\/assets\/consensus-ui\.js"><\/script>/);
  assert.match(html, /S\.tab==="consensus"\?cons\.view\(\)/);
  assert.doesNotMatch(html, /\["consensus","Consensus","3"\]/);
});

// Enough of a document for bind(): the settings inputs the real view() prints.
function attr(s, name) {
  const m = String(s).match(new RegExp("\\b" + name + '="([^"]*)"'));
  return m ? m[1] : "";
}
function mountConsensus(html) {
  const els = [];
  for (const m of html.matchAll(/<button\b([^>]*)>/gi)) {
    els.push({id: attr(m[1], "id"), className: attr(m[1], "class"), onclick: null});
  }
  for (const m of html.matchAll(/<input\b([^>]*)>/gi)) {
    const a = m[1];
    const el = {
      id: attr(a, "id"), className: attr(a, "class"), value: attr(a, "value"),
      checked: /\schecked\b/.test(a), dataset: {}
    };
    const k = attr(a, "data-k");
    if (k) el.dataset.k = k;
    els.push(el);
  }
  const sel = html.match(/<select\b([^>]*)>([\s\S]*?)<\/select>/i);
  let select = null;
  if (sel) {
    const opts = [...sel[2].matchAll(/<option\b([^>]*)>/gi)];
    const chosen = opts.find((o) => /\sselected\b/.test(o[1])) || opts[0];
    select = {id: attr(sel[1], "id"), value: chosen ? attr(chosen[1], "value") : ""};
  }
  const has = (el, c) => el.className.split(/\s+/).includes(c);
  return {
    getElementById(id) {
      if (select && select.id === id) return select;
      return els.find((e) => e.id === id) || null;
    },
    querySelectorAll(q) {
      if (q === ".cons-num") return els.filter((e) => has(e, "cons-num"));
      if (q === ".cons-bool") return els.filter((e) => has(e, "cons-bool"));
      if (q === ".cons-sport") return els.filter((e) => has(e, "cons-sport"));
      if (q === ".cons-sport:checked") return els.filter((e) => has(e, "cons-sport") && e.checked);
      return [];
    }
  };
}
const SETTINGS = {enabled: false, dry_run: true, paused: false, min_servers: 3, min_pct: 0, window_hours: 24, line_tolerance: 0,
  require_before_start: true, include_multi_legs: true, sports: ["AFL", "NFL"], show_sources: "servers_and_tipsters"};
const GATES = {beta_enabled: true, master_verified: true, kill_switch: false};
function consensusHarness() {
  const calls = [];
  let ui;
  ui = C.create({
    call: async (p, body) => {
      calls.push({path: p, body: body});
      if (String(p).startsWith("/api/consensus/settings") && body) return {ok: true, _status: 200, settings: Object.assign({}, SETTINGS, body)};
      if (String(p).startsWith("/api/consensus/settings")) return {ok: true, _status: 200, settings: Object.assign({}, SETTINGS),
        gates: GATES, sports_available: ["AFL", "NFL"], show_sources_options: ["servers_and_tipsters", "servers_only", "anonymous"]};
      return {ok: true, _status: 200, qualifying: 0, needed: 3, active_servers: 2, legs_considered: 0, late_sources: 0, unmatched: {}, clusters: []};
    },
    paint: () => { global.document = mountConsensus(ui.view()); ui.bind(); }
  });
  return {ui, calls};
}
async function ready(ui) {
  await ui.load();
  await new Promise((r) => setTimeout(r, 0));
  ui.bind();
}
const FULL = {min_servers: 2, min_pct: 0, window_hours: 12, line_tolerance: 0, require_before_start: true,
  include_multi_legs: true, sports: ["AFL", "NFL"], show_sources: "servers_and_tipsters", enabled: true, dry_run: true, paused: false};

test("turning consensus on saves every current field, read before the confirm", async () => {
  const prevWin = global.window;
  const prevDoc = global.document;
  try {
    global.window = {};
    const {ui, calls} = consensusHarness();
    await ready(ui);
    const num = global.document.querySelectorAll(".cons-num").find((i) => i.dataset.k === "min_servers");
    const win = global.document.querySelectorAll(".cons-num").find((i) => i.dataset.k === "window_hours");
    num.value = "2";
    win.value = "12";
    const on = global.document.getElementById("cons-on");
    on.checked = true;
    global.window.TBSheet = {confirm: async (o) => {
      assert.equal(o.title, "Turn consensus on?");
      assert.equal(o.confirmLabel, "Turn on");
      num.value = "3";
      win.value = "24";
      return true;
    }};
    await on.onchange();
    const post = calls.filter((c) => c.body && String(c.path) === "/api/consensus/settings");
    assert.equal(post.length, 1);
    assert.deepEqual(post[0].body, FULL);
  } finally {
    global.window = prevWin;
    global.document = prevDoc;
  }
});

test("cancelling the consensus confirm does not save, and Save posts the switches too", async () => {
  const prevWin = global.window;
  const prevDoc = global.document;
  try {
    global.window = {TBSheet: {confirm: async () => false}};
    const {ui, calls} = consensusHarness();
    await ready(ui);
    const num = global.document.querySelectorAll(".cons-num").find((i) => i.dataset.k === "min_servers");
    num.value = "2";
    const on = global.document.getElementById("cons-on");
    on.checked = true;
    await on.onchange();
    assert.equal(calls.filter((c) => c.body).length, 0, "cancel posts nothing");
    global.document.querySelectorAll(".cons-num").find((i) => i.dataset.k === "min_servers").value = "2";
    global.document.getElementById("cons-save").onclick();
    const post = calls.filter((c) => c.body);
    assert.equal(post.length, 1);
    assert.equal(post[0].path, "/api/consensus/settings");
    assert.equal(post[0].body.min_servers, 2);
    assert.equal(post[0].body.enabled, false);
    assert.equal(post[0].body.dry_run, true);
    assert.equal(post[0].body.paused, false);
    assert.equal(post[0].body.window_hours, 24);
    assert.deepEqual(post[0].body.sports, ["AFL", "NFL"]);
  } finally {
    global.window = prevWin;
    global.document = prevDoc;
  }
});
