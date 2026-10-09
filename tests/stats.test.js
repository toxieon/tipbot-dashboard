// node --test tests/   Home Stats: ROI, units and streaks from settled tips.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

globalThis.TBTime = require("../assets/tbtime.js");
globalThis.TBSports = require("../assets/sport-marks.js");
globalThis.SvgCharts = require("../assets/svg-charts.js");
globalThis.ServerView = require("../assets/server-view.js");
const S = require("../assets/stats.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
const now = Date.parse("2026-10-09T04:00:00Z");

function tip(over) {
  return Object.assign({
    tip_id: "t",
    result: "Win",
    units: 1,
    odds: 2,
    profit_units: 1,
    settled_at: "2026-10-08T04:00:00Z",
    sport: "AFL",
    bet_type: "H2H"
  }, over);
}

test("ROI is profit divided by stake, as a percent", () => {
  const tips = [
    tip({ result: "Win", profit_units: 1.5, units: 1, odds: 2.5 }),
    tip({ result: "Loss", profit_units: -1, units: 1, odds: 1.9, tip_id: "b" })
  ];
  assert.equal(S.roiOf(S.unitsOf(tips), 2), 25);
  const out = S.compute(tips, { window: "30", now: now });
  assert.equal(out.units, 0.5);
  assert.equal(out.staked, 2);
  assert.equal(out.roi, 25);
});

test("units are the sum of settled profit", () => {
  const tips = [
    tip({ profit_units: 2, result: "Win" }),
    tip({ profit_units: 1.5, result: "Win", tip_id: "b", settled_at: "2026-10-07T04:00:00Z" }),
    tip({ profit_units: -1, result: "Loss", tip_id: "c", settled_at: "2026-10-06T04:00:00Z" })
  ];
  assert.equal(S.unitsOf(tips), 2.5);
  const out = S.compute(tips, { window: "30", now: now });
  assert.equal(out.units, 2.5);
});

test("current streak reads from the newest result; longest is the best win run", () => {
  // chronological (oldest → newest): L, W, W, W, L, W, W
  const days = [2, 3, 4, 5, 6, 7, 8];
  const results = ["L", "W", "W", "W", "L", "W", "W"];
  const tips = results.map((res, i) => tip({
    tip_id: String(i),
    result: res === "W" ? "Win" : "Loss",
    profit_units: res === "W" ? 1 : -1,
    settled_at: "2026-10-0" + days[i] + "T04:00:00Z"
  }));
  const st = S.streaksOf(tips);
  assert.equal(st.longestWin, 3);
  assert.equal(st.currentType, "W");
  assert.equal(st.currentN, 2);
  const losing = S.streaksOf(tips.concat([tip({
    tip_id: "end", result: "Loss", profit_units: -1, settled_at: "2026-10-09T03:00:00Z"
  })]));
  assert.equal(losing.currentType, "L");
  assert.equal(losing.currentN, 1);
  assert.equal(losing.longestWin, 3);
});

test("7d drops older tips; season keeps the Sydney year", () => {
  const tips = [
    tip({ tip_id: "new", profit_units: 2, settled_at: "2026-10-08T04:00:00Z" }),
    tip({ tip_id: "mid", profit_units: 3, settled_at: "2026-09-20T04:00:00Z" }),
    tip({ tip_id: "year", profit_units: 4, settled_at: "2026-04-01T04:00:00Z" }),
    tip({ tip_id: "old", profit_units: 10, settled_at: "2025-12-20T04:00:00Z" })
  ];
  assert.equal(S.compute(tips, { window: "7", now: now }).units, 2);
  assert.equal(S.compute(tips, { window: "30", now: now }).units, 5);
  assert.equal(S.compute(tips, { window: "season", now: now }).units, 9);
});

test("historical imports are left out of the record", () => {
  const tips = [
    tip({ tip_id: "live", profit_units: 1 }),
    tip({ tip_id: "imp", profit_units: 40, historical: true })
  ];
  const out = S.compute(S.taggedTips([{ server: { guild_id: "1", display_name: "A" }, detail: { tips: { settled: tips } } }]), { window: "30", now: now });
  assert.equal(out.units, 1);
  assert.equal(out.count, 1);
});

test("win rate uses the sport emoji map", () => {
  const out = S.compute([
    tip({ sport: "AFL", result: "Win", profit_units: 1 }),
    tip({ tip_id: "b", sport: "AFL", result: "Loss", profit_units: -1, settled_at: "2026-10-07T04:00:00Z" }),
    tip({ tip_id: "c", sport: "NBA", result: "Win", profit_units: 1, settled_at: "2026-10-06T04:00:00Z" })
  ], { window: "30", now: now });
  const afl = out.sports.find((s) => s.name === "AFL");
  const nba = out.sports.find((s) => s.name === "NBA");
  assert.equal(afl.mark, "🏉");
  assert.equal(afl.rate, 50);
  assert.equal(nba.mark, "🏀");
  assert.equal(nba.rate, 100);
  assert.equal(afl.label, "AFL"); // no doubled emoji next to the mark
});

test("index.html wires Stats from Home, not a bottom tab, and keeps the API base", () => {
  assert.match(html, /id="stats" hidden/);
  // Home only: the Home tile (and the lone-server Home header); no top-bar link.
  assert.doesNotMatch(html, /id="nav-stats"/);
  assert.doesNotMatch(html, /href="#\/stats"/);
  assert.match(html, /home-stats-tile/);
  const panelList = JSON.parse(html.match(/const panel=p=>\{for\(const x of (\[[^\]]*\])\)/)[1]);
  assert.ok(panelList.includes("stats"), "stats must be in panel()'s fixed list or it stays hidden");
  assert.match(html, new RegExp('<script src="\\./assets/stats\\.js\\?v=' + version.replace(/\./g, "\\.") + '"></script>'));
  assert.match(html, /if\(m\[0\]==="stats"\) return openStats\(\), true;/);
  assert.match(html, /const API="https:\/\/afl-tipster-bot\.onrender\.com";/);
  assert.doesNotMatch(html, /const API="";/);
  const tabs = fs.readFileSync(path.join(root, "assets", "theme-apex.js"), "utf8");
  assert.match(tabs, /var TABS = \["home", "build", "upcoming"\];/);
  assert.doesNotMatch(tabs, /var TABS = \[[^\]]*stats/);
});

test("stats.js compiles in a page-like VM and has no console calls", () => {
  const src = fs.readFileSync(path.join(root, "assets", "stats.js"), "utf8");
  assert.doesNotMatch(src, /console\.(log|debug|info|warn|error|trace)\s*\(/);
  const ctx = { window: {}, matchMedia: () => ({ matches: false }) };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.TBTime = require("../assets/tbtime.js");
  ctx.TBSports = require("../assets/sport-marks.js");
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: "stats.js" });
  assert.equal(typeof ctx.TBDashStats.compute, "function");
  const empty = ctx.TBDashStats.compute([], { window: "7", now: now });
  assert.equal(empty.units, 0);
  assert.equal(empty.roi, 0);
  assert.match(ctx.TBDashStats.render(empty), /No settled tips/);
});

// Hand-computed fixture: one admin server (/api/server shape) plus one follower
// feed (/api/follower shape, with a pending row that must be ignored).
test("fixture totals match hand-computed numbers (7d / 30d / season)", () => {
  const admin = { server: { guild_id: "A", display_name: "Alpha" }, detail: { tips: { settled: [
    { tip_id: "a1", status: "Settled", result: "Win",  units: 2, odds: 1.9, profit_units: 1.8, settled_at: "2026-10-08T04:00:00Z", sport: "AFL", bet_type: "H2H" },
    { tip_id: "a2", status: "Settled", result: "Loss", units: 1, odds: 2.5, profit_units: -1,  settled_at: "2026-10-05T04:00:00Z", sport: "AFL", bet_type: "Line" },
    { tip_id: "a3", status: "Settled", result: "Void", units: 1, odds: 1.8, profit_units: 0,   settled_at: "2026-10-04T04:00:00Z", sport: "NBA", bet_type: "H2H" },
    { tip_id: "a4", status: "Settled", result: "Win",  units: 1, odds: 3,   profit_units: 2,   settled_at: "2026-09-20T04:00:00Z", sport: "NBA", bet_type: "Player Points" },
    { tip_id: "a5", status: "Settled", result: "Loss", units: 2, odds: 2,   profit_units: -2,  settled_at: "2026-03-15T04:00:00Z", sport: "AFL", bet_type: "Line" }
  ] } } };
  const follow = { server: { guild_id: "B", display_name: "Bravo" }, detail: { feed: [
    { tip_id: "f1", status: "Settled", tip_status: "Settled", result: "Win", stake_units: 1, odds: 2.2, profit_units: 1.2, settled_at: "2026-10-07T04:00:00Z", bet_type: "H2H" },
    { tip_id: "f2", status: "Pending", tip_status: "Pending", result: null, stake_units: 1, odds: 1.5, profit_units: null, settled_at: null, bet_type: "H2H" }
  ] } };
  const tips = S.taggedTips([admin, follow]);
  assert.equal(tips.length, 6);

  const d7 = S.compute(tips, { window: "7", now: now });
  assert.equal(d7.count, 4);
  assert.deepEqual([d7.won, d7.lost, d7.push], [2, 1, 1]);
  assert.equal(d7.units, 2);        // 1.8 - 1 + 0 + 1.2
  assert.equal(d7.staked, 5);       // 2 + 1 + 1 + 1
  assert.equal(d7.roi, 40);         // 2 / 5
  assert.equal(d7.avgOdds, 2.1);    // (1.9 + 2.5 + 1.8 + 2.2) / 4
  assert.deepEqual(d7.streaks, { currentType: "W", currentN: 2, longestWin: 2 });
  assert.equal(d7.bestMarkets[0].name, "H2H");
  assert.equal(d7.bestMarkets[0].profit, 3);
  assert.equal(d7.worstMarkets[0].name, "Line");
  assert.equal(d7.worstMarkets[0].profit, -1);
  const byName = Object.fromEntries(d7.servers.map((s) => [s.name, s]));
  assert.deepEqual([byName.Alpha.profit, byName.Alpha.staked, byName.Alpha.roi], [0.8, 4, 20]);
  assert.deepEqual([byName.Bravo.profit, byName.Bravo.staked, byName.Bravo.roi], [1.2, 1, 120]);
  const afl = d7.sports.find((s) => s.name === "AFL");
  assert.equal(afl.rate, 50);

  const d30 = S.compute(tips, { window: "30", now: now });
  assert.equal(d30.units, 4);
  assert.equal(d30.staked, 6);
  assert.equal(d30.roi, 66.7);      // 4 / 6

  const season = S.compute(tips, { window: "season", now: now });
  assert.equal(season.count, 6);
  assert.equal(season.units, 2);
  assert.equal(season.staked, 8);
  assert.equal(season.roi, 25);
  // A month whose running total passes through 0 (the void) is still one bar.
  assert.deepEqual(season.monthly.map((m) => [m.key, m.value]), [["2026-03", -2], ["2026-09", 2], ["2026-10", 2]]);
  assert.deepEqual(season.streaks, { currentType: "W", currentN: 2, longestWin: 2 });
});

test("a full 25-tip server list shows the sample-size note", () => {
  const full = { server: { guild_id: "A" }, detail: { tips: { settled: Array.from({ length: 25 }, (_, i) => tip({ tip_id: String(i) })) } } };
  const small = { server: { guild_id: "B" }, detail: { tips: { settled: [tip({})] } } };
  assert.equal(S.cappedPacks([small]), false);
  assert.equal(S.cappedPacks([small, full]), true);
  const out = S.compute(S.taggedTips([full]), { window: "30", now: now });
  assert.match(S.render(out, { capped: true }), /ds-note/);
  assert.doesNotMatch(S.render(out, {}), /ds-note/);
});
