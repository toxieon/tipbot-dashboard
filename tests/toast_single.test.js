// node --test tests/   B1: exactly one global toast() in index.html; old green .toast{var(--win)} pill is gone.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("index.html defines function toast( exactly once", () => {
  const n = (html.match(/function toast\(/g) || []).length;
  assert.equal(n, 1, "expected exactly one toast() definition, found " + n);
});

test("old .toast{...var(--win)...} success-pill rule is gone", () => {
  assert.doesNotMatch(html, /\.toast\{[^}]*var\(--win\)/);
});

test("single toast is a status live region with kind classes", () => {
  assert.match(html, /function toast\(msg, kind, opts\)/);
  assert.match(html, /setAttribute\("role","status"\)/);
  assert.match(html, /\.tb-toast--error\{[^}]*var\(--loss-ink\)/);
  assert.match(html, /\.tb-toast--success\{[^}]*var\(--win\)/);
});
