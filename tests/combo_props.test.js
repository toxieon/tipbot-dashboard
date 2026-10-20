// node --test tests/   Points + Assists and the other two-stat combos.
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../assets/espn-props.js");
const Ocr = require("../assets/slip-ocr.js");
const LC = require("../assets/live-cards.js");

const NOW = new Date("2026-10-15T08:00:00");
function slip(statLine) {
  return Ocr.parseSlipLines(["Same Game Multi @ 5.00", "1 Leg", "Atlanta Dream @ Golden State Valkyries",
    "Today 15 Oct 09:00", "Rhyne Howard", statLine].join("\n"), { now: NOW });
}

test("picker has Points + Assists (and PR / RA) for every basketball league", () => {
  for (const lg of ["nba", "wnba", "nbl"]) {
    const pa = P.propTabs(lg).find(t => t.key === "pa");
    assert.ok(pa && pa.stat === "Points + Assists" && pa.def === 24.5, lg);
  }
  assert.ok(P.propTabs("nba").some(t => t.key === "pr") && P.propTabs("nba").some(t => t.key === "ra"));
  assert.ok(!P.propTabs("nfl").some(t => t.key === "pa"));
});

test("slip forms map to pa / pr / ra", () => {
  for (const s of ["25+ Pts+Ast", "25+ Points + Assists", "25+ PA", "25+ Pts & Ast"]) {
    const leg = slip(s).legs[0];
    assert.equal(leg.stat, "Points + Assists", s);
    assert.equal(leg.line, 25, s);
  }
  assert.equal(slip("20+ Pts + Reb").legs[0].stat, "Points + Rebounds");
  assert.equal(slip("10+ Reb + Ast").legs[0].stat, "Rebounds + Assists");
  assert.equal(slip("30+ Pts + Reb + Ast").legs[0].stat, "Points + Rebounds + Assists");
  assert.equal(Ocr.slipToTipDraft(slip("25+ Pts+Ast")).legs[0].prop, "pa");
});

test("live stat sums the parts", () => {
  const payload = { players: { "rhyne howard": { name: "Rhyne Howard", summary: { points: 18, assists: 4, rebounds: 6 } } } };
  assert.equal(LC.playerStat(payload, "Rhyne Howard", "Points + Assists"), 22);
  assert.equal(LC.playerStat(payload, "Rhyne Howard", "PTS+AST"), 22);
  assert.equal(LC.playerStat(payload, "Rhyne Howard", "rebounds + assists"), 10);
  assert.equal(LC.playerStat({ players: { "rhyne howard": { name: "Rhyne Howard", summary: { points: 18 } } } }, "Rhyne Howard", "points + assists"), null);
});
