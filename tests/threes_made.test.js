// node --test tests/   NBA Threes Made: Over/Under .5 lines and 1+..6+ alt lines.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const P = require("../assets/espn-props.js");
const L = require("../assets/lines.js");

const player = { name: "Tester", player_id: "9", position: "F" };

test("Over/Under saves Threes Made and alt lines save N+ Threes Made", () => {
  const ou = P.buildThreesLeg({
    player, team: "Orlando Magic", mode: "ou", line: 2.5, side: "Under", league: "nba", eventId: "401",
  });
  assert.equal(ou.stat, "Threes Made");
  assert.equal(ou.prop, "threes_made");
  assert.equal(ou.prop_key, "threes_made");
  assert.equal(ou.line, 2.5);
  assert.equal(ou.side, "Under");
  assert.equal(ou.market, undefined);
  assert.equal(L.applyHalfPointLine(ou).line, 2.5);

  for (const n of P.THREES_PLUS_LINES) {
    const alt = P.buildThreesLeg({
      player, team: "Orlando Magic", mode: "plus", line: n, league: "nba", eventId: "401",
    });
    assert.equal(alt.stat, n + "+ Threes Made", n);
    assert.equal(alt.market, n + "+ Threes Made", n);
    assert.equal(alt.prop, "threes_made");
    assert.equal(alt.line, n);
    assert.equal(alt.side, "Over");
    assert.equal(alt.plus, true);
    assert.equal(alt.desc, "Tester " + n + "+ Threes Made");
    const saved = L.applyHalfPointLine(alt);
    assert.equal(saved.line, n);
    assert.equal(saved.stat, n + "+ Threes Made");
  }
  assert.equal(P.buildThreesLeg({ player, mode: "plus", line: 7, league: "nba", eventId: "1" }), null);
  assert.equal(P.buildThreesLeg({ player, mode: "ou", line: 2, side: "Over", league: "nba", eventId: "1" }).line, 1.5);
});

test("the NBA prop picker offers Threes Made Over/Under and 1+ to 6+", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const app = html + "\n" + fs.readFileSync(path.join(__dirname, "..", "assets", "builder.js"), "utf8");
  const start = app.indexOf("  function paintEspnNflPlayers(){");
  const end = app.indexOf("\n  // ── Custom (non-AFL) tips", start);
  assert.ok(start > 0 && end > start);
  const src = app.slice(start, end);
  function paint(build) {
    const els = {};
    const el = (id) => els[id] || (els[id] = {
      id, value: id.endsWith("_s") || id.endsWith("_v") ? "2.5" : "", max: "12",
      innerHTML: "", hidden: false, querySelectorAll: () => [], setAttribute() {}, querySelector: () => null,
    });
    const added = [];
    const ctx = {
      BUILD: build, TBEspnProps: P, added, els,
      $: el, esc: (s) => String(s), addLeg: (leg) => added.push(leg),
      nameMatchesSearch: () => true,
    };
    vm.createContext(ctx);
    vm.runInContext(src + "\npaintEspnNflPlayers();", ctx);
    return { els, added };
  }
  const teams = [{ id: "orl", name: "Orlando Magic", players: [player] }];
  const base = { espnLeague: "nba", espnPropKey: "threes_made", search: "", collapsed: {}, espnEvent: { id: "401" }, espnPlayers: [], espnTeams: teams };
  const ou = paint(Object.assign({}, base));
  assert.match(ou.els.players.innerHTML, /data-threes-mode="ou"/);
  assert.match(ou.els.players.innerHTML, /data-threes-plus="1"/);
  assert.match(ou.els.players.innerHTML, /data-threes-plus="6"/);
  assert.match(ou.els.players.innerHTML, /3PM/);
  ou.els["er_orl_0_v"].value = "1.5";
  ou.els["er_orl_0_a"].onclick();
  assert.equal(ou.added[0].stat, "Threes Made");
  assert.equal(ou.added[0].line, 1.5);
  assert.equal(ou.added[0].prop, "threes_made");
  assert.equal(L.applyHalfPointLine(ou.added[0]).line, 1.5);

  const alt = paint(Object.assign({}, base, { espnThreesMode: "plus", espnThreesPlus: 2 }));
  assert.match(alt.els.players.innerHTML, /data-threes-plus="2"[^>]*class="on"|class="on"[^>]*data-threes-plus="2"/);
  alt.els["er_orl_0_a"].onclick();
  assert.equal(alt.added[0].stat, "2+ Threes Made");
  assert.equal(alt.added[0].line, 2);
  assert.equal(alt.added[0].prop, "threes_made");
  assert.equal(L.applyHalfPointLine(alt.added[0]).line, 2);
});
