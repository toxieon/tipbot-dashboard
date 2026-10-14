// node --test tests/   0.57.7: Stats/Horses scripts are not on the first-paint path.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("stats and horse-results are not blocking script tags", () => {
  assert.doesNotMatch(html, /<script src="\.\/assets\/stats\.js/);
  assert.doesNotMatch(html, /<script src="\.\/assets\/horse-results\.js/);
});
test("opening Stats or Horses directly waits for its script", () => {
  assert.match(html, /if\(!window\.TBDashStats\)\{ statsSkeleton\(\); await lazyScript\("stats"\);/);
  assert.match(html, /async function openHorseResults\(\)\{[\s\S]{0,400}await lazyScript\("horse-results"\);/);
  assert.match(html, /idle\(function\(\)\{ lazyScript\("stats"\); lazyScript\("horse-results"\); \}\)/);
});
