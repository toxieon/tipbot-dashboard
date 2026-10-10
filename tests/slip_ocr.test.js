// node --test tests/slip_ocr.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Ocr = require("../assets/slip-ocr.js");
const root = path.join(__dirname, "..");
const ocrText = fs.readFileSync(path.join(root, "tests/fixtures/sportsbet-proposed-bet.ocr.txt"), "utf8");

test("Sportsbet fixture OCR parses to 3 legs at 7.00", () => {
  const slip = Ocr.parseSportsbet(ocrText);
  assert.equal(slip.bookie, "sportsbet");
  assert.equal(slip.bet_type, "Same Game Multi");
  assert.equal(slip.odds, 7);
  assert.equal(slip.leg_count, 3);
  assert.equal(slip.event, "Richmond (W) v Adelaide Crows (W)");
  assert.match(slip.date_time, /Saturday, 10 Oct 19:15/);
  assert.equal(slip.sport, "AFLW");
  assert.deepEqual(slip.legs, [
    { selection: "Richmond (W)", market: "Head to Head" },
    { selection: "Sierra Grieves", market: "15+ Disposals" },
    { selection: "Ellie McKenzie", market: "25+ Disposals" },
  ]);
});

test("slipToTipDraft maps builder legs and bookmaker", () => {
  const slip = Ocr.parseSportsbet(ocrText);
  const tip = Ocr.slipToTipDraft(slip);
  assert.equal(tip.odds, 7);
  assert.equal(tip.bookmaker, "Sportsbet");
  assert.equal(tip.game_name, slip.event);
  assert.equal(tip.sport, "AFLW");
  assert.equal(tip.legs.length, 3);
  assert.equal(tip.legs[0].market, "Head to Head");
  assert.equal(tip.legs[1].player, "Sierra Grieves");
  assert.equal(tip.legs[1].stat, "Disposals");
});

test("fixture image is present for manual OCR checks", () => {
  const img = path.join(root, "tests/fixtures/sportsbet-proposed-bet.png");
  assert.ok(fs.statSync(img).size > 1000);
});
