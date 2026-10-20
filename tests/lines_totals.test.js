// node --test tests/   Lines, alternate lines, game and team totals: builder text, slip import, live card.
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../assets/espn-props.js");
const Ocr = require("../assets/slip-ocr.js");

test("builder text TipBot can parse and grade", () => {
  assert.equal(P.teamMarketText("line", "Seattle Seahawks", "", "-3.5"), "Seattle Seahawks -3.5");
  assert.equal(P.teamMarketText("line", "Atlanta Falcons", "", "7"), "Atlanta Falcons +7");
  assert.equal(P.teamMarketText("total", "", "Under", "47"), "Under 47");
  assert.equal(P.teamMarketText("team_total", "Los Angeles Lakers", "Over", "110.5"), "Los Angeles Lakers Team Total Over 110.5");
  assert.equal(P.teamMarketText("line", "SEA", "", ""), "");
  assert.equal(P.teamMarketText("team_total", "", "Over", "5"), "");
  for (const lg of ["nfl", "nba", "wnba", "nbl"]) assert.ok(P.hasLines(lg), lg);
  assert.ok(!P.hasLines("afl"));
});

test("slip team total and alternate line", () => {
  const leg = { kind: "team", market: "Team Total", team: "Los Angeles Lakers", side: "Over", line: 110.5 };
  assert.equal(Ocr.legDescription(leg), "Los Angeles Lakers Team Total Over 110.5");
  assert.equal(Ocr.legDescription({ kind: "team", market: "Line", team: "Seattle Seahawks", line: -3.5 }), "Seattle Seahawks -3.5");
  const slip = Ocr.parseSlipLines(["Same Game Multi @ 3.00", "2 Legs", "Boston Celtics @ Los Angeles Lakers",
    "Today 15 Oct 09:00", "Over 110.5", "Los Angeles Lakers Total Points", "Seattle Seahawks -10.5", "Alternate Line"].join("\n"),
    { now: new Date("2026-10-15T08:00:00") });
  const tt = slip.legs.find(l => l.market === "Team Total");
  assert.ok(tt, JSON.stringify(slip.legs));
  assert.equal(tt.team, "Los Angeles Lakers");
  assert.equal(tt.side, "Over");
  assert.equal(tt.line, 110.5);
  const ln = slip.legs.find(l => l.market === "Line");
  assert.ok(ln && ln.line === -10.5, JSON.stringify(slip.legs));
});

test("game total market stays a game total", () => {
  const slip = Ocr.parseSlipLines(["Same Game Multi @ 3.00", "1 Leg", "Boston Celtics @ Los Angeles Lakers",
    "Today 15 Oct 09:00", "Over 220.5", "Total Points"].join("\n"), { now: new Date("2026-10-15T08:00:00") });
  assert.equal(slip.legs[0].market, "Total");
});

test("Game view card shows the margin label and Push", () => {
  const FL = require("../assets/follower-live.js");
  assert.equal(FL.statusOf("push"), "push");
  assert.equal(FL.statusLabel("push"), "Push");
  const html = FL.render({ game: { game_name: "ATL @ SEA", state: "in", live: true, phase_label: "Q2 5:00" }, tipsters: [{ name: "T", legs: [
    { id: "a:0", player: "SEA -3.5", line_label: "SEA -3.5", current: 7, line: -3.5, status: "pending",
      live_label: "SEA -3.5: leading by 7" }] }] });
  assert.match(html, /leading by 7/);
  assert.doesNotMatch(html, /7\/-3\.5/);
});
