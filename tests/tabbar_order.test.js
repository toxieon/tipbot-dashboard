// node --test tests/   0.53.2: phone tabs are Home | Build | Upcoming with Build centred.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const js = fs.readFileSync(path.join(__dirname, "..", "assets", "theme-apex.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "assets", "theme-apex.css"), "utf8");

test("phone tab order is Home | Build | Upcoming", () => {
  assert.match(js, /var TABS = \["home", "build", "upcoming"\];/);
  assert.match(js, /buttonRow\(navItems\(TABS\)/);
});

test("desktop rail mirrors phone: in-server uses TABS; no-server uses Home, Servers, Upcoming, Settings", () => {
  assert.match(js, /var RAIL_NO_SERVER = \["home", "servers", "upcoming", "settings"\]/);
  assert.match(js, /hasServerContext\(\) \? TABS : RAIL_NO_SERVER/);
  assert.match(js, /function syncRailNav\(/);
  assert.doesNotMatch(js, /buttonRow\(NAV,/);
});

test("phone tab bar hangs off the body and is not blurred", () => {
  assert.match(js, /doc\.body\.appendChild\(tabs\)/);
  assert.match(css, /\.apex-tabs\{[^}]*backdrop-filter:\s*none/);
  assert.doesNotMatch(css, /\.apex-tabs\{[^}]*backdrop-filter:\s*blur/);
  const phone = css.slice(css.indexOf("@media (max-width:899px)"));
  assert.match(phone, /\.apex-tabs\{[^}]*position:fixed;[^}]*bottom:0;/);
  assert.match(phone, /safe-area-inset-bottom/);
});

test("Build is the centred middle column of the phone tab bar", () => {
  const phone = css.slice(css.indexOf("@media (max-width:899px)"));
  assert.match(phone, /\.apex-tabs\{[^}]*display:grid;[^}]*grid-template-columns:1fr auto 1fr;/);
  assert.match(phone, /\.apex-tabs \.apex-tab-build\{[^}]*justify-self:center;/);
});
