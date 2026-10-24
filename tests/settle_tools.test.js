// node --test tests/   0.66.14: period final chips, owner fix legs hook, slip duplicate warning.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const SLIP_UI = fs.readFileSync(path.join(ROOT, "assets", "slip-ocr-ui.js"), "utf8");

test("a quarter / half leg shows 'Q1 final' once its period is over", () => {
  assert.match(HTML, /const pf=\(!l\.leg_result&&live&&live\.period&&live\.period_final\)\?/);
  assert.match(HTML, /esc\(live\.period\)\+' final<\/span>'/);
});

test("fix legs: owner-only button, the editor comes from the owner script", () => {
  assert.match(HTML, /const fix=\(!isSettled&&godOn\(\)&&tid&&window\.TBOwner&&typeof TBOwner\.fixLegs==="function"\)\?/);
  assert.match(HTML, /TBOwner\.fixLegs\(gid,b\.dataset\.tip,FIX_LEGS\[b\.dataset\.tip\]\|\|\[\]\)/);
  assert.doesNotMatch(HTML, /\/api\/owner\//);   // owner endpoints stay out of the public page
});

test("slip import warns once about the same legs already on the server", () => {
  assert.match(SLIP_UI, /api\("\/api\/tips\/duplicate-check"/);
  assert.match(SLIP_UI, /if \(SLIP\.dupOk !== dupKey\) \{/);
  assert.match(SLIP_UI, /Apply again to add it anyway\./);
  assert.match(SLIP_UI, /catch \(e\) \{ return \[\]; \}   \/\/ an older bot or a blip never blocks the import/);
  assert.ok(SLIP_UI.indexOf("slipDuplicates(gid") < SLIP_UI.indexOf("BUILD.legs = state.legs;"));
});
