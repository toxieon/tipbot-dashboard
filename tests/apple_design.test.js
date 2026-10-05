// node --test tests/   Apple-design pass (APPLE_DESIGN_UPGRADE_HANDOFF.md): guards for the motion,
// interaction and design-system rules so later edits don't quietly undo them.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const HTML = read("index.html");
const CSS = (HTML.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1];

// ── Phase 1 · press-feel ───────────────────────────────────────────────────────
test("tb-motion.js loads eagerly and exposes TBMotion without a DOM", () => {
  assert.match(HTML, /<script src="\.\/assets\/tb-motion\.js"><\/script>/);
  const ctx = {setTimeout, clearTimeout};
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("assets/tb-motion.js"), ctx);
  assert.equal(typeof ctx.TBMotion.bump, "function");
  assert.equal(typeof ctx.TBMotion.tick, "function");
  assert.equal(ctx.TBMotion.reduced(), false);
  ctx.TBMotion.bump(null); // no throw
  ctx.TBMotion.tick();     // no navigator: no throw
});

test("buttons press on pointer-down (:active), only when motion is allowed", () => {
  assert.match(CSS, /@media \(prefers-reduced-motion:no-preference\)\{[\s\S]*?\.btn:active:not\(:disabled\)[^{]*\{transform:scale\(\.96\)/);
  assert.match(CSS, /\.scard:active,\.gcard:active,\.dc-card:active,\.cal-day:active\{transform:scale\(\.985\)/);
});

test("reduced motion keeps fades: no blanket transition:none", () => {
  assert.doesNotMatch(CSS, /\*,\*::before,\*::after \{animation:none!important;transition:none!important/);
  assert.match(CSS, /transition-property:opacity,color,background-color,border-color,box-shadow,filter,visibility!important/);
});

test("gear menu and trays animate from [hidden] without leaving the a11y/hit tree", () => {
  for (const sel of [".dropdown[hidden]", ".tray[hidden],.batchtray[hidden]"]) {
    const i = CSS.indexOf(sel + "{display:block!important;visibility:hidden;opacity:0;pointer-events:none}");
    assert.ok(i > 0, sel + " keeps visibility:hidden + pointer-events:none while animating out");
  }
  assert.match(CSS, /\.dropdown\{transform-origin:top right\}/);
});

test("adding a leg / batch tip gives causal feedback", () => {
  const b = read("assets/builder.js");
  assert.match(b, /BUILD\.legs\.push\(next\);renderTray\(\);saveMultiDraft\(\);\n\s+try\{ TBMotion\.bump\(\$\("reviewbtn"\)\); TBMotion\.tick\(\); \}catch\(_\)\{\}/);
  assert.match(b, /TBMotion\.bump\(document\.querySelector\("#batchtray \.batch-label"\)\)/);
});
