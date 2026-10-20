const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const FU = require("../assets/follower-units.js");

// index.html plus the follower views it lazy-loads (job 03).
const html = ["index.html", "assets/follower-views.js"].map((f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8")).join("\n");

test("hero shows a signed all-time figure", () => {
  assert.deepEqual(FU.heroText(12.5), {text: "+12.50u", cls: "pos"});
  assert.deepEqual(FU.heroText(-3), {text: "-3.00u", cls: "neg"});
  assert.deepEqual(FU.heroText(0), {text: "0.00u", cls: "zero"});
  assert.deepEqual(FU.heroText(2), {text: "+2.00u", cls: "pos"});
  assert.deepEqual(FU.heroText(-1.5), {text: "-1.50u", cls: "neg"});
  assert.match(FU.heroHtml(4), /fl-units-num pos/);
  assert.match(FU.heroHtml(4), /\+4\.00u/);
  assert.match(FU.heroHtml(-1.5), /fl-units-num neg/);
  assert.match(FU.heroHtml(-1.5), /-1\.50u/);
});

test("cumulative line follows the showing period", () => {
  const feed = [
    {result: "win", profit_units: 2, settled_at: "2026-09-02T00:00:00Z"},
    {result: "loss", profit_units: -1, settled_at: "2026-10-03T00:00:00Z"},
    {result: "win", profit_units: 4, settled_at: "2026-10-11T00:00:00Z"},
    {result: "pending", profit_units: 9, settled_at: "2026-10-12T00:00:00Z"}
  ];
  const clock = {monthKey: function (ms) {
    const d = new Date(ms);
    return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
  }};
  const all = FU.series(feed, "", clock);
  assert.deepEqual(all.map((p) => p.y), [0, 2, 1, 5]);
  const oct = FU.series(feed, "2026-10", clock);
  assert.deepEqual(oct.map((p) => p.y), [0, -1, 3]);
  const chart = FU.chartHtml(oct);
  assert.match(chart, /<svg/);
  assert.match(chart, /fl-units-zero/);
  assert.match(chart, /fill-opacity="0\.22"/);
  assert.match(chart, /0\.00u/);
  assert.match(chart, /\+3\.00u/);
  assert.match(chart, /var\(--loss\)/);
  assert.match(chart, /var\(--win\)/);
  assert.match(html, /follower-units\.js/);
  assert.match(html, /fl-units-hero/);
  const view = html.slice(html.indexOf("function renderFollowerView"), html.indexOf("/* ---------- ALL COMMUNITIES"));
  const painted = view.slice(view.indexOf('$("follower").innerHTML'));
  assert.ok(painted.indexOf("unitsBlock") < painted.indexOf("dhead"));
  const mount = html.slice(html.indexOf("function mountFollowerPromoChip"), html.indexOf("async function openMyTips"));
  assert.match(mount, /tb-promo-dock/);
  assert.match(mount, /\$\("follower"\)/);
  assert.match(mount, /host\.appendChild\(wrap\)/);
  assert.doesNotMatch(mount, /document\.body\.appendChild/);
  assert.match(html, /game-view-pill/);
  assert.match(html, /Game view →/);
  assert.doesNotMatch(html, /open this game/);
});
