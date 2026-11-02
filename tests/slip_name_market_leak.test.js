// Non-Sportsbet slips that print the market on the player's line: the name must stay clean.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const S = require("../assets/slip-ocr.js");
const now = Date.parse("2026-10-31T21:00:00+11:00");
const read = (f) => fs.readFileSync(path.join(__dirname, "fixtures/slips/text", f), "utf8");

const CASES = [
  ["nba-jaquez-points-rebounds-plus.txt", "bet365", 20],
  ["bet365-jaquez-oneline-plus.txt", "bet365", 20],
  ["bet365-jaquez-market-on-name-ou.txt", "bet365", 19.5],
  ["ladbrokes-jaquez-to-score-oneline.txt", "ladbrokes", 20],
  ["pointsbet-jaquez-over-pts-reb.txt", "pointsbet", 19.5],
];
for (const [file, bookie, line] of CASES) {
  test(`${file}: player name has no market text`, () => {
    const slip = S.parseSlipText(read(file), { now });
    assert.equal(slip.bookie, bookie);
    assert.equal(slip.legs.length, 1);
    const leg = slip.legs[0];
    assert.equal(leg.player, "Jaime Jaquez Jr.");
    assert.equal(leg.stat, "Points + Rebounds");
    assert.equal(leg.line, line);
    assert.equal(leg.side, "Over");
    assert.ok(!leg.flags.some((f) => f.field === "selection" || f.field === "stat"), JSON.stringify(leg.flags));
  });
}
