// node --test tests/   0.53.2: phone tabs are Home | Build | Upcoming with Build centred.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const js = fs.readFileSync(path.join(__dirname, "..", "assets", "theme-apex.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "assets", "theme-apex.css"), "utf8");

test("phone tab order is Home | Build | Upcoming", () => {
  assert.match(js, /var TABS = \["home", "build", "upcoming"\];/);
  assert.match(js, /var tabItems = TABS\.map\(/);
  assert.doesNotMatch(js, /var tabItems = NAV\.filter/);
});

test("Build is the centred middle column of the phone tab bar", () => {
  const phone = css.slice(css.indexOf("@media (max-width:899px)"));
  assert.match(phone, /\.apex-tabs\{[^}]*display:grid;[^}]*grid-template-columns:1fr auto 1fr;/);
  assert.match(phone, /\.apex-tabs \.apex-tab-build\{[^}]*justify-self:center;/);
});
