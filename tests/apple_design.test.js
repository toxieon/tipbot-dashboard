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
  const version = read("VERSION").trim();
  const q = version.replace(/\./g, "\\.");
  assert.match(HTML, new RegExp("<script src=\"\\./assets/tb-motion\\.js\\?v=" + q + "\"></script>"));
  assert.match(read("master/index.html"), new RegExp("<script src=\"\\.\\./assets/tb-motion\\.js\\?v=" + q + "\"></script>"));
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
});

test("TBSheet.confirm falls back to window.confirm when tb-motion.js did not load", () => {
  const guard = /if\(window\.TBSheet && typeof window\.TBSheet\.confirm==="function"\) return window\.TBSheet\.confirm\(o\);/;
  for (const f of ["index.html", "master/index.html"]) {
    const src = read(f);
    assert.match(src, /function tbConfirm\(o\)\{/, f);
    assert.match(src, guard, f);
    assert.match(src, /window\.confirm\(msg\)/, f);
    assert.doesNotMatch(src, /await TBSheet\.confirm\(/, f);
  }
  assert.match(HTML, /window\.TBSheet && typeof window\.TBSheet\.open==="function"/);
});

test("a held grade posts once: second toast cannot drop it, and pagehide flushes it", () => {
  assert.match(HTML, /const GRADE_HELD=\[\]/);
  assert.match(HTML, /if\(!rec \|\| rec\.settled\) return/);
  assert.match(HTML, /window\.addEventListener\("pagehide", flushHeldGrades\)/);
  assert.match(HTML, /document\.addEventListener\("visibilitychange", function\(\)\{ if\(document\.hidden\) flushHeldGrades\(\); \}\)/);
  assert.match(HTML, /keepalive:true/);
  assert.match(HTML, /Authorization:"Bearer "\+getToken\(\)/);
  const toastFn = HTML.slice(HTML.indexOf("function toast(msg, kind, opts)"), HTML.indexOf("function fmtUnitsNet"));
  assert.doesNotMatch(toastFn, /GRADE_HELD/);
  assert.match(toastFn, /clearTimeout\(t\._h\)/);
  assert.doesNotMatch(toastFn, /clearTimeout\(rec\.timer\)/);
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
  for (const sig of ["async function loadDetail(guildId,month,opts){", "async function openFollowers(gid,name){",
    "async function openMyTips(fromGid,fromName,month){", "async function openDiscover(fromGid,fromName){", "async function openResults(guildId,name){",
    "async function openFollowerView(gid,name,month){", "async function openFollowerAllView(month){"]) {
    const i = HTML.indexOf(sig);
    assert.ok(i > 0, sig);
    assert.match(HTML.slice(i, i + 260), /navNote\("#\//, sig + " calls navNote first");
  }
  const home = HTML.indexOf("function enterHome(){");
  assert.ok(home > 0, "function enterHome(){");
  const homeBody = HTML.slice(home, home + 700);
  assert.match(homeBody, /navNote\("#\/"/, "enterHome records home");
  assert.match(homeBody, /if\(ok\) return/, "a deep link is routed before the home shortcut");
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

// ── Phase 4 · design-system ────────────────────────────────────────────────────
test("type scale: 8 rem tokens, no stray px font sizes outside icon/emoji boxes", () => {
  for (const t of ["cap", "foot", "sub", "callout", "body", "h3", "h2", "h1"]) assert.match(CSS, new RegExp("--t-" + t + ":"));
  const px = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1], body = m[2];
    if (/\.logo\b|\.dc-av|\.dc-empty-mark|\.tb-promo-bag|\.tb-promo-chev|\.tbchip-symbol|\.gear\b|\.tb-bookie|\.tb-mini|\.toggle|\.tbs-grab/.test(sel)) continue;
    for (const f of body.matchAll(/font-size:\s*([0-9.]+)px/g)) px.push(sel.trim().slice(-40) + " " + f[1]);
  }
  assert.deepEqual(px, []);
  for (const f of ["assets/builder.js", "assets/admin.js"]) assert.doesNotMatch(read(f), /font-size:\s*[0-9.]+px/, f);
});

test("radius tokens; nested corners concentric (betcard inside game-group)", () => {
  for (const r of ["xs", "sm", "md", "lg"]) assert.match(CSS, new RegExp("--r-" + r + ":"));
  assert.match(CSS, /\.game-group\{border-radius:var\(--r-lg\)\}/);
  assert.match(CSS, /\.betcard\{border-radius:var\(--r-sm\)\}/);
});

test("translucent materials have reduced-transparency and high-contrast fallbacks", () => {
  assert.match(CSS, /\.tray,\.batchtray\{background:color-mix\(in srgb,var\(--card2\) 76%,transparent\);/);
  assert.match(CSS, /@media \(prefers-reduced-transparency:reduce\)\{\s*\.tray,\.batchtray,\.tb-toast,\.dropdown\{background:var\(--card2\)!important/);
});

test("theme changes cross-fade via View Transitions (not on first paint, not with reduced motion)", () => {
  assert.match(HTML, /document\.startViewTransition\(apply\)/);
  assert.match(HTML, /if\(root\.dataset\.theme&&root\.dataset\.theme!==next&&document\.startViewTransition&&!rm/);
});

test("home-screen app: one manifest, Cinna's PNG icons (iOS ignores SVG touch icons)", () => {
  const man = JSON.parse(read("manifest.webmanifest"));
  assert.equal(man.display, "standalone");
  assert.equal(man.short_name, "TipBot");
  assert.equal(man.theme_color, "#0F1420");
  assert.ok(man.icons.length >= 2);
  for (const ic of man.icons) {
    assert.ok(fs.existsSync(path.join(root, ic.src)), ic.src);
    assert.doesNotMatch(ic.src, /assets\/icons\//);
  }
  assert.ok(man.icons.some((i) => i.sizes === "192x192"));
  assert.ok(man.icons.some((i) => i.sizes === "512x512"));
  for (const f of ["index.html", "live/index.html", "master/index.html", "compare/index.html"]) {
    const src = read(f);
    assert.equal((src.match(/rel="manifest"/g) || []).length, 1, f);
    assert.equal((src.match(/rel="apple-touch-icon"/g) || []).length, 1, f);
    assert.match(src, /apple-touch-icon\.png/, f);
    assert.doesNotMatch(src, /assets\/icons\//, f);
  }
});

test("switches are exposed to assistive tech", () => {
  assert.match(read("assets/tb-motion.js"), /setAttribute\("role", "switch"\)/);
  assert.match(read("assets/ext.js"), /id="godtoggle" aria-label="God mode"/);
});
