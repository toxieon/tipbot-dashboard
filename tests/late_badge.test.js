const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function lateBadge() {
  const m = html.match(/TB\.lateBadge=function\(t\)\{[\s\S]*?\n  \};/);
  assert.ok(m, "lateBadge defined");
  const TB = {};
  new Function("TB", m[0])(TB);
  return TB.lateBadge;
}

test("Late badge shows only for late tips", () => {
  const b = lateBadge();
  assert.equal(b({ late: false }), "");
  assert.equal(b(null), "");
  assert.match(b({ late: true }), />Late<\/span>/);
  assert.match(b({ late: true }), /Not counted in stats/);
});

test("tip cards and the follower feed carry the badge", () => {
  assert.match(html, /TB\.multiBadge\(t\.legs\|\|t\._fullLegs\)\+TB\.lateBadge\(t\)/);
  assert.match(html, /TB\.multiBadge\(t\.legs\)\+TB\.lateBadge\(t\)/);
  assert.match(html, /\.tb-kind--late \{/);
});
