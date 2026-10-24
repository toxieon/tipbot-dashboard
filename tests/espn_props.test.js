// node --test tests/   2.1 (0.40.1): the builder's ESPN prop picker for NBA/WNBA (reuses the NFL picker).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const P = require("../assets/espn-props.js");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
// 0.40.2: the builder code lives in the lazy assets/builder.js (same global scope as index.html).
const APP = HTML + "\n" + fs.readFileSync(path.join(__dirname, "..", "assets", "builder.js"), "utf8");

test("prop tables: NFL unchanged, NBA/WNBA share the five markets TipBot grades", () => {
  assert.deepEqual(P.NFL_PROP_TABS.map(t => t.key), ["passing_yards", "passing_tds", "completions", "interceptions",
    "rushing_yards", "rushing_tds", "receiving_yards", "receptions", "receiving_tds", "anytime_td"]);
  assert.equal(P.NFL_PROP_TABS[0].def, 249.5);
  assert.deepEqual(P.propTabs("nba").map(t => t.key), ["points", "rebounds", "assists", "threes_made", "pra", "pa", "pr", "ra",
    "double_double"]);
  assert.equal(P.propTabs("WNBA"), P.propTabs("nba"));
  assert.equal(P.propTabs("nfl"), P.NFL_PROP_TABS);
  assert.ok(P.hasProps("nba") && P.hasProps("wnba") && P.hasProps("nfl"));
  assert.ok(!P.hasProps("mlb") && !P.hasProps(""));
});

test("roster URL: NFL keeps its endpoint; basketball uses /api/espn/players", () => {
  assert.equal(P.playersUrl("nfl", "401547417"), "/api/espn/nfl-players?event=401547417");
  assert.equal(P.playersUrl("nba", "401766125"), "/api/espn/players?league=nba&event=401766125");
  assert.equal(P.playersUrl("WNBA", "1 2"), "/api/espn/players?league=wnba&event=1%202");
});

test("player lists: NFL skill filter only; basketball keeps everyone; search + sort", () => {
  const nfl = [{name: "Kicker", position: "K"}, {name: "Allen", position: "QB"}];
  assert.deepEqual(P.propPlayers(nfl, "nfl").map(p => p.name), ["Allen"]);
  const nba = [{name: "Shai Gilgeous-Alexander", position: "G", number: "2"}, {name: "Chet Holmgren", position: "C"}];
  assert.equal(P.propPlayers(nba, "nba").length, 2);        // "G"/"C" aren't NFL skill positions
  const match = (name, num, q) => String(name).toLowerCase().includes(String(q).toLowerCase()) || String(num) === q;
  assert.deepEqual(P.visiblePlayers(nba, "nba", "", match).map(p => p.name), ["Chet Holmgren", "Shai Gilgeous-Alexander"]);
  assert.deepEqual(P.visiblePlayers(nba, "nba", "shai", match).map(p => p.name), ["Shai Gilgeous-Alexander"]);
});

test("buildLeg: the same leg shape as NFL, with the event's league", () => {
  const leg = P.buildLeg({player: {name: "Shai Gilgeous-Alexander", player_id: 4278073, number: "2", position: "G"},
    team: "Oklahoma City Thunder", prop: P.propTabs("nba")[0], line: 30.5, side: "Over", league: "NBA",
    eventId: 401766125, odds: 1.85});
  assert.deepEqual(leg, {player: "Shai Gilgeous-Alexander", player_id: "4278073", number: "2", team: "Oklahoma City Thunder",
    position: "G", prop: "points", prop_key: "points", stat: "Points", line: 30.5, side: "Over", league: "nba",
    espn_event_id: "401766125", game_id: "401766125", odds: 1.85});
  assert.equal("odds" in P.buildLeg({player: {name: "x"}, team: "t", prop: P.NFL_PROP_TABS[0], line: 1, side: "Over",
    league: "nfl", eventId: 1, odds: NaN}), false);
});

test("TipBot's market labels win when the roster carries them", () => {
  const tabs = P.applyMarketLabels("nba", [{key: "pra", stat: "Pts + Reb + Ast"}, "junk", null]);
  assert.equal(tabs.find(t => t.key === "pra").stat, "Pts + Reb + Ast");
  P.applyMarketLabels("nba", [{key: "pra", stat: "Points + Rebounds + Assists"}]);
});

test("index.html loads the helper and routes basketball events to the prop picker", () => {
  assert.match(HTML, /<script src="\.\/assets\/espn-props\.js\?v=[^"]+"><\/script>/);
  assert.ok(HTML.indexOf("espn-props.js") < HTML.indexOf("const API="), "helper loads before the app script");
  assert.match(APP, /const NFL_PROP_TABS=TBEspnProps\.NFL_PROP_TABS;/);
  assert.match(APP, /if\(TBEspnProps\.hasProps\(BUILD\.espnLeague\)\)\{/);
  assert.match(APP, /api\(TBEspnProps\.playersUrl\(league, ev\.id\)\)/);
  // Older TipBot (no /api/espn/players): fall back to the free-text pick, with a Retry.
  assert.match(APP, /r\.status===404 && TBEspnProps\.isBasketball\(league\)/);
  assert.match(APP, /player props need TipBot\\'s latest deploy\. <button class="ghost" id="espnpropretry">Retry<\/button>/);
  assert.doesNotMatch(APP, /league:"nfl",\n\s*espn_event_id/);
});

// Run the real paintEspnNflPlayers from index.html against a tiny fake DOM: render, then
// press Add on a row. Before 0.40.1 the wiring loop read an undeclared `q` and threw, so no
// Add button (NFL included) was ever wired.
function paintHarness(build, preset = {}) {
  const start = APP.indexOf("  function paintEspnNflPlayers(){");
  const end = APP.indexOf("\n  // ── Custom (non-AFL) tips", start);
  assert.ok(start > 0 && end > start, "found paintEspnNflPlayers");
  const src = APP.slice(start, end);
  const els = Object.assign({}, preset);
  const el = (id) => els[id] || (els[id] = {id, value: id.endsWith("_s") || id.endsWith("_v") ? "30.5" : "", max: "60",
    innerHTML: "", hidden: false, querySelectorAll: () => [], setAttribute() {}, querySelector: () => null});
  const added = [];
  const ctx = {
    BUILD: build, TBEspnProps: P, added, els,
    $: el, esc: (s) => String(s), addLeg: (l) => added.push(l),
    nameMatchesSearch: (name, num, q) => String(name || "").toLowerCase().includes(String(q || "").trim().toLowerCase()),
  };
  vm.createContext(ctx);
  vm.runInContext(src + "\npaintEspnNflPlayers();", ctx);
  return {els, added};
}

test("NBA picker renders every player and its Add button adds a structured NBA leg", () => {
  const build = {espnLeague: "nba", espnPropKey: "points", search: "", collapsed: {},
    espnEvent: {id: "401766125"}, espnPlayers: [],
    espnTeams: [{id: "25", name: "Oklahoma City Thunder", players: [
      {player_id: "4433255", name: "Chet Holmgren", position: "C"},
      {player_id: "4278073", name: "Shai Gilgeous-Alexander", position: "G", number: "2"}]}]};
  const {els, added} = paintHarness(build);
  assert.match(els.players.innerHTML, /Shai Gilgeous-Alexander/);
  assert.match(els.players.innerHTML, /Chet Holmgren/);
  els["er_25_1_a"].onclick();                         // row 1 = Shai (sorted by name)
  assert.equal(added.length, 1);
  assert.deepEqual([added[0].player, added[0].player_id, added[0].prop, added[0].league, added[0].line, added[0].game_id],
    ["Shai Gilgeous-Alexander", "4278073", "points", "nba", 30.5, "401766125"]);
});

test("NFL picker Add works again, and search keeps render and wiring rows aligned", () => {
  const build = {espnLeague: "nfl", espnPropKey: "passing_yards", search: "allen", collapsed: {},
    espnEvent: {id: "401772710"}, espnPlayers: [],
    espnTeams: [{id: "2", name: "Buffalo Bills", players: [
      {player_id: "1", name: "Aaron Kicker", position: "QB"}, {player_id: "3918298", name: "Josh Allen", position: "QB"}]}]};
  const {els, added} = paintHarness(build);
  assert.doesNotMatch(els.players.innerHTML, /Aaron Kicker/);
  els["er_2_0_a"].onclick();
  assert.deepEqual([added[0].player_id, added[0].prop, added[0].league], ["3918298", "passing_yards", "nfl"]);
});

// Double Double tab (Yes = Over 0.5, No = Under 0.5) and the Q period control.
const NBA_BUILD = (key) => ({espnLeague: "nba", espnPropKey: key, search: "", collapsed: {},
  espnEvent: {id: "401909850"}, espnPlayers: [],
  espnTeams: [{id: "29", name: "Memphis Grizzlies", players: [{player_id: "5501", name: "Cameron Boozer", position: "F"}]}]});
// Fake Over/Under (or Yes/No) group whose second button is pressed after wiring.
function pressSecond(id) {
  const mk = (s) => ({dataset: {s}, classList: {add() {}, remove() {}}});
  const btns = [mk("Over"), mk("Under")];
  return {[id]: {id, querySelectorAll: () => btns, press: () => btns[1].onclick()}};
}

test("Double Double tab: Yes/No only, a fixed 0.5 line, prop_key double_double", () => {
  const tab = P.propTabs("nba").find((t) => t.key === "double_double");
  assert.deepEqual([tab.stat, tab.def, tab.max, tab.yesNo], ["Double Double", 0.5, 1, true]);
  assert.equal(P.propTabs("wnba"), P.propTabs("nba"));
  const yes = paintHarness(NBA_BUILD("double_double"));
  assert.match(yes.els.players.innerHTML, /<button data-s="Over" class="on">Yes<\/button><button data-s="Under">No<\/button>/);
  assert.doesNotMatch(yes.els.players.innerHTML, /type="range"/);
  yes.els["er_29_0_a"].onclick();
  assert.deepEqual([yes.added[0].prop_key, yes.added[0].stat, yes.added[0].side, yes.added[0].line],
    ["double_double", "Double Double", "Over", 0.5]);
  const no = paintHarness(NBA_BUILD("double_double"), pressSecond("er_29_0_ou"));
  no.els["er_29_0_ou"].press();
  no.els["er_29_0_a"].onclick();
  assert.deepEqual([no.added[0].prop, no.added[0].side, no.added[0].line], ["double_double", "Under", 0.5]);
  assert.equal(P.propLegText(no.added[0]), "Cameron Boozer Double Double No");
});

test("Q control: blank adds a full-game leg with no period; Q1 is stored on the leg", () => {
  const full = paintHarness(NBA_BUILD("points"));
  assert.match(full.els.players.innerHTML, /<label class="qlbl"[^>]*>Q <select id="er_29_0_q"/);
  assert.match(full.els.players.innerHTML, /<option value="">Full<\/option><option value="Q1">Q1<\/option>.*<option value="H2">H2<\/option>/);
  full.els["er_29_0_a"].onclick();
  assert.equal("period" in full.added[0], false);
  const q1 = paintHarness(NBA_BUILD("points"), Object.assign(pressSecond("er_29_0_ou"),
    {er_29_0_q: {id: "er_29_0_q", value: "Q1"}, er_29_0_v: {id: "er_29_0_v", value: "2.5"}}));
  q1.els["er_29_0_ou"].press();
  q1.els["er_29_0_a"].onclick();
  const l = q1.added[0];
  assert.deepEqual([l.prop, l.side, l.line, l.period], ["points", "Under", 2.5, "Q1"]);
  assert.equal(P.propLegText(l), "Cameron Boozer under 2.5 Q1 Points");
});

test("buildLeg keeps a known period and drops blank or unknown ones", () => {
  const base = {player: {name: "Isaiah Jackson", player_id: 1}, team: "t", prop: P.propTabs("nba")[0], line: 2.5,
    side: "Under", league: "nba", eventId: 1};
  assert.equal(P.buildLeg(Object.assign({}, base, {period: "Q1"})).period, "Q1");
  assert.equal(P.buildLeg(Object.assign({}, base, {period: "1st Half"})).period, "H1");
  for (const p of ["", null, undefined, "OT", "Full"]) {
    assert.equal("period" in P.buildLeg(Object.assign({}, base, {period: p})), false, String(p));
  }
  assert.equal(P.buildThreesLeg(Object.assign({}, base, {mode: "plus", line: 2, period: "Q2"})).period, "Q2");
  assert.deepEqual(P.PERIOD_OPTIONS.map((o) => o.value), ["", "Q1", "Q2", "Q3", "Q4", "H1", "H2"]);
});

test("period and Double Double wording", () => {
  const n = (v) => P.normalizePeriod(v);
  assert.deepEqual(["1st Qtr", "1st Quarter", "Q1", "1Q", "2nd Half", "2H", "Half 1", "3rd Qtr", "4th Quarter"].map(n),
    ["Q1", "Q1", "Q1", "Q1", "H2", "H2", "H1", "Q3", "Q4"]);
  assert.deepEqual(["", "Full", "OT", "Q5"].map(n), ["", "", "", ""]);
  assert.deepEqual(P.splitPeriodText("1st Qtr Points"), {period: "Q1", rest: "Points"});
  assert.deepEqual(P.splitPeriodText("Points"), {period: "", rest: "Points"});
  assert.equal(P.splitPeriodText("H2H").period, "");
  assert.deepEqual(P.parseDoubleDouble("Double Double NO"), {side: "Under"});
  assert.deepEqual(P.parseDoubleDouble("No Double Double"), {side: "Under"});
  assert.deepEqual(P.parseDoubleDouble("Double Double YES"), {side: "Over"});
  assert.deepEqual(P.parseDoubleDouble("To Record A Double Double"), {side: "Over"});
  assert.equal(P.parseDoubleDouble("Points"), null);
  assert.deepEqual(P.parseDoubleDoubleLine("Cameron Boozer & Ty Jerome Double Double NO"),
    {players: ["Cameron Boozer", "Ty Jerome"], side: "Under"});
});

test("the builder wires Q into both prop rows and the free-text Double Double line", () => {
  assert.equal((APP.match(/\+TBEspnProps\.periodSelectHtml\(rid\)/g) || []).length, 2);
  assert.match(APP, /const period=TBEspnProps\.normalizePeriod\(\(\$\(rid\+"_q"\)\|\|\{\}\)\.value\);\n\s*if\(period\) leg\.period=period;/);
  assert.match(APP, /TBEspnProps\.parseDoubleDoubleLine\(v\)/);
  assert.doesNotMatch(APP + fs.readFileSync(path.join(__dirname, "..", "assets", "espn-props.js"), "utf8"), /target=["']?_blank/);
});
