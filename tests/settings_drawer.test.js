// node --test tests/   Settings drawer stays on screen, and the tier mark stays a pill.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1];
const phone = css.match(/@media\(max-width:430px\)\{([\s\S]*?)\n\}/);

test("the phone settings drawer is fixed inside the viewport", () => {
  assert.ok(phone, "phone drawer rule missing");
  const rule = phone[1];
  assert.match(rule, /\.dropdown\{[^}]*position:fixed/);
  assert.match(rule, /left:max\(8px, env\(safe-area-inset-left, 0px\)\)/);
  assert.match(rule, /right:max\(8px, env\(safe-area-inset-right, 0px\)\)/);
  assert.match(rule, /width:auto/);
  assert.match(rule, /max-width:100vw/);
  assert.match(rule, /overflow:auto/);
  assert.match(rule, /#app > \.top \.menu\{flex:none;margin-left:auto\}/);
  assert.match(css, /\.dropdown\{transform-origin:top right\}/);
});

test("the tier mark is a small pill in the base theme, not only Apex", () => {
  assert.match(css, /\.scard \.row1\{[^}]*align-items:flex-start/);
  assert.match(css, /\.plan\{[^}]*align-self:flex-start/);
  assert.match(css, /\.plan\{[^}]*flex:none/);
  assert.match(css, /\.plan\{[^}]*border-radius:999px/);
  assert.match(css, /\.plan\{[^}]*white-space:nowrap/);
});
