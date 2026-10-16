const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const FU = require("../assets/follower-units.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("hero shows a signed all-time figure", () => {
  assert.deepEqual(FU.heroText(12.5), {text: "+12.5", cls: "pos"});
  assert.deepEqual(FU.heroText(-3), {text: "-3", cls: "neg"});
  assert.deepEqual(FU.heroText(0), {text: "0", cls: "zero"});
  assert.match(FU.heroHtml(4), /fl-units-num pos/);
  assert.match(FU.heroHtml(4), /\+4/);
  assert.match(FU.heroHtml(-1.5), /fl-units-num neg/);
  assert.match(FU.heroHtml(-1.5), /-1\.5/);
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
  assert.match(FU.chartHtml(oct), /<svg/);
  assert.match(html, /follower-units\.js/);
  assert.match(html, /fl-units-hero/);
});
