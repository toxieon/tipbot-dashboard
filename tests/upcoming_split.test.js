// node --test tests/   0.43.4: Upcoming Bets header counts only tips still upcoming.
// A date-only start (NBA-2026-037, 2026-10-03) is the end of that local day.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const U = require("../assets/upcoming-split.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const NOW = Date.parse("2026-10-06T02:00:00Z");

function tip(over) {
  return Object.assign({
    tip_id: "g:NBA-2026-037", display_id: "NBA-2026-037", status: "Pending",
    game_name: "Lakers v Celtics", game_start: "2026-10-03",
  }, over || {});
}

test("a date-only start is the end of that local day; a real clock time is unchanged", () => {
  const end = new Date(2026, 9, 3, 23, 59, 59);
  assert.equal(U.tipStartTs({game_start: "2026-10-03"}), Math.floor(end.getTime() / 1000));
  assert.equal(U.tipStartTs({start_date: "2026-10-03"}), Math.floor(end.getTime() / 1000));
  assert.equal(U.tipStartTs({game_start: "2026-10-03T03:05:00Z"}), Math.floor(Date.parse("2026-10-03T03:05:00Z") / 1000));
  assert.equal(U.tipStartTs({game_start: "2026-10-03 03:05:00"}), Math.floor(Date.parse("2026-10-03T03:05:00") / 1000));
  assert.equal(U.tipStartTs({commence_time: "1790996700"}), 1790996700);
  assert.equal(U.tipStartTs({}), null);
  assert.equal(U.tipStartTs(null), null);
});

test("NBA-2026-037 (date only, still Pending) is finished, not upcoming", () => {
  const noonToday = new Date(2026, 9, 6, 12, 0, 0).getTime();
  assert.equal(U.tipLooksFinished(tip({game_start: "2026-10-06"}), {}, {}, noonToday), false);
  assert.equal(U.tipLooksFinished(tip(), {}, {}, NOW), true);

  const future = tip({tip_id: "g:AFL-2026-099", display_id: "AFL-2026-099", game_name: "Geelong v Sydney", game_start: "2026-10-10T06:00:00Z"});
  const recent = tip({tip_id: "g:NFL-1", game_name: "Still on", game_start: new Date(NOW - 2 * 3600 * 1000).toISOString()});
  const old = tip({tip_id: "g:NFL-2", game_name: "Long done", game_start: new Date(NOW - 5 * 3600 * 1000).toISOString()});
  const split = U.splitGroups([tip(), future, recent, old], {}, {}, NOW);
  assert.equal(split.upcomingCount, 2);
  assert.equal(split.finishedCount, 2);
  assert.deepEqual(Object.keys(split.upcoming).sort(), ["Geelong v Sydney", "Still on"]);
  assert.deepEqual(Object.keys(split.finished).sort(), ["Lakers v Celtics", "Long done"]);
  assert.equal(split.upcomingSum, "2 upcoming");
  assert.equal(split.finishedSum, "2 to settle");
});

test("header counts follow the split, including the empty upcoming line", () => {
  const onlyFinished = U.splitGroups([tip()], {}, {}, NOW);
  assert.equal(onlyFinished.upcomingCount, 0);
  assert.equal(onlyFinished.finishedCount, 1);
  assert.equal(onlyFinished.upcomingSum, "0 upcoming");
  assert.equal(onlyFinished.finishedSum, "1 to settle");
  assert.equal(onlyFinished.upcomingEmpty, "No upcoming bets — 1 finished tip waiting to be graded (see Finished games).");

  const two = U.splitGroups([tip(), tip({tip_id: "b", game_name: "Other game"})], {}, {}, NOW);
  assert.equal(two.upcomingEmpty, "No upcoming bets — 2 finished tips waiting to be graded (see Finished games).");
  assert.equal(two.finishedSum, "2 to settle");

  const none = U.splitGroups([], {}, {}, NOW);
  assert.equal(none.upcomingSum, "0 upcoming");
  assert.equal(none.finishedSum, "");
  assert.equal(none.upcomingEmpty, "No upcoming bets. Build one with \uFF0B Build a tip.");

  const soon = U.splitGroups([tip({game_start: "2026-12-01T00:00:00Z", game_name: "Later"})], {}, {}, NOW);
  assert.equal(soon.upcomingSum, "1 upcoming");
  assert.equal(soon.finishedSum, "");
  assert.equal(soon.upcomingEmpty, none.upcomingEmpty);
});

test("the server page sets those badges from the split, not from every pending tip", () => {
  assert.match(html, /<script src="\.\/assets\/upcoming-split\.js\?v=/);
  assert.match(html, /TBUpcoming\.splitGroups\(queued, starts, finishedMap\)/);
  assert.match(html, /setPanelSum\(\$\("upcoming-panel"\), split\.upcomingSum\)/);
  assert.match(html, /setPanelSum\(\$\("finished-panel"\), split\.finishedSum\)/);
  assert.match(html, /esc\(split\.upcomingEmpty\)/);
  assert.match(html, /return TBUpcoming\.tipStartTs\(t\)/);
  assert.match(html, /return TBUpcoming\.tipLooksFinished\(t, starts, finished\)/);
  assert.doesNotMatch(html, /id="upcoming-panel" data-sec="upcoming" data-sec-sum=/);
  assert.doesNotMatch(html, /tips\.queued\|\|\[\]\)\.length\+' queued'/);
});
