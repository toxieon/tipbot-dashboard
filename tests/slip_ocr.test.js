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
  assert.equal(slip.legs.length, 3);
  assert.equal(slip.legs[0].selection, "Richmond (W)");
  assert.equal(slip.legs[0].market, "Head to Head");
  assert.equal(slip.legs[0].event, "Richmond (W) v Adelaide Crows (W)");
  assert.equal(slip.legs[1].selection, "Sierra Grieves");
  assert.equal(slip.legs[2].selection, "Ellie McKenzie");
});

test("cross-game Multi OCR assigns each leg its own event block", () => {
  const text = fs.readFileSync(path.join(root, "tests/fixtures/sportsbet-cross-multi.ocr.txt"), "utf8");
  const slip = Ocr.parseSportsbet(text);
  assert.equal(slip.bet_type, "Multi");
  assert.equal(slip.odds, 8.4);
  assert.equal(slip.leg_count, 2);
  assert.equal(slip.legs.length, 2);
  assert.equal(slip.legs[0].event, "Geelong v Carlton");
  assert.match(slip.legs[0].date_time, /Friday, 12 Sep 19:20/);
  assert.equal(slip.legs[0].selection, "Geelong");
  assert.equal(slip.legs[0].market, "Head to Head");
  assert.equal(slip.legs[1].event, "Sydney Swans v Brisbane Lions");
  assert.match(slip.legs[1].date_time, /Saturday, 13 Sep 14:10/);
  assert.equal(slip.legs[1].selection, "Brisbane Lions");
  assert.equal(slip.game_groups.length, 2);
});

test("attachFixtureMatches binds AFL and AFLW fixture ids per leg", () => {
  const games = [
    {
      id: 1,
      aflMatchId: "CD_AFL1",
      comp: "AFL",
      hteam: { name: "Geelong" },
      ateam: { name: "Carlton" },
    },
    {
      id: 2,
      aflMatchId: "CD_AFLW1",
      comp: "AFLW",
      hteam: { name: "Richmond" },
      ateam: { name: "Adelaide Crows" },
    },
    {
      id: 3,
      aflMatchId: "CD_NRL1",
      comp: "NRL",
      hteam: { name: "Sydney Roosters" },
      ateam: { name: "Brisbane Broncos" },
    },
  ];
  const legs = [
    { selection: "Geelong", market: "Head to Head", event: "Geelong v Carlton", sport: "AFL" },
    { selection: "Richmond (W)", market: "Head to Head", event: "Richmond (W) v Adelaide Crows (W)", sport: "AFLW" },
  ];
  const matched = Ocr.attachFixtureMatches(legs, games);
  assert.equal(matched[0].game_id, "CD_AFL1");
  assert.equal(matched[0].sport, "AFL");
  assert.equal(matched[1].game_id, "CD_AFLW1");
  assert.equal(matched[1].sport, "AFLW");
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
