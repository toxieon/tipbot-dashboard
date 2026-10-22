// node --test tests/   NBA player-prop singles: text fixtures the slip harness also runs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Ocr = require("../assets/slip-ocr.js");
const LC = require("../assets/live-cards.js");

const root = path.join(__dirname, "fixtures", "slips");
const spec = JSON.parse(fs.readFileSync(path.join(root, "expected.json"), "utf8"));
const NOW = Date.parse(spec.now);

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}
function parsed(file, now) {
  return Ocr.parseSlipLines(read(file), { now: now == null ? NOW : now });
}

test("registry note lists bookmakers and nothing else", () => {
  const note = Ocr.supportedSlipsNote();
  assert.equal(note, "Supported slips: " + Ocr.SLIP_REGISTRY.map((row) => row.label).join(", ") + ".");
  assert.match(note, /^Supported slips: Sportsbet, Ladbrokes, Neds, TAB, PointsBet, bet365\.$/);
  const ui = fs.readFileSync(path.join(__dirname, "..", "assets", "slip-ocr-ui.js"), "utf8");
  assert.match(ui, /id="slip-supported"/);
  assert.match(ui, /supportedSlipsNote/);
});

test("text fixtures match the harness expectations", () => {
  for (const fx of spec.fixtures.filter((row) => String(row.file).endsWith(".txt"))) {
    const slip = parsed(fx.file);
    const e = fx.expect;
    assert.equal(slip.bet_type, e.bet_type, fx.id);
    assert.equal(slip.odds, e.odds, fx.id);
    assert.equal(slip.sport, e.sport, fx.id);
    assert.equal(slip.event, e.event, fx.id);
    assert.equal(slip.date_time, e.date_time, fx.id);
    assert.equal(slip.bookie, e.bookie, fx.id);
    assert.equal(slip.stake_dollars, e.stake_dollars, fx.id);
    assert.equal(slip.returns_dollars, e.returns_dollars, fx.id);
    assert.equal(slip.legs.length, 1, fx.id);
    const leg = slip.legs[0];
    assert.equal(leg.player, e.legs[0].who, fx.id);
    assert.equal(leg.stat, e.legs[0].stat, fx.id);
    assert.equal(leg.line, e.legs[0].line, fx.id);
    assert.equal(leg.side, e.legs[0].side, fx.id);
  }
});

test("a time with no date is kept and flagged, not filled in", () => {
  const slip = parsed("text/nba-rebounds-under.txt");
  assert.equal(slip.date_time, "11:10");
  assert.equal(slip.start_local, "");
  assert.ok(slip.flags.some((f) => f.field === "date_time" && /date not on the slip/i.test(f.reason)));
});

test("the screenshot clock is not the game time", () => {
  const slip = parsed("text/nba-threes-plus.txt");
  assert.equal(slip.date_time, "Thu 22 Oct 10:10");
  assert.equal(slip.start_local, "2026-10-22T10:10");
  assert.equal(slip.legs.length, 1);
  const tip = Ocr.slipToTipDraft(slip);
  assert.equal(tip.legs[0].stat, "2+ Threes Made");
  assert.equal(tip.legs[0].market, "2+ Threes Made");
  assert.equal(tip.legs[0].prop, "threes_made");
  assert.equal(tip.legs[0].line, 2);
  assert.equal(tip.bookmaker, "bet365");
});

test("Tomorrow is the next day in Australia/Melbourne, and away @ home stays", () => {
  const utcEvening = Date.parse("2026-10-21T21:00:00Z");
  const slip = parsed("text/nba-assists-tomorrow.txt", utcEvening);
  assert.equal(slip.date_time, "Fri 23 Oct 11:30");
  assert.equal(slip.start_local, "2026-10-23T11:30");
  assert.equal(slip.event, "DAL @ HOU");
  assert.deepEqual(Ocr.splitEventTeams(slip.event), { home: "HOU", away: "DAL" });
});

test("assists plus rebounds is one sum", () => {
  const slip = parsed("text/nba-assists-rebounds.txt");
  assert.equal(slip.legs[0].stat, "Rebounds + Assists");
  assert.equal(Ocr.slipToTipDraft(slip).legs[0].prop, "ra");
  const payload = { players: { "keyonte george": { name: "Keyonte George", summary: { assists: 8, rebounds: 4, threes: 3 } } } };
  assert.equal(LC.playerStat(payload, "Keyonte George", "Assists + Rebounds"), 12);
  assert.equal(LC.playerStat(payload, "Keyonte George", "Rebounds + Assists"), 12);
  assert.equal(LC.playerStat(payload, "Keyonte George", "2+ Threes Made"), 3);
});

test("a low-confidence read is flagged and odds are not invented", () => {
  const text = read("text/nba-assists-under.txt");
  const lines = text.split("\n").filter(Boolean).map((t) => ({ text: t, conf: t.startsWith("Sarr") ? 40 : 95 }));
  const slip = Ocr.parseSlipLines({ text, lines }, { now: NOW });
  assert.equal(slip.legs[0].player, "Sarr");
  assert.ok(slip.flags.some((f) => f.field === "selection"));
  const missing = Ocr.parseSlipLines(text.replace("@1.58\n", ""), { now: NOW });
  assert.equal(missing.odds, null);
  assert.ok(missing.flags.some((f) => f.field === "odds"));
  assert.equal(missing.stake_dollars, 100);
  assert.equal(missing.returns_dollars, 158);
});
