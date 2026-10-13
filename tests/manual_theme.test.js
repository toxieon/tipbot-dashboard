// node --test tests/   0.57.2: manual theme only; automatic prefs migrate to the shown theme.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const T = require("../assets/tbtime.js");

const root = path.join(__dirname, "..");
function store(init) {
  const m = Object.assign({}, init);
  return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } };
}
const NOON = Date.parse("2026-09-27T02:00:00Z"); // 12 pm Sydney
const NIGHT = Date.parse("2026-09-27T10:00:00Z"); // 8 pm Sydney
const AUTO_KEYS = ["tipbot_theme_auto", "tipbot_theme_system", "tipbot_theme_manual_date"];
function noAuto(s) { AUTO_KEYS.forEach((k) => assert.equal(k in s.m, false, k)); }

test("manual theme is kept untouched", () => {
  const s = store({ tipbot_theme: "apex-oled" });
  assert.equal(T.manualTheme(s, null, NOON), "apex-oled");
  assert.deepEqual(s.m, { tipbot_theme: "apex-oled" });
});
test("nothing saved -> default, nothing written", () => {
  const s = store({});
  assert.equal(T.manualTheme(s, null, NOON), T.DEFAULT_THEME);
  assert.deepEqual(s.m, {});
});
test("time-of-day auto migrates to the theme shown now and saves it", () => {
  let s = store({ tipbot_theme: "navy", tipbot_theme_auto: "true" });
  assert.equal(T.manualTheme(s, null, NOON), "day"); assert.equal(s.m.tipbot_theme, "day"); noAuto(s);
  s = store({ tipbot_theme: "navy", tipbot_theme_auto: "true" });
  assert.equal(T.manualTheme(s, null, NIGHT), "navy"); noAuto(s);
  s = store({ tipbot_theme_auto: "true" });            // unknown theme -> default (apex light by day, as shown)
  assert.equal(T.manualTheme(s, null, NOON), "apex-light"); noAuto(s);
  s = store({ tipbot_theme_auto: "true" });
  assert.equal(T.manualTheme(s, null, NIGHT), "apex"); noAuto(s);
});
test("auto with today's manual override keeps that choice", () => {
  const s = store({ tipbot_theme: "ochre", tipbot_theme_auto: "true", tipbot_theme_manual_date: T.dayKey(NOON) });
  assert.equal(T.manualTheme(s, null, NOON), "ochre"); noAuto(s);
});
test("follow-system migrates to the device theme once, or the default if unknown", () => {
  let s = store({ tipbot_theme: "navy", tipbot_theme_system: "true" });
  assert.equal(T.manualTheme(s, false, NOON), "apex-light"); assert.equal(s.m.tipbot_theme, "apex-light"); noAuto(s);
  s = store({ tipbot_theme_system: "true" });
  assert.equal(T.manualTheme(s, null, NOON), T.DEFAULT_THEME); assert.equal(s.m.tipbot_theme, T.DEFAULT_THEME); noAuto(s);
});
test("auto=false leftovers are cleared without changing the theme", () => {
  const s = store({ tipbot_theme: "apex-mono", tipbot_theme_auto: "false", tipbot_theme_system: "false" });
  assert.equal(T.manualTheme(s, null, NOON), "apex-mono"); assert.deepEqual(s.m, { tipbot_theme: "apex-mono" });
});
test("no automatic theme UI or listeners remain on any page", () => {
  for (const f of ["index.html", "master/index.html", "live/index.html", "live/board/index.html", "compare/index.html", "assets/theme-apex.js"]) {
    const src = fs.readFileSync(path.join(root, f), "utf8");
    assert.doesNotMatch(src, /data-tb-auto|data-tb-system|Auto \(time of day\)|Follow system|setAuto|setSystem/, f);
    assert.doesNotMatch(src, /prefers-color-scheme[^\n]*addEventListener|addListener\(/, f);
    assert.doesNotMatch(src, /isDaytime/, f);
    if (f.endsWith(".html")) assert.match(src, /TBTime\.manualTheme\(localStorage,mm\)/, f);
  }
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /auto:false,accent/);
  assert.match(html, /\["set","setAccent"\]\.forEach/);
});
