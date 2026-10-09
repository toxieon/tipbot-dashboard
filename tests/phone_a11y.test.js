// node --test tests/   Phone-first a11y: 44px taps, labels, contrast, no page overflow.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1];
const apexCss = fs.readFileSync(path.join(__dirname, "..", "assets", "theme-apex.css"), "utf8");

test("primary controls are at least 44px on phones", () => {
  assert.match(css, /\.gear\{width:44px;height:44px;/);
  assert.match(css, /\.back\{[^}]*min-height:44px/);
  assert.match(css, /\.btn\{[^}]*min-height:44px/);
  assert.match(css, /\.ghost\{[^}]*min-height:44px/);
  assert.match(css, /\.tab\{[^}]*min-height:44px/);
  assert.match(css, /\.addbtn\{min-height:44px;/);
  assert.match(css, /\.tb-swatch \{[^}]*min-height:44px/);
  assert.match(css, /\.tb-accent-btn \{ width: 44px; height: 44px;/);
  assert.match(css, /\.topnav a\{[^}]*min-height:44px/);
  assert.match(css, /\.dd-item\{[^}]*min-height:44px/);
  assert.match(css, /\.batchtray \.batch-clear\{[^}]*min-height:44px;min-width:44px/);
  const phone = apexCss.slice(apexCss.indexOf("@media(max-width:420px)"));
  assert.match(phone, /\.gear\{[^}]*width:44px;/);
  assert.match(phone, /min-height:44px/);
});

test("month select, skip link, and focus rings cover keyboard users", () => {
  assert.match(html, /<label class="sv-period-k" for="monthsel">Showing<\/label>/);
  assert.match(html, /id="monthsel" aria-label="Stats period"/);
  assert.match(html, /<a class="skip" href="#app">Skip to dashboard<\/a>/);
  assert.match(css, /select:focus-visible,textarea:focus-visible,\[role="button"\]:focus-visible/);
  assert.match(html, /aria-label="'\+esc\(l\)\+'" aria-pressed="/);
});

test("empty copy uses muted ink; long names wrap; the page cannot grow sideways", () => {
  assert.match(css, /\.empty\{color:var\(--muted\)/);
  assert.match(css, /\.sname\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /\.scard \.row1 > div\{min-width:0\}/);
  assert.match(css, /\.wrap,#app,#overview,#detail,#upcoming,#builder,#followers,#follower,#mytips,#discover\{min-width:0;max-width:100%\}/);
  assert.match(apexCss, /#upcoming,\s*\nhtml\[data-theme="apex"\] #builder \{ overflow-x: clip; \}/);
  const phoneApex = apexCss.slice(apexCss.indexOf("html[data-theme=\"apex\"] #detail .dhead-actions"));
  assert.match(phoneApex, /flex-wrap:wrap;/);
  assert.doesNotMatch(phoneApex.slice(0, 220), /flex-wrap:nowrap;/);
});

test("icons and JSON lists are cache-busted with the shipped version", () => {
  const version = fs.readFileSync(path.join(__dirname, "..", "VERSION"), "utf8").trim();
  const q = version.replace(/\./g, "\\.");
  assert.match(html, new RegExp("favicon\\.ico\\?v=" + q));
  assert.match(html, new RegExp("favicon\\.svg\\?v=" + q));
  assert.match(html, new RegExp("apple-touch-icon\\.png\\?v=" + q));
  assert.match(html, new RegExp("manifest\\.webmanifest\\?v=" + q));
  assert.match(html, /players\.json\?v="\+encodeURIComponent\(TD\.version\)/);
  assert.match(html, /bookies\.json\?v='\+encodeURIComponent\(TD\.version\)/);
});
