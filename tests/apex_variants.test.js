// node --test tests/   0.52.4: Apex variants render as data-theme="apex" + data-apex-variant.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");
const html = read("index.html");
const apexCss = read("assets/theme-apex.css");
const apexJs = read("assets/theme-apex.js");

test("pre-paint maps apex-light/oled/mono to data-theme=apex plus a variant", () => {
  assert.match(html, /root\.dataset\.theme=apexV\?'apex':theme;if\(apexV\)root\.dataset\.apexVariant=apexV/);
  for (const p of ["live/index.html", "live/board/index.html", "compare/index.html"]) {
    assert.match(read(p), /root\.dataset\.theme=apexV\?'apex':theme/, p);
    assert.match(read(p), /'apex-light','apex-oled','apex-mono'\]\.indexOf\(name\)/, p);
  }
});

test("variant tokens are keyed on data-apex-variant, not the old theme names", () => {
  for (const v of ["light", "oled", "mono"]) {
    assert.match(html, new RegExp(`html\\[data-theme="apex"\\]\\[data-apex-variant="${v}"\\] \\{`));
    assert.doesNotMatch(html, new RegExp(`html\\[data-theme="apex-${v}"\\]`));
  }
});

test("Settings keeps the saved variant name (prefs and TipBot names unchanged)", () => {
  assert.match(html, /function current\(\) \{var v=root\.dataset\.apexVariant;return root\.dataset\.theme==='apex'&&v\?'apex-'\+v:root\.dataset\.theme;\}/);
  assert.match(html, /var apply=function\(\)\{setRoot\(next\);/);
  assert.doesNotMatch(html, /write\('tipbot_theme',root\.dataset\.theme/);
  assert.match(html, /b\.dataset\.tbTheme===current\(\)/);
  assert.match(html, /var names = \['apex', 'apex-light', 'apex-oled', 'apex-mono', 'apex-ochre', 'navy', 'day', 'ochre'\]/);
});

test("theme-apex.js keeps light for the light variant and watches the variant attribute", () => {
  assert.match(apexJs, /var wantLight = v === "light" \|\| \(el\.dataset\.theme === "apex" && !v && auto && day\);/);
  // no same-value writes (the theme observer would loop)
  assert.match(apexJs, /if \(wantLight && el\.dataset\.apexLight !== "1"\) el\.dataset\.apexLight = "1";/);
  assert.match(apexJs, /attributeFilter: \["data-theme", "data-apex-light", "data-apex-variant"\]/);
});

test("the tab indicator slide stops under reduced motion", () => {
  assert.match(apexCss, /@media \(prefers-reduced-motion:reduce\)\{\s*html\[data-theme="apex"\] \.apex-indicator\{transition:none\}/);
});
