// node --test tests/   0.66.13: Steals / Blocks / Stocks, Triple Double, First Basket, First Team to Score,
// and quarter / half lines and totals (TipBot 0.70.31 grades all of them).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const P = require("../assets/espn-props.js");
const Ocr = require("../assets/slip-ocr.js");

const ROOT = path.join(__dirname, "..");
const APP = fs.readFileSync(path.join(ROOT, "index.html"), "utf8") + "\n" + fs.readFileSync(path.join(ROOT, "assets", "builder.js"), "utf8");
const plain = (v) => JSON.parse(JSON.stringify(v));

function paint(key, league = "nba") {
  const start = APP.indexOf("  function paintEspnNflPlayers(){");
  const src = APP.slice(start, APP.indexOf("\n  // ── Custom (non-AFL) tips", start));
  const els = {};
  const el = (id) => els[id] || (els[id] = {id, value: "", max: "60", innerHTML: "", hidden: false,
    querySelectorAll: () => [], setAttribute() {}, querySelector: () => null});
  const added = [];
  const ctx = {BUILD: {espnLeague: league, espnPropKey: key, search: "", collapsed: {}, espnEvent: {id: "401900002"},
    espnPlayers: [], espnTeams: [{id: "13", name: "Los Angeles Lakers", players: [{player_id: "3945274", name: "Luka Doncic"}]}]},
    TBEspnProps: P, $: el, esc: (s) => String(s), addLeg: (l) => added.push(l),
    nameMatchesSearch: () => true};
  vm.createContext(ctx);
  vm.runInContext(src + "\npaintEspnNflPlayers();", ctx);
  return {els, added};
}

test("Steals, Blocks and Steals + Blocks are ordinary over/under tabs", () => {
  const keys = P.propTabs("nba").map((t) => t.key);
  for (const k of ["steals", "blocks", "stocks"]) assert.ok(keys.includes(k), k);
  const {els, added} = paint("stocks");
  assert.match(els.players.innerHTML, /type="range"/);
  els["er_13_0_a"].onclick();
  assert.equal(added[0].prop_key, "stocks");
});

test("Triple Double is Yes / No over a 0.5 line", () => {
  const {els, added} = paint("triple_double");
  assert.match(els.players.innerHTML, /aria-label="Triple Double"><button data-s="Over" class="on">Yes<\/button>/);
  els["er_13_0_a"].onclick();
  assert.deepEqual([added[0].prop, added[0].side, added[0].line], ["triple_double", "Over", 0.5]);
  assert.equal(P.propLegText(added[0]), "Luka Doncic Triple Double Yes");
});

test("First Basket is a pick: no line, no over/under, no Q, NBA and WNBA only", () => {
  const {els, added} = paint("first_basket");
  assert.doesNotMatch(els.players.innerHTML, /type="range"|data-s="Under"|_q"/);
  els["er_13_0_a"].onclick();
  assert.deepEqual([added[0].prop, added[0].side, added[0].line], ["first_basket", "Over", 0.5]);
  assert.equal(P.propLegText(added[0]), "Luka Doncic First Basket");
  assert.ok(!P.shownTabs("nfl").some((t) => t.key === "first_basket"));
});

test("Lines & totals: first team to score and quarter / half markets", () => {
  const leg = plain(P.firstTeamLeg("Los Angeles Lakers", {league: "NBA", eventId: 401900002}));
  assert.deepEqual(leg, {kind: "team", market: "First Team to Score", stat: "First Team to Score", team: "Los Angeles Lakers",
    desc: "Los Angeles Lakers to score first", league: "nba", espn_event_id: "401900002", game_id: "401900002"});
  assert.equal(P.firstTeamLeg("", {}), null);
  assert.deepEqual(["nba", "nbl", "nfl", "mlb"].map(P.periodTeamMarkets), [true, true, true, false]);
  assert.match(APP, /<option value="first_team">First team to score<\/option>/);
  assert.match(APP, /TBEspnProps\.periodSelectHtml\("lt"\)/);
  assert.match(APP, /if\(period\)\{ addLeg\(\{custom:true,desc:v,period:period,/);
});

test("slips and free text read Triple Double, First Basket and Steals + Blocks", () => {
  assert.equal(P.parseDoubleDoubleLine("Luka Doncic Triple Double NO"), null);   // never "Luka Doncic Triple"
  assert.deepEqual(plain(P.parseMilestoneLine("Luka Doncic Triple Double NO")),
    {players: ["Luka Doncic"], side: "Under", key: "triple_double", stat: "Triple Double"});
  const td = Ocr.parseSlipLines(["sportsbet", "Same Game Multi @ 3.10", "Dallas Mavericks v Los Angeles Lakers",
    "Saturday, 24 Oct 11:00", "Luka Doncic Triple Double YES"].join("\n"), {now: Date.parse("2026-10-23T00:00:00Z")});
  assert.deepEqual([td.legs[0].player, td.legs[0].stat, td.legs[0].side, td.legs[0].line], ["Luka Doncic", "Triple Double", "Over", 0.5]);
  assert.equal(Ocr.legToBuilderLeg(Object.assign({}, td.legs[0], {sport: "NBA"})).prop_key, "triple_double");
  const fb = Ocr.parseSlipLines(["sportsbet", "Same Game Multi @ 7.00", "Dallas Mavericks v Los Angeles Lakers",
    "Saturday, 24 Oct 11:00", "Luka Doncic", "Luka Doncic - First Basket"].join("\n"), {now: Date.parse("2026-10-23T00:00:00Z")});
  const b = Ocr.legToBuilderLeg(Object.assign({}, fb.legs[0], {sport: "NBA"}));
  assert.deepEqual([b.prop_key, b.side, b.line], ["first_basket", "Over", 0.5]);
  const st = Ocr.legToBuilderLeg({kind: "player", player: "Victor Wembanyama", stat: "Steals + Blocks", line: 4.5,
    side: "Over", sport: "NBA"});
  assert.equal(st.prop_key, "stocks");
  assert.match(APP, /TBEspnProps\.parseMilestoneLine\(v\)/);
});
