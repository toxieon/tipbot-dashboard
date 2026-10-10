// node --test tests/swipe_back.test.js — phone swipe-back gesture (tb-motion + index wiring).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const HTML = read("index.html");
const motion = read("assets/tb-motion.js");
const swipe = require("../assets/tb-motion.js");

test("swipe-back constants match the product spec", () => {
  assert.equal(swipe.EDGE_PX, 24);
  assert.equal(swipe.COMMIT_PX, 80);
});

test("gesture helpers: edge, horizontal dominance, commit threshold", () => {
  assert.equal(swipe.swipeShouldBegin(20), true);
  assert.equal(swipe.swipeShouldBegin(30), false);
  assert.ok(swipe.swipeMostlyHorizontal(90, 10));
  assert.ok(!swipe.swipeMostlyHorizontal(40, 90));
  assert.ok(swipe.swipeShouldCommit(85, 12));
  assert.ok(!swipe.swipeShouldCommit(70, 5));
});

test("blocked targets and horizontal scrollers are ignored", () => {
  const input = { closest: (sel) => (sel.indexOf("input") >= 0 ? input : null) };
  assert.equal(swipe.touchBlockedTarget(input), true);
  const div = { closest: () => null, parentElement: null };
  assert.equal(swipe.touchBlockedTarget(div), false);
  const tabs = {
    classList: { contains: (c) => c === "tabs" },
    parentElement: null,
    nodeType: 1,
    scrollWidth: 10,
    clientWidth: 10,
  };
  assert.equal(swipe.isHorizontalScroller(tabs, () => ({ overflowX: "visible" })), true);
  const wide = {
    classList: { contains: () => false },
    parentElement: null,
    nodeType: 1,
    scrollWidth: 200,
    clientWidth: 100,
  };
  assert.equal(
    swipe.isHorizontalScroller(wide, () => ({ overflowX: "auto", overflow: "visible" })),
    true
  );
});

test("tb-motion exposes TBSwipeBack with passive touch listeners", () => {
  assert.match(motion, /w\.TBSwipeBack\s*=\s*swipeExports/);
  assert.match(motion, /addEventListener\("touchstart", onStart, \{ passive: true, capture: true \}\)/);
  assert.match(motion, /addEventListener\("touchmove", onMove, \{ passive: true, capture: true \}\)/);
  assert.match(motion, /@media \(prefers-reduced-motion:reduce\)/);
  assert.match(motion, /max-width:640px/);
});

test("index wires swipe-back through history and visible .back", () => {
  assert.match(HTML, /if\(window\.TBSwipeBack\) TBSwipeBack\.wire\(/);
  assert.match(HTML, /function swipeGoBack\(\)\{/);
  assert.match(HTML, /if\(NAV\.sheets>0\)\{ history\.back\(\); return; \}/);
  assert.match(HTML, /if\(NAV\.idx>0\)\{ history\.back\(\); return; \}/);
  assert.match(HTML, /b\.click\(\)/);
  assert.match(HTML, /settingsOpen: \(\)=>\{ const dd=\$\("dropdown"\); return dd&&!dd\.hidden; \}/);
  assert.match(HTML, /function swipeCanBack\(\)/);
});
