// node --test tests/   Edge payloads: no servers, no tips, missing stats, long names.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("path");
const SV = require("../assets/server-view.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("home empty state is a status region, not a faint one-liner", () => {
  assert.match(html, /No communities yet/);
  assert.match(html, /dc-empty" role="status"/);
  assert.match(html, /c\.setAttribute\("role","button"\);c\.tabIndex=0;/);
});

test("renderDetail guards missing settings/tips and does not read .settled on null", () => {
  const start = html.indexOf("async function renderDetail(d)");
  const body = html.slice(start, start + 1800);
  assert.match(body, /if\(!d\|\|typeof d!=="object"\) d=\{\};/);
  assert.match(body, /settled:Array\.isArray\(rawTips&&rawTips\.settled\)/);
  assert.match(body, /if\(s\.guild_id==null\)/);
  assert.doesNotMatch(body, /const s=d\.settings,st=d\.stats,tips=d\.tips;/);
});

test("tipCard skips null tips and does not print undefined units", () => {
  const start = html.indexOf("function tipCard(t,settled,opts)");
  const body = html.slice(start, start + 900);
  assert.match(body, /if\(!t\|\|typeof t!=="object"\) return "";/);
  assert.match(body, /unitsTxt=t\.units!=null&&t\.units!==""/);
  assert.doesNotMatch(body, /esc\(t\.units\)\+'u @ '\+esc\(t\.odds\)/);
});

test("units formatter and initials survive empty / non-numeric / long names", () => {
  assert.match(html, /const u=n=>\{ const x=Number\(n\); if\(!Number\.isFinite\(x\)\) return "—";/);
  assert.match(html, /function initials\(s\)\{var words=String\(s\|\|""\)\.trim\(\)\.split\(\/\\s\+\/\)\.filter\(Boolean\);if\(!words\.length\)return "\?";/);
  assert.doesNotThrow(() => SV.cardModel({}));
  assert.doesNotThrow(() => SV.cardModel({tips: null, stats: null, settings: null}));
  assert.doesNotThrow(() => SV.blocks({}));
  const empty = SV.cardModel({});
  assert.equal(empty.recordText, "0–0");
  const long = "W".repeat(80) + " " + "X".repeat(80);
  const rows = SV.tipsterBreakdown({
    tips: {settled: [{tip_id: "t", result: "Win", units: 1, odds: 1.9, profit_units: 0.9, tipster_name: long}], queued: []}
  });
  assert.equal(rows[0].name.length, 161);
  assert.equal(rows[0].initials, "WX");
});
