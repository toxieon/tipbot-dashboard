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
  assert.equal(slip.date_time, "Sat 10 Oct 19:15");
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
  assert.equal(slip.legs[0].date_time, "Fri 12 Sep 19:20");
  assert.equal(slip.legs[0].selection, "Geelong");
  assert.equal(slip.legs[0].market, "Head to Head");
  assert.equal(slip.legs[1].event, "Sydney Swans v Brisbane Lions");
  assert.equal(slip.legs[1].date_time, "Sat 13 Sep 14:10");
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

const NOW = Date.parse("2026-10-15T12:00:00Z");

test("Today and Tomorrow are dates, not legs, and keep the start time", () => {
  const text = [
    "Same Game Multi @ 476.00",
    "3 Legs",
    "Tomorrow 16 Oct 11:16",
    "Seattle Seahawks @ Denver Broncos",
    "Emanuel Wilson",
    "Anytime Touchdown",
    "Seattle Seahawks",
    "Head to Head",
    "Jaxon Smith-Njigba",
    "70+ Receiving Yards",
  ].join("\n");
  const slip = Ocr.parseSlipLines(text, { now: NOW });
  assert.equal(slip.legs.length, 3);
  assert.equal(slip.legs[0].player, "Emanuel Wilson");
  assert.equal(slip.legs[0].stat, "Anytime TD");
  assert.equal(slip.date_time, "Fri 16 Oct 11:16");
  assert.equal(slip.start_local, "2026-10-16T11:16");
  assert.equal(slip.sport, "NFL");
  const today = Ocr.parseSlipLines([
    "Same Game Multi @ 5.00",
    "1 Leg",
    "Atlanta Dream @ Golden State Valkyries",
    "Today 15 Oct 09:00",
    "Rhyne Howard",
    "15+ Points",
  ].join("\n"), { now: NOW });
  assert.equal(today.legs.length, 1);
  assert.equal(today.legs[0].player, "Rhyne Howard");
  assert.equal(today.date_time, "Thu 15 Oct 09:00");
  assert.equal(today.start_local, "2026-10-15T09:00");
  assert.equal(today.sport, "WNBA");
  const tip = Ocr.slipToTipDraft(slip);
  assert.equal(tip.game_start, "2026-10-16T11:16");
  assert.equal(tip.legs[0].prop, "anytime_td");
  assert.equal(tip.legs[0].custom, undefined);
  assert.equal(tip.legs[1].kind, "team");
  assert.equal(tip.legs[1].market, "Head to Head");
  assert.equal(tip.legs[1].team, "Seattle Seahawks");
  assert.equal(tip.legs[1].custom, undefined);
  assert.equal(tip.legs[2].prop, "receiving_yards");
  assert.equal(tip.legs[2].custom, undefined);
  const unmatched = Ocr.builderStateForSlip(tip, null, { parsedLegs: slip.legs });
  assert.equal(unmatched.custom, true);
  assert.equal(unmatched.espn, false);
  assert.equal(unmatched.game_start, "2026-10-16T11:16");
  assert.equal(unmatched.customStartDay, "2026-10-16");
});

test("NBA and NFL props, line and total drop the custom flag", () => {
  const props = [
    { player: "Rhyne Howard", stat: "Points", line: 15, side: "Over", sport: "WNBA" },
    { player: "A", stat: "Rebounds", line: 8, side: "Over", sport: "NBA" },
    { player: "B", stat: "Assists", line: 6, side: "Under", sport: "NBL" },
    { player: "C", stat: "Threes Made", line: 3, side: "Over", sport: "NBA" },
    { player: "D", stat: "Steals", line: 1, side: "Over", sport: "WNBA" },
    { player: "E", stat: "Blocks", line: 1, side: "Over", sport: "NBA" },
    { player: "F", stat: "Points + Rebounds + Assists", line: 30, side: "Over", sport: "NBA" },
    { player: "Emanuel Wilson", stat: "Anytime TD", line: 1, side: "Over", sport: "NFL" },
    { player: "Sam Darnold", stat: "Passing Yards", line: 150, side: "Over", sport: "NFL" },
  ].map((leg) => Ocr.legToBuilderLeg(leg));
  assert.deepEqual(props.map((l) => l.prop), [
    "points", "rebounds", "assists", "threes_made", "steals", "blocks", "pra", "anytime_td", "passing_yards",
  ]);
  assert.equal(props.some((l) => l.custom), false);
  assert.equal(props[0].league, "wnba");
  assert.equal(props[2].league, "nbl");
  assert.equal(props[7].league, "nfl");

  const h2h = Ocr.legToBuilderLeg({ kind: "team", team: "Seattle Seahawks", market: "Head to Head", sport: "NFL" });
  assert.equal(h2h.kind, "team");
  assert.equal(h2h.custom, undefined);
  const line = Ocr.legToBuilderLeg({ kind: "team", team: "Denver Broncos", market: "Line", line: -4.5, sport: "NFL" });
  assert.equal(line.market, "Line");
  assert.equal(line.line, -4.5);
  assert.equal(line.custom, undefined);
  const total = Ocr.legToBuilderLeg({ kind: "total", market: "Total", selection: "Over 220.5", side: "Over", line: 220.5, sport: "NBA" });
  assert.equal(total.market, "Total");
  assert.equal(total.side, "Over");
  assert.equal(total.line, 220.5);
  assert.equal(total.custom, undefined);
  const custom = Ocr.legToBuilderLeg({ selection: "Mystery", market: "Special", sport: "NFL" });
  assert.equal(custom.custom, true);

  const text = [
    "Same Game Multi @ 3.00",
    "2 Legs",
    "Los Angeles Lakers @ Boston Celtics",
    "Today 15 Oct 10:30",
    "Los Angeles Lakers -4.5",
    "Line",
    "Over 220.5",
    "Total Points",
  ].join("\n");
  const slip = Ocr.parseSlipLines(text, { now: NOW });
  assert.equal(slip.legs.length, 2);
  assert.equal(slip.sport, "NBA");
  assert.equal(slip.start_local, "2026-10-15T10:30");
  const tip = Ocr.slipToTipDraft(slip);
  assert.equal(tip.legs[0].market, "Line");
  assert.equal(tip.legs[0].line, -4.5);
  assert.equal(tip.legs[0].custom, undefined);
  assert.equal(tip.legs[1].market, "Total");
  assert.equal(tip.legs[1].line, 220.5);
  assert.equal(tip.legs[1].custom, undefined);
});

test("NFL and WNBA scoreboards match the game and send the event id", async () => {
  const nflBoard = {
    events: [{
      id: "401872995",
      date: "2026-10-16T00:15Z",
      competitions: [{ competitors: [
        { homeAway: "away", team: { displayName: "Seattle Seahawks" } },
        { homeAway: "home", team: { displayName: "Denver Broncos" } },
      ] }],
    }],
  };
  const urls = [];
  const games = await Ocr.loadSportFixtures("NFL", "2026-10-16T11:16", "Seattle Seahawks @ Denver Broncos", {
    loadAfl: async () => { throw new Error("AFL fixtures are not the NFL list"); },
    fetchJson: async (url) => {
      urls.push(url);
      return /dates=20261016/.test(url) ? nflBoard : { events: [] };
    },
  });
  assert.deepEqual(urls.map((u) => u.match(/dates=(\d+)/)[1]).sort(), ["20261015", "20261016", "20261017"]);
  assert.match(urls[0], /football\/nfl\/scoreboard/);
  assert.match(Ocr.espnScoreboardUrl("nbl", "20261016"), /basketball\/nbl\/scoreboard\?limit=100&dates=20261016/);
  assert.equal(Ocr.espnLeagueForSport("NBA"), "nba");
  const legs = [{ event: "Seattle Seahawks @ Denver Broncos", sport: "NFL", player: "Emanuel Wilson", stat: "Anytime TD", line: 1, side: "Over", kind: "player" }];
  const matched = Ocr.attachFixtureMatches(legs, games);
  assert.equal(matched[0].espn_event_id, "401872995");
  assert.equal(matched[0].game_id, "401872995");
  const tip = Ocr.slipToTipDraft({ sport: "NFL", event: "Seattle Seahawks @ Denver Broncos", legs: matched, start_local: "2026-10-16T11:16" });
  const state = Ocr.builderStateForSlip(tip, games[0], { parsedLegs: matched });
  assert.equal(state.custom, false);
  assert.equal(state.espn, true);
  assert.equal(state.espnLeague, "nfl");
  assert.equal(state.espnEvent.id, "401872995");
  assert.equal(state.game_start, "2026-10-16T00:15Z");
  assert.equal(state.legs[0].espn_event_id, "401872995");
  assert.equal(state.legs[0].prop, "anytime_td");
  assert.equal(state.legs[0].custom, undefined);

  const wnba = await Ocr.loadSportFixtures("WNBA", "2026-10-18T06:30", "Atlanta Dream @ Golden State Valkyries", {
    loadAfl: async () => { throw new Error("AFL fixtures are not the WNBA list"); },
    fetchJson: async () => ({
      events: [{
        id: "401772001",
        date: "2026-10-17T19:30Z",
        competitions: [{ competitors: [
          { homeAway: "away", team: { displayName: "Atlanta Dream" } },
          { homeAway: "home", team: { displayName: "Golden State Valkyries" } },
        ] }],
      }],
    }),
  });
  const wnbaLegs = Ocr.attachFixtureMatches([
    { event: "Atlanta Dream @ Golden State Valkyries", sport: "WNBA", kind: "team", team: "Golden State Valkyries", market: "Head to Head" },
    { event: "Atlanta Dream @ Golden State Valkyries", sport: "WNBA", player: "Rhyne Howard", stat: "Points", line: 15, side: "Over" },
  ], wnba);
  const wnbaTip = Ocr.slipToTipDraft({ sport: "WNBA", event: wnbaLegs[0].event, legs: wnbaLegs });
  const wnbaState = Ocr.builderStateForSlip(wnbaTip, wnba[0], { parsedLegs: wnbaLegs });
  assert.equal(wnbaState.espnEvent.id, "401772001");
  assert.equal(wnbaState.espnLeague, "wnba");
  assert.equal(wnbaState.game_start, "2026-10-17T19:30Z");
  assert.equal(wnbaState.legs[0].kind, "team");
  assert.equal(wnbaState.legs[0].custom, undefined);
  assert.equal(wnbaState.legs[1].prop, "points");
  assert.equal(wnbaState.legs[1].custom, undefined);
  assert.equal(wnbaState.legs[1].espn_event_id, "401772001");
});

test("screenshot import loads fixtures for the detected sport", () => {
  const ui = fs.readFileSync(path.join(root, "assets/slip-ocr-ui.js"), "utf8");
  const builder = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
  assert.match(ui, /loadSportFixtures\(sport, when, eventName/);
  assert.match(ui, /builderStateForSlip\(tip, primary/);
  assert.match(ui, /BUILD\._importGameStart/);
  assert.match(builder, /BUILD\._importGameStart/);
  assert.match(builder, /else if\(!BUILD\.espn && !BUILD\.custom\)\{ const gs=aflGameStartIso\(BUILD\.game\); if\(gs\) out\.game_start=gs; \}/);
});
