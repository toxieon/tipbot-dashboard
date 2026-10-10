const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const MC = require("../assets/match-centre.js");
const FX = require("../assets/match-fx.js");
const builderJs = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("match centre: detects goals and behinds from counters", () => {
  const prev = MC.snapshot({ hteam: { name: "Geelong" }, ateam: { name: "Carlton" }, hgoals: 2, hbehinds: 3, agoals: 1, abehinds: 4, hscore: 15, ascore: 10 }, null);
  const next = MC.snapshot({ hteam: { name: "Geelong" }, ateam: { name: "Carlton" }, hgoals: 3, hbehinds: 3, agoals: 1, abehinds: 5, hscore: 21, ascore: 11 }, null);
  const ev = MC.detectEvents(prev, next, {});
  assert.deepEqual(
    ev.map((e) => e.type + ":" + e.team),
    ["goal:home", "behind:away"]
  );
});

test("match centre: falls back to point deltas", () => {
  const prev = MC.snapshot({ hteam: { name: "A" }, ateam: { name: "B" }, hscore: 12, ascore: 6 }, null);
  const next = MC.snapshot({ hteam: { name: "A" }, ateam: { name: "B" }, hscore: 18, ascore: 7 }, null);
  const ev = MC.detectEvents(prev, next, {});
  assert.ok(ev.some((e) => e.type === "goal" && e.team === "home"));
  assert.ok(ev.some((e) => e.type === "behind" && e.team === "away"));
});

test("match centre: applyLiveMatchFields merges scores onto game", () => {
  const g = { hscore: 0, ascore: 0 };
  MC.applyLiveMatchFields(g, { hscore: 30, ascore: 24, phase: { label: "Q2 4:10" } });
  assert.equal(g.hscore, 30);
  assert.equal(g.ascore, 24);
  assert.equal(g.phase.label, "Q2 4:10");
});

test("match centre: worm svg renders without external assets", () => {
  const svg = MC.wormSvg([{ home: 12, away: 6 }, { home: 18, away: 6 }]);
  assert.match(svg, /mc-worm-svg/);
  assert.doesNotMatch(svg, /http/i);
});

test("match FX: exposes goal and behind hooks", () => {
  assert.equal(typeof FX.goal, "function");
  assert.equal(typeof FX.behind, "function");
});

test("match centre: builder wiring and reduced motion CSS", () => {
  assert.match(builderJs, /paintMatchCentre/);
  assert.match(builderJs, /tickMatchCentre/);
  assert.match(builderJs, /id="match-centre"/);
  assert.match(builderJs, /TBMatchCentre\.onLiveTick/);
  assert.match(html, /match-centre\.js/);
  assert.match(html, /match-fx\.js/);
  assert.match(html, /prefers-reduced-motion:no-preference/);
  assert.match(html, /mc-ball-goal/);
});

test("match centre handoff doc exists", () => {
  const doc = fs.readFileSync(path.join(root, "docs/match_centre.md"), "utf8");
  assert.match(doc, /TBMatchFx/);
  assert.match(doc, /\/api\/live-stats/);
});
