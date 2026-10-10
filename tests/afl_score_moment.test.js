const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const M = require("../assets/afl-score-moment.js");

test("score diff maps team totals to goals and behinds", () => {
  const prev = {};
  const g1 = { match_id: "m1", sport: "AFL", hscore: 10, ascore: 8 };
  assert.deepEqual(M.scoreEvents([g1], prev), []);
  assert.equal(prev.m1.h, 10);

  const events = M.scoreEvents([{ match_id: "m1", hscore: 16, ascore: 8 }], prev);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "goal");
  assert.equal(events[0].team, "home");

  const prev2 = { m1: { h: 16, a: 8 } };
  const behind = M.scoreEvents([{ match_id: "m1", hscore: 17, ascore: 8 }], prev2);
  assert.deepEqual(behind, [{ type: "behind", team: "home", matchId: "m1" }]);
});

test("leg goal tally bumps fire goal moments once", () => {
  const prev = {};
  const legs = [{ stat: "goals", current: 1 }];
  assert.deepEqual(M.legGoalEvents("t1", legs, prev), []);
  assert.equal(prev["t1:0"], 1);
  const legs2 = [{ stat: "goals", current: 2 }];
  const ev = M.legGoalEvents("t1", legs2, prev);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].type, "goal");
});

test("SVG moment assets honour reduced motion and ship with dashboard", () => {
  const js = read("assets/afl-score-moment.js");
  const html = read("index.html");
  const live = read("live/index.html");
  assert.doesNotMatch(js, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  assert.match(js, /prefers-reduced-motion/);
  assert.match(M.svgFor("goal"), /<svg/);
  assert.match(M.svgFor("behind"), /afl-ball-behind/);
  assert.match(html, /afl-score-moment\.js/);
  assert.match(html, /aflScoreTrackGames/);
  assert.match(live, /afl-score-moment\.js/);
  const apexCss = read("assets/theme-apex.css");
  const apexJs = read("assets/theme-apex.js");
  assert.match(apexCss, /apex-winner-moment/);
  assert.match(apexCss, /apex-ticket-stamp/);
  assert.match(apexJs, /apex-win-glow/);
});
