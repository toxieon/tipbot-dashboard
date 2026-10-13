// node --test tests/   0.57.6: Stats fetches settled rows for the selected window.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const T = require("../assets/tbtime.js");

test("statsSince maps 7/30/season to Sydney day bounds", () => {
  const src = html.match(/function statsSince\(w\)\{[\s\S]*?\n  \}/)[0];
  const ctx = { TBTime: T, Date: { now: () => Date.parse("2026-10-13T08:00:00Z") } };
  vm.runInNewContext(src + "; this.f = statsSince;", ctx);
  assert.equal(ctx.f("7"), "2026-10-05");
  assert.equal(ctx.f("30"), "2026-09-12");
  assert.equal(ctx.f("season"), "2026-01-01");
});
test("window change refetches instead of reusing all rows", () => {
  assert.match(html, /onWindow: function\(w\)\{ STATS_WINDOW=w; openStats\(\); \}/);
});
