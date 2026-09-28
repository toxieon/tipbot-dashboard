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
