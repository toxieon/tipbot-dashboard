const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const LF = require("../assets/logo_frame.js");

test("square keeps every corner; circle and oval clear them", () => {
  assert.strictEqual(LF.covers("square", 140, 47, 0, 0), true);
  assert.strictEqual(LF.covers("circle", 140, 47, 0, 0), false);
  assert.strictEqual(LF.covers("oval", 140, 47, 0, 0), false);
  assert.strictEqual(LF.covers("oval", 140, 47, 70, 23), true);
  assert.strictEqual(LF.clipCss("square", 14, 4.7), "none");
  assert.match(LF.clipCss("oval", 14, 4.7), /^ellipse\(50% 50% at 50% 50%\)$/);
});

test("zoom 1 pan 0 square is plain; placement fills the frame", () => {
  assert.strictEqual(LF.plain({}), true);
  assert.strictEqual(LF.plain({zoom: 2}), false);
  assert.strictEqual(LF.plain({shape: "circle"}), false);
  assert.deepStrictEqual([LF.placement(100, 100, {}).x, LF.placement(100, 100, {}).w], [0, 100]);
  const p = LF.placement(100, 100, {zoom: 2, pan_x: 1});
  assert.strictEqual(p.w, 200);
  assert.strictEqual(p.x, 0);
  assert.strictEqual(LF.read({zoom: 9, pan_x: -5}).zoom, 4);
});

test("page loads the frame script, wires taps and never opens a window", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /<script src="\.\/assets\/logo_frame\.js\?v=__TD_VERSION__"><\/script>/);
  assert.match(html, /onLogoTap: fliveLogoTap/);
  assert.match(html, /"#\/marketplace\/"\+encodeURIComponent/);
  const mount = fs.readFileSync(path.join(__dirname, "..", "assets", "mcg", "mount.js"), "utf8");
  assert.match(mount, /import "\.\.\/logo_frame\.js";/);
  assert.match(mount, /removeEventListener\("pointerup", onTapUp\)/);
  const fl = html.slice(html.indexOf("function fliveLogoTap"), html.indexOf("function fliveHitsArm"));
  assert.doesNotMatch(fl, /window\.open|_blank/);
});
