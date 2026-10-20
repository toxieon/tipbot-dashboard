// node --test tests/   Points and Assists markets: short forms, NBL picker, live stat lookup.
const test = require("node:test");
const assert = require("node:assert/strict");
const Ocr = require("../assets/slip-ocr.js");
const P = require("../assets/espn-props.js");

const NOW = new Date("2026-10-15T08:00:00");
function one(statLine) {
  return Ocr.parseSlipLines(["Same Game Multi @ 5.00", "1 Leg", "Atlanta Dream @ Golden State Valkyries",
    "Today 15 Oct 09:00", "Rhyne Howard", statLine].join("\n"), { now: NOW }).legs[0];
}

test("slip short forms PTS / AST / REB map to the full stat", () => {
  assert.equal(one("15+ PTS").stat, "Points");
  assert.equal(one("6+ AST").stat, "Assists");
  assert.equal(one("8+ Reb").stat, "Rebounds");
  assert.equal(one("15+ Points").stat, "Points");
  assert.equal(one("6+ Assists").stat, "Assists");
  const tip = Ocr.slipToTipDraft(Ocr.parseSlipLines(["Same Game Multi @ 5.00", "1 Leg",
    "Atlanta Dream @ Golden State Valkyries", "Today 15 Oct 09:00", "Rhyne Howard", "6+ AST"].join("\n"), { now: NOW }));
  assert.equal(tip.legs[0].prop, "assists");
});

test("NBL gets the basketball prop picker (Points, Assists with Over/Under lines)", () => {
  assert.ok(P.hasProps("nbl") && P.isBasketball("NBL"));
  const keys = P.propTabs("nbl").map(t => t.key);
  assert.ok(keys.includes("points") && keys.includes("assists"));
  assert.equal(P.playersUrl("nbl", "9"), "/api/espn/players?league=nbl&event=9");
});
