// node --test tests/   Live page: player cards for games in progress.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const LC = require("../assets/live-cards.js");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "live/index.html"), "utf8");
const src = fs.readFileSync(path.join(root, "assets/live-cards.js"), "utf8");

function leg(model, player) {
  var games = model.games || [];
  for (var i = 0; i < games.length; i++) {
    var hit = games[i].legs.find(function (l) { return l.player === player; });
    if (hit) return {game: games[i], leg: hit};
  }
  return null;
}

test("market line reads side, number and stat", () => {
  assert.equal(LC.marketLine({side: "Under", line: 19.5, stat: "Disposals"}), "under 19.5 disposals");
  assert.equal(LC.marketLine({side: "over", line: 30, stat: "points"}), "over 30 points");
  assert.equal(LC.marketLine({text: "Bontempelli 30+ disposals"}), "over 30 disposals");
});

test("status is on-track, at-risk, hit or miss", () => {
  assert.equal(LC.statusOf({side: "over", current: 22, line: 28.5, fraction: 0.62}), "on-track");
  assert.equal(LC.statusOf({side: "under", current: 14, line: 19.5, fraction: 0.62}), "at-risk");
  assert.equal(LC.statusOf({side: "over", current: 3, line: 2.5, fraction: 0.62}), "hit");
  assert.equal(LC.statusOf({side: "under", current: 6, line: 4.5, fraction: 0.62}), "miss");
  assert.equal(LC.statusOf({side: "over", current: 10, line: 20}), "on-track");
  assert.equal(LC.statusOf({side: "under", current: null, line: 19.5}), "");
});

test("sample board keeps live legs and drops imports and finished games", () => {
  const model = LC.buildModel(LC.sampleInput());
  assert.equal(model.serverName, "Saturday server");
  assert.equal(model.games.length, 2);
  const afl = model.games[0];
  assert.equal(afl.clock, "Q3 8:12");
  assert.equal(afl.home.name, "Geelong");
  assert.equal(afl.home.score, 68);
  assert.equal(afl.away.name, "Carlton");
  assert.equal(afl.away.score, 54);
  const risk = leg(model, "Patrick Dangerfield");
  assert.equal(risk.leg.market, "under 19.5 disposals");
  assert.equal(risk.leg.status, "at-risk");
  assert.equal(risk.leg.current, 14);
  assert.equal(risk.leg.unitsText, "2u");
  assert.equal(risk.leg.oddsText, "1.85");
  assert.ok(risk.leg.pct > 0 && risk.leg.pct < 100);
  assert.equal(leg(model, "Marcus Bontempelli").leg.status, "on-track");
  assert.equal(leg(model, "Jeremy Cameron").leg.status, "hit");
  assert.equal(leg(model, "Tom Stewart").leg.status, "miss");
  assert.equal(leg(model, "LeBron James").leg.status, "on-track");
  assert.equal(leg(model, "LeBron James").game.clock, "Q4 2:11");
  assert.equal(leg(model, "Imported Player"), null);
  assert.equal(leg(model, "Finished Player"), null);
  const html = LC.render(model);
  assert.match(html, /under 19\.5 disposals/);
  assert.match(html, /On track/);
  assert.match(html, /At risk/);
  assert.match(html, />Hit</);
  assert.match(html, />Miss</);
  assert.match(html, /role="progressbar"/);
  assert.match(html, /2u · @ 1\.85/);
  assert.doesNotMatch(html, /Imported Player|Finished Player/);
});

test("AFL live totals fill a count the prop payload left blank", () => {
  const input = {
    server: {tips: {queued: [{
      tip_id: "t1", units: 1, odds: 1.83, game_name: "Geelong v Carlton", match_id: "CD_M9",
      legs: [{player: "Patrick Dangerfield", stat: "Disposals", side: "Under", line: 19.5}]
    }], settled: []}},
    propCounts: {tips: {"t1": [{line: 19.5, side: "Under"}]}},
    liveTips: {games: [{
      match_id: "CD_M9", game_name: "Geelong v Carlton", sport: "AFL", concluded: false, complete: 62,
      hscore: 40, ascore: 38, phase: {label: "Q3 4:00"},
      tips: [{tip_id: "t1"}]
    }]},
    fixtures: {games: []},
    liveStats: {}
  };
  assert.deepEqual(LC.statQueries(input), [{match: "CD_M9", complete: 62}]);
  input.liveStats = {CD_M9: {available: true, players: {patrickdangerfield: {summary: {disposals: 14}}}}};
  const row = leg(LC.buildModel(input), "Patrick Dangerfield");
  assert.equal(row.leg.current, 14);
  assert.equal(row.leg.status, "at-risk");
  assert.equal(row.leg.market, "under 19.5 disposals");
});

test("a settled tip and a game that is over stay off the board", () => {
  const model = LC.buildModel({
    server: {tips: {queued: [
      {tip_id: "soon", units: 1, odds: 1.5, game_name: "Geelong v Carlton", status: "Pending",
        legs: [{player: "Still Playing", stat: "goals", side: "Over", line: 2, current: 1}]},
      {tip_id: "done", units: 1, odds: 1.5, result: "Win", game_name: "Geelong v Carlton",
        legs: [{player: "Already Settled", stat: "goals", side: "Over", line: 1, current: 2}]}
    ], settled: []}},
    liveTips: {games: [{
      match_id: "CD_X", game_name: "Geelong v Carlton", sport: "AFL", concluded: false, complete: 40,
      hscore: 20, ascore: 18, phase: {label: "Q2 10:00"},
      tips: [{tip_id: "soon"}, {tip_id: "done"}]
    }]}
  });
  assert.equal(leg(model, "Still Playing").leg.status, "on-track");
  assert.equal(leg(model, "Already Settled"), null);
});

test("server choice prefers the link, then the saved server", () => {
  const servers = [{guild_id: "11", display_name: "One"}, {guild_id: "22", display_name: "Two"}];
  assert.equal(LC.pickGuild(servers, "22", "11").id, "22");
  assert.equal(LC.pickGuild(servers, "", "11").id, "11");
  assert.equal(LC.pickGuild(servers, "", "nope").id, "11");
  assert.deepEqual(LC.endpointPaths("22"), {
    servers: "/api/servers?lite=1",
    liveTips: "/api/live-tips?guild_id=22",
    server: "/api/server?guild_id=22",
    propCounts: "/api/server/prop-counts?guild_id=22",
    fixtures: "/api/fixtures?rosters=0"
  });
  assert.equal(LC.liveStatsPath("CD_M9", 62), "/api/live-stats?match=CD_M9&complete=62");
  assert.equal(LC.POLL_MS, 45000);
});

test("the live page polls while visible and only calls existing endpoints", () => {
  assert.match(page, /@supports \(overflow:clip\)\{html,body\{overflow-x:clip\}\}/);
  assert.equal((page.match(/rel="manifest"/g) || []).length, 1);
  assert.equal((page.match(/rel="apple-touch-icon"/g) || []).length, 1);
  assert.match(page, /min-height:44px/);
  assert.match(page, /visibilitychange/);
  assert.match(page, /document\.hidden/);
  assert.match(page, /LC\.POLL_MS/);
  assert.match(page, /sample/);
  assert.match(page, /endpointPaths/);
  assert.match(page, /liveStatsPath/);
  assert.match(page, /statQueries/);
  assert.match(page, /\/api\/servers\?lite=1/);
  assert.doesNotMatch(page, /\/api\/live-board/);
  assert.doesNotMatch(src + "\n" + page, /forward|mirror|master|consensus/i);
});
