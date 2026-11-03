const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("predictor panel, route and opener exist", () => {
  assert.match(HTML, /<div id="predictor" hidden><\/div>/);
  assert.match(HTML, /if\(m\[0\]==="predictor"\) return openPredictor\(\), true;/);
  assert.match(HTML, /openPredictor: \(\)=>openPredictor\(\)/);
});

test("predictor is owner gated and mounts in its own section", () => {
  const fn = HTML.slice(HTML.indexOf("async function openPredictor(){"), HTML.indexOf("async function openOwnerSettings(){"));
  assert.match(fn, /if\(!ownerSettingsAllowed\(\)\) return enterHome\(\);/);
  assert.match(fn, /TBOwnerHorse\.mount\(\$\("predictor"\)/);
});

test("menu entry is painted with the owner settings entry", () => {
  assert.match(HTML, /for\(const id of \["dd-extra-settings","dd-predictor"\]\)/);
});

test("settings keeps the predictor only when TipBot did not send the menu item", () => {
  assert.match(HTML, /if\(!\$\("dd-predictor"\)\) \(window\.TBOwnerHorse/);
});

test("predictor is in both panel lists", () => {
  assert.ok((HTML.match(/"settings","predictor"/g) || []).length >= 2);
});

const APEX = fs.readFileSync(path.join(__dirname, "..", "assets", "theme-apex.js"), "utf8");
test("Apex rail and phone tabs add Predictor only for the owner", () => {
  assert.match(APEX, /\{ id: "predictor", label: "Predictor"/);
  assert.match(APEX, /function ownerPredictor\(\) \{\n\s+var el = doc\.getElementById\("dd-predictor"\);\n\s+return !!\(el && !el\.hidden\);/);
  assert.match(APEX, /return withOwner\(visibleNavIds\(hasServerContext\(\) \? TABS : RAIL_NO_SERVER\)\);/);
  assert.match(APEX, /var ids = withOwner\(visibleNavIds\(TABS\)\);/);
  assert.match(APEX, /if \(id === "predictor" && !ownerPredictor\(\)\) return;/);
  assert.match(HTML, /window\.TBOpenPredictor=\(\)=>openPredictor\(\);/);
});
