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
  for (const fx of spec.fixtures.filter((row) => String(row.file).endsWith(".txt") && !row.synthetic)) {
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

// Double Double Yes/No and quarter / half markets (1st Qtr Points etc.).
const DD_SLIP = [
  "sportsbet", "Same Game Multi @ 1.64", "2 Legs",
  "Memphis Grizzlies v Golden State Warriors", "Saturday, 24 Oct 11:00",
  "Cameron Boozer & Ty Jerome Double Double NO",
].join("\n");
const Q1_SLIP = [
  "sportsbet", "Same Game Multi @ 1.61", "2 Legs",
  "LA Clippers v Los Angeles Lakers", "Saturday, 24 Oct 13:30",
  "Isaiah Jackson Under (+2.5)", "Isaiah Jackson - 1st Qtr Points",
  "Luka Doncic", "To Record 4+ Rebounds",
].join("\n");
const ddSlip = (sub) => ["sportsbet", "Same Game Multi @ 2.10", "Memphis Grizzlies v Golden State Warriors",
  "Saturday, 24 Oct 11:00", "Cameron Boozer", sub].join("\n");

test("Double Double NO for two players is two Under 0.5 Double Double legs", () => {
  const slip = Ocr.parseSlipLines(DD_SLIP, { now: NOW });
  assert.deepEqual(slip.legs.map((l) => [l.player, l.stat, l.side, l.line]),
    [["Cameron Boozer", "Double Double", "Under", 0.5], ["Ty Jerome", "Double Double", "Under", 0.5]]);
  const b = slip.legs.map((l) => Ocr.legToBuilderLeg(Object.assign({}, l, { sport: "NBA" })));
  assert.deepEqual(b.map((l) => [l.player, l.prop_key, l.side, l.line, l.league]),
    [["Cameron Boozer", "double_double", "Under", 0.5, "nba"], ["Ty Jerome", "double_double", "Under", 0.5, "nba"]]);
  assert.equal(b[0].desc, "Cameron Boozer Double Double No");
});

test("Double Double YES / To Record A Double Double is Over 0.5", () => {
  for (const sub of ["Double Double YES", "To Record A Double Double"]) {
    const leg = Ocr.parseSlipLines(ddSlip(sub), { now: NOW }).legs[0];
    assert.deepEqual([leg.player, leg.stat, leg.side, leg.line], ["Cameron Boozer", "Double Double", "Over", 0.5], sub);
  }
  // No Yes/No anywhere: flagged for the tipster, never guessed.
  const bare = Ocr.parseSlipLines(ddSlip("Double Double"), { now: NOW });
  assert.equal(bare.legs[0].side, "");
  assert.ok(bare.flags.some((f) => f.field === "side"));
});

test("1st Qtr Points is Points for Q1 only, next to a full-game leg", () => {
  const slip = Ocr.parseSlipLines(Q1_SLIP, { now: NOW });
  assert.equal(slip.legs.length, 2);
  const [ij, luka] = slip.legs;
  assert.deepEqual([ij.player, ij.stat, ij.side, ij.line, ij.period], ["Isaiah Jackson", "Points", "Under", 2.5, "Q1"]);
  assert.equal(luka.period, undefined);
  const b = Ocr.legToBuilderLeg(Object.assign({}, ij, { sport: "NBA" }));
  assert.deepEqual([b.prop_key, b.side, b.line, b.period, b.desc],
    ["points", "Under", 2.5, "Q1", "Isaiah Jackson Under 2.5 Q1 Points"]);
  assert.equal("period" in Ocr.legToBuilderLeg(Object.assign({}, luka, { sport: "NBA" })), false);
});

test("the review box keeps the period editable: Q1 Points reads back as Points + Q1", () => {
  const b = Ocr.legToBuilderLeg({ kind: "player", player: "Isaiah Jackson", stat: "Q1 Points", market: "Q1 Points",
    line: 2.5, side: "Under", sport: "NBA" });
  assert.deepEqual([b.prop, b.stat, b.period], ["points", "Points", "Q1"]);
  for (const [raw, want] of [["2nd Half Points", "H2"], ["3rd Quarter Rebounds", "Q3"], ["Points - 1st Half", "H1"]]) {
    assert.equal(Ocr.legToBuilderLeg({ kind: "player", player: "P", stat: raw, line: 4.5, side: "Over", sport: "NBA" }).period, want, raw);
  }
  // An unknown stat with a period stays free text (never a full-game stand-in).
  const odd = Ocr.legToBuilderLeg({ kind: "player", player: "P", stat: "1st Qtr Dunks", line: 1.5, side: "Over", sport: "NBA" });
  assert.equal(odd.custom, true);
  assert.equal(odd.prop, undefined);
  const ui = fs.readFileSync(path.join(__dirname, "..", "assets", "slip-ocr-ui.js"), "utf8");
  assert.match(ui, /var stat = \(leg\.period \? leg\.period \+ " " : ""\) \+ \(leg\.stat \|\| leg\.market \|\| ""\);/);
});

test("full-game slips are unchanged by the period reader", () => {
  const slip = parsed("text/nba-rebounds-under.txt");
  assert.equal(slip.legs[0].period, undefined);
  assert.equal("period" in Ocr.legToBuilderLeg(Object.assign({}, slip.legs[0], { sport: "NBA" })), false);
});

test("an Under bet printed with a (+x) line keeps the line and the Under side", () => {
  for (const [file, who, stat, line] of [
    ["text/nba-maxey-rebounds-under-plusline.txt", "Maxey", "Rebounds", 4.5],
    ["text/nba-flemings-points-under-plusline.txt", "Kingston Flemings", "Points", 7.5]
  ]) {
    const slip = parsed(file);
    assert.equal(slip.legs.length, 1, file);
    const leg = slip.legs[0];
    assert.deepEqual([leg.player, leg.stat, leg.line, leg.side], [who, stat, line, "Under"], file);
    const tip = Ocr.slipToTipDraft(slip);
    assert.equal(tip.legs[0].side, "Under", file);
    assert.doesNotMatch(tip.legs[0].desc || tip.legs[0].stat, /\+\s*\d|handicap|line \+/i, file);
  }
});

test("Pts + Reb + Ast reads as PRA", () => {
  const tip = Ocr.slipToTipDraft(parsed("text/nba-allen-pra-under.txt"));
  assert.equal(tip.legs[0].prop, "pra");
  assert.equal(tip.legs[0].line, 24.5);
  assert.equal(tip.legs[0].side, "Under");
});
