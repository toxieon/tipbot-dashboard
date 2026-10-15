// node --test tests/charts.test.js  Chart hosts, units, and self-hosted libraries.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..");
const C = require("../assets/tb-charts.js");
const read = (rel) => fs.readFileSync(path.join(root, rel));

test("empty series draw nothing and a line waits until it is on screen", () => {
  assert.equal(C.areaChart({ data: [] }), "");
  assert.equal(C.areaChart({ data: [4] }), "");
  assert.equal(C.spark({ data: [1] }), "");
  assert.equal(C.barChart({ bars: [] }), "");
  assert.equal(C.donut({ slices: [{ name: "TAB", n: 0 }] }), "");
  const html = C.areaChart({ data: [0, 2.5, -1], aria: "Units over time", unit: "u" });
  assert.match(html, /data-tb-lazy="1"/);
  assert.match(html, /data-tb-kind="line"/);
  assert.match(html, /role="img"/);
  const spec = JSON.parse(html.match(/<script type="application\/json" class="tb-spec">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(spec.data, [0, 2.5, -1]);
  assert.equal(spec.unit, "u");
  assert.equal(spec.signed, true);
});

test("profit is green, loss is red, and axes can show units or dollars", () => {
  assert.equal(C.seriesTone([0, 4], "end"), "win");
  assert.equal(C.seriesTone([2, -1], "end"), "loss");
  assert.equal(C.seriesTone([3, 1], "trend"), "loss");
  assert.equal(C.seriesTone([1, 3], "trend"), "win");
  assert.equal(C.fmtUnit(12.4, { unit: "u", signed: true }), "+12.4u");
  assert.equal(C.fmtUnit(-2, { unit: "u", signed: true }), "-2u");
  assert.equal(C.fmtUnit(0, { unit: "u", signed: true }), "0u");
  assert.equal(C.fmtUnit(18, { unit: "$", signed: true }), "+$18");
  assert.equal(C.fmtUnit(-3.5, { unit: "$", signed: true }), "-$3.5");
  assert.equal(C.fmtUnit(58.8, { unit: "%", signed: false }), "58.8%");
  const up = C.plotY(18.4, 0, 18.4, 36);
  const flat = C.plotY(0, 0, 18.4, 36);
  assert.ok(up < flat, "a higher value sits higher on the chart");
});

test("chart libraries are self-hosted, small enough, and free to ship", () => {
  const uplot = read("assets/vendor/uplot/uPlot.iife.min.js");
  const uplotCss = read("assets/vendor/uplot/uPlot.min.css");
  const bars = read("assets/vendor/echarts/echarts-pie-bar.min.js");
  const adapter = read("assets/tb-charts.js");
  assert.match(read("assets/vendor/uplot/LICENSE").toString("utf8"), /MIT License/);
  assert.match(read("assets/vendor/echarts/LICENSE").toString("utf8"), /Apache License/);
  assert.ok(uplot.length < 80 * 1024, "uPlot grew past 80 KB");
  assert.ok(zlib.gzipSync(uplot).length < 30 * 1024, "uPlot gzip grew past 30 KB");
  assert.ok(bars.length < 560 * 1024, "modular ECharts grew past 560 KB");
  assert.ok(zlib.gzipSync(bars).length < 180 * 1024, "modular ECharts gzip grew past 180 KB");
  assert.doesNotMatch(adapter.toString("utf8"), /https?:\/\/|unpkg|jsdelivr|cdnjs/i);
  assert.match(adapter.toString("utf8"), /vendor\/uplot\/uPlot\.iife\.min\.js/);
  assert.match(adapter.toString("utf8"), /vendor\/echarts\/echarts-pie-bar\.min\.js/);
  assert.doesNotMatch(uplot.toString("utf8") + uplotCss.toString("utf8") + bars.toString("utf8"), /forward|mirror|master|consensus/i);
  const old = path.join(root, "assets/svg-charts.js");
  assert.equal(fs.existsSync(old), false);
});
