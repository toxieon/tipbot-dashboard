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

// ── Phase 2 · sheets-and-undo ──────────────────────────────────────────────────
test("no native confirm() dialogs remain (action sheets / undo instead)", () => {
  const files = ["index.html", "master/index.html", "assets/builder.js", "assets/admin.js", "assets/consensus-ui.js",
    "assets/scheduled-tips.js", "assets/master-access.js", "assets/routing.js", "assets/slip-ui.js"];
  for (const f of files) {
    const src = read(f).replace(/W\.confirm\(o\.title[^;]+;/g, "") // ask() fallback when tb-motion.js is absent
      .replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const bare = src.match(/(^|[^.\w])confirm\(/gm) || [];
    assert.deepEqual(bare, [], f + " still calls window.confirm()");
  }
});

test("TBSheet exposes open/confirm/top/closeTop and the master page loads it", () => {
  const ctx = {setTimeout, clearTimeout};
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("assets/tb-motion.js"), ctx);
  for (const k of ["open", "confirm", "top", "closeTop"]) assert.equal(typeof ctx.TBSheet[k], "function", k);
  assert.equal(ctx.TBSheet.top(), null);
  assert.equal(ctx.TBSheet.closeTop(), false);
  assert.match(read("master/index.html"), /<script src="\.\.\/assets\/tb-motion\.js"><\/script>/);
});

test("spring settles on target from any start velocity (interruptible re-target)", async () => {
  let t = 0;
  const ctx = {setTimeout, clearTimeout, performance: {now: () => t}, requestAnimationFrame: (f) => setTimeout(() => { t += 16; f(t); }, 0), cancelAnimationFrame: clearTimeout};
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("assets/tb-motion.js"), ctx);
  const seen = [];
  await new Promise((done) => {
    const s = ctx.TBMotion.spring({from: 0, to: 300, velocity: -2000, damping: 0.86, response: 0.34, onUpdate: (v) => seen.push(v), onRest: done});
    setTimeout(() => s.retarget(100), 5);
  });
  assert.equal(seen[seen.length - 1], 100);
  assert.ok(Math.min(...seen) < 0, "negative start velocity carried into the motion (no velocity reset)");
});

test("projection matches Apple's formula", () => {
  const ctx = {setTimeout, clearTimeout}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(read("assets/tb-motion.js"), ctx);
  assert.ok(Math.abs(ctx.TBMotion.project(1000) - 499) < 0.01);
});

test("grade undo window is ON by default and can be turned off", () => {
  assert.match(HTML, /function gradeUndoOn\(\)\{ try\{ return localStorage\.getItem\("tipdash_grade_undo"\)!=="0"; \}catch\(_\)\{ return true; \} \}/);
  assert.match(HTML, /id="dd-grade-undo-on"/);
  assert.match(HTML, /if\(gradeUndoOn\(\)\)\{[\s\S]{0,200}gradeUndoWait\(result/);
});

test("god-delete of a settled tip is hold-to-confirm", () => {
  assert.match(HTML, /confirmLabel:"Delete", destructive:true, hold:settled/);
});

// ── Phase 3 · history-nav ──────────────────────────────────────────────────────
test("every view opener records history (navNote) so Back stays in the app", () => {
  for (const sig of ["function enterHome(){", "async function loadDetail(guildId,month,opts){", "async function openFollowers(gid,name){",
    "async function openMyTips(fromGid,fromName,month){", "async function openDiscover(fromGid,fromName){", "async function openResults(guildId,name){",
    "async function openFollowerView(gid,name,month){", "async function openFollowerAllView(month){"]) {
    const i = HTML.indexOf(sig);
    assert.ok(i > 0, sig);
    assert.match(HTML.slice(i, i + 260), /navNote\("#\//, sig + " calls navNote first");
  }
  const b = read("assets/builder.js");
  for (const fn of ["openBuilder", "openEspnBuilder", "openEspnEvent", "openCustom", "openGame", "renderConfirm", "renderBatchConfirm"]) {
    const i = b.search(new RegExp("function " + fn + "\\("));
    assert.match(b.slice(i, i + 260), /navNote\("#\//, fn + " calls navNote");
  }
  assert.match(HTML, /window\.addEventListener\("popstate"/);
});

test("builder back links that don't re-open a view step back through history", () => {
  const b = read("assets/builder.js");
  assert.match(b, /\$\("bc"\)\.onclick=\(\)=>navBack\(/);
  assert.match(b, /\$\("bcb"\)\.onclick=\(\)=>navBack\(/);
});

test("sheets take a history entry (Back closes them) via TBSheet.hooks", () => {
  assert.match(HTML, /TBSheet\.hooks=\{/);
  assert.match(read("assets/tb-motion.js"), /w\.TBSheet\.hooks\.open\(api\)/);
});

test("sticky headers stick: overflow-x clip, not a body scroll container", () => {
  assert.match(HTML, /@supports \(overflow:clip\)\{ html,body\{overflow-x:clip\} \}/);
  assert.match(read("live/index.html"), /@supports \(overflow:clip\)\{html,body\{overflow-x:clip\}\}/);
  assert.match(CSS, /#app > \.top\{position:sticky;top:0/);
});

test("owner tools live in a Settings view, gear keeps the common path", () => {
  assert.match(HTML, /id="dd-owner-settings"/);
  assert.match(HTML, /<div id="settings" hidden><\/div>/);
  assert.match(HTML, /navNote\("#\/settings"/);
});
