// node --test tests/   0.66.11: per-server features (TipBot settings.features), grouped Features page,
// and Manual bets / Manual grading off by default.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const BUILDER = fs.readFileSync(path.join(ROOT, "assets", "builder.js"), "utf8");
const SLIP_UI = fs.readFileSync(path.join(ROOT, "assets", "slip-ocr-ui.js"), "utf8");

// Pull one top-level helper out of index.html by name (to the next two-space "function").
function fn(name, src = HTML) {
  const start = src.indexOf("  function " + name + "(");
  assert.ok(start >= 0, name);
  const next = src.indexOf("\n  function ", start + 10);
  return src.slice(start, next);
}

function ctx(extra) {
  const c = Object.assign({esc: (s) => String(s)}, extra || {});
  vm.createContext(c);
  const cacheStart = HTML.indexOf("  const GUILD_FEATURES={};");
  vm.runInContext(HTML.slice(cacheStart, HTML.indexOf("  function guildUnitSize(", cacheStart)), c);
  return c;
}

test("guildFeature: unknown servers and older bots show everything; known flags win", () => {
  const c = ctx();
  vm.runInContext("GUILD_FEATURES['42']={manual_bets:false, manual_grading:false, builder:true}", c);
  assert.equal(c.guildFeature("42", "manual_bets"), false);
  assert.equal(c.guildFeature("42", "builder"), true);
  assert.equal(c.guildFeature("42", "units_calendar"), true);   // not sent: show
  assert.equal(c.guildFeature("7", "manual_bets"), true);        // no data yet: show
  assert.equal(c.tipGuildId("42:NBA-2026-031"), "42");
  assert.match(HTML, /if\(s\.guild_id!=null&&s\.features&&typeof s\.features==="object"\) GUILD_FEATURES\[String\(s\.guild_id\)\]=s\.features;/);
});

test("grade buttons hide when manual grading is off, but owner god-mode regrade stays", () => {
  const c = ctx({window: {}});   // no TBOwner: plain "Grade" label
  vm.runInContext(fn("gradeRowHtml"), c);
  vm.runInContext("GUILD_FEATURES['42']={manual_grading:false}; GUILD_FEATURES['9']={manual_grading:true}", c);
  assert.equal(c.gradeRowHtml("42:NBA-1", false, false), "");
  assert.match(c.gradeRowHtml("9:NBA-1", false, false), /data-r="Win"/);
  assert.match(c.gradeRowHtml("42:NBA-1", true, true), /data-r="Win"/);
});

test("Features page groups toggles by category, and an older bot gets one list", () => {
  const c = ctx();
  vm.runInContext(fn("featureGroups"), c);
  const groups = c.featureGroups(["feat.builder", "feat.manual_grading", "feat.manual_bets", "feat.x"],
    {"feat.builder": "Tips", "feat.manual_bets": "Tips", "feat.manual_grading": "Grading"}, ["Tips", "Grading", "Live"]);
  assert.deepEqual(JSON.parse(JSON.stringify(groups)), [
    {name: "Tips", keys: ["feat.builder", "feat.manual_bets"]},
    {name: "Grading", keys: ["feat.manual_grading"]},
    {name: "Other", keys: ["feat.x"]},
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(c.featureGroups(["a", "b"], null, null))), [{name: "", keys: ["a", "b"]}]);
  assert.match(HTML, /categories:d\.categories\|\|null, categoryOrder:d\.category_order\|\|null/);
  assert.match(HTML, /<h4 class="feat-cat"/);
});

test("server header: Build needs the builder, Custom needs Manual bets; calendar and live panel follow features", () => {
  assert.match(HTML, /const need=\{buildbtn:"builder", custombtn:"manual_bets"\};/);
  assert.match(HTML, /id="custombtn" data-gid="'\+esc\(String\(s\.guild_id\)\)\+'"/);
  assert.match(HTML, /\(guildFeature\(s\.guild_id,"units_calendar"\)\?renderCalendar\(d\.cal_month,d\.daily_series\):""\)/);
  assert.match(HTML, /if\(!guildFeature\(s\.guild_id,"livestats"\)\)\{ const lp=\$\("live-tips-panel"\); if\(lp\) lp\.remove\(\); \}/);
});

test("builder: markets without an auto-grade source only show with Manual bets", () => {
  const start = BUILDER.indexOf("  function manualBets(){");
  const c = {BUILD: {guildId: "42"}, guildFeature: (g, n) => !(g === "42" && n === "manual_bets")};
  vm.createContext(c);
  vm.runInContext(BUILDER.slice(start, BUILDER.indexOf("\n", BUILDER.indexOf("const MANUAL_MARKETS", start))), c);
  assert.equal(c.manualBets(), false);
  c.BUILD.guildId = "9";
  assert.equal(c.manualBets(), true);
  assert.match(BUILDER, /Object\.keys\(MARKETS\)\.filter\(t=>manualBets\(\)\|\|!MANUAL_MARKETS\[t\]\)/);
  assert.match(BUILDER, /const MANUAL_MARKETS=\{"1st Disposal":1,"Last Disposal":1\};/);
  assert.match(BUILDER, /\(manualBets\(\)\?SPORT_STUBS\.map/);
  assert.match(BUILDER, /\(manualBets\(\)\?'<button class="ghost" id="customgames">/);
  assert.match(BUILDER, /\(manualBets\(\)\?'<div class="field"><label>Add a selection<\/label><div style="display:flex;gap:8px"><input id="c_leg" placeholder="e\.g\. Lakers -4\.5/);
  assert.match(BUILDER, /navNote\("#\/s\/"\+encodeURIComponent\(guildId\)\+"\/build\/custom"[^\n]*\n\s*if\(typeof guildFeature==="function"&&!guildFeature\(guildId,"manual_bets"\)\)\{/);
});

test("slip import refuses legs that would be free text when Manual bets is off", () => {
  assert.match(SLIP_UI, /var manualOff = typeof guildFeature === "function" && !guildFeature\(gid, "manual_bets"\);/);
  assert.match(SLIP_UI, /Post races from Build → Racing, /);
  assert.ok(SLIP_UI.indexOf("var manualOff") < SLIP_UI.indexOf("BUILD.legs = state.legs;"), "checked before the tray is filled");
});
