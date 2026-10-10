// node --test tests/   Standalone assets/mini widgets + labs demo.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const miniDir = path.join(root, "assets", "mini");
const BANNED = [
  /\bforward\b/i,
  /\bmirror\b/i,
  /\bmaster\b/i,
  /\bconsensus\b/i,
  /owner-tools/,
  /\/api\/ops/,
  /custom-games/,
  /ops:/,
];

const Copy = require("../assets/mini/copy-tip.js");
const Unit = require("../assets/mini/unit-calc.js");
const Count = require("../assets/mini/countdown.js");

test("mini assets and lab exist", () => {
  assert.ok(fs.existsSync(path.join(miniDir, "copy-tip.js")));
  assert.ok(fs.existsSync(path.join(miniDir, "unit-calc.js")));
  assert.ok(fs.existsSync(path.join(miniDir, "countdown.js")));
  assert.ok(fs.existsSync(path.join(miniDir, "mini.css")));
  assert.ok(fs.existsSync(path.join(root, "labs", "mini", "index.html")));
});

test("mini scripts avoid console noise and banned strings", () => {
  for (const name of ["copy-tip.js", "unit-calc.js", "countdown.js"]) {
    const text = fs.readFileSync(path.join(miniDir, name), "utf8");
    assert.doesNotMatch(text, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
    for (const pat of BANNED) assert.doesNotMatch(text, pat, name + " must not match " + pat);
  }
});

test("formatTipText builds clean shareable single and multi", () => {
  const single = {
    game_name: "Richmond vs Carlton",
    legs: [{ desc: "Carlton +4.5" }],
    odds: 1.91,
    units: 1,
    bookmaker: "Sportsbet",
  };
  const text = Copy.formatTipText(single);
  assert.match(text, /Richmond vs Carlton/);
  assert.match(text, /Carlton \+4\.5 @ 1\.91 · 1u/);
  assert.match(text, /Sportsbet$/);

  const multi = {
    game_name: "Saturday AFL",
    legs: [{ desc: "Leg A" }, { desc: "Leg B" }],
    odds: 3.5,
    units: 2,
  };
  const m = Copy.formatTipText(multi);
  assert.match(m, /2-leg multi @ 3\.50 · 2u/);
  assert.match(m, /1\. Leg A/);
  assert.match(m, /2\. Leg B/);
});

test("copyTip writes clipboard and toasts on success", async () => {
  const calls = [];
  const sandbox = {
    TBMini: {},
    navigator: { clipboard: { writeText: async (t) => { calls.push(t); } } },
    document: {
      body: { appendChild: () => {} },
      getElementById: () => null,
      createElement: (tag) => ({
        tag,
        className: "",
        classList: { remove: () => {} },
        setAttribute: () => {},
        style: {},
      }),
      querySelectorAll: () => [],
      head: { appendChild: () => {} },
      documentElement: {},
    },
    setTimeout: (fn) => { fn(); return 0; },
    clearTimeout: () => {},
  };
  vm.runInNewContext(fs.readFileSync(path.join(miniDir, "copy-tip.js"), "utf8"), sandbox);
  const ok = await sandbox.TBMini.copyTip({
    legs: [{ desc: "Team A ML" }],
    odds: 2,
    units: 1,
  });
  assert.equal(ok, true);
  assert.match(calls[0], /Team A ML @ 2\.00 · 1u/);
});

test("unitCalc computes stake and return from bankroll %", () => {
  const r = Unit.unitCalc({ bankroll: 10000, unitPct: 1, units: 2, odds: 1.91 });
  assert.equal(r.ok, true);
  assert.equal(r.unitDollars, 100);
  assert.equal(r.stake, 200);
  assert.equal(r.totalReturn, 382);
  assert.equal(r.toWin, 182);
  assert.equal(Unit.money(12.3), "$12.30");
});

test("startsInLabel and countdown flip to LIVE", () => {
  assert.equal(Count.startsInLabel(2 * 3600e3 + 14 * 60e3), "starts in 2h 14m");
  assert.equal(Count.startsInLabel(45 * 60e3), "starts in 45m");
  const el = { textContent: "", className: "", setAttribute: () => {} };
  const now = Date.parse("2026-10-10T12:00:00Z");
  Count.paintChip(el, now + 90 * 60e3, now);
  assert.match(el.textContent, /^starts in /);
  Count.paintChip(el, now - 1000, now);
  assert.equal(el.textContent, "LIVE");
  assert.match(el.className, /tb-mini-chip--live/);
});

test("labs/mini is denied from public build", async () => {
  const { DENY_DIRS, isDeniedRel } = await import("../scripts/build-public.mjs");
  assert.ok(DENY_DIRS.has("labs"));
  assert.equal(isDeniedRel("labs/mini/index.html"), true);
  assert.equal(isDeniedRel("assets/mini/copy-tip.js"), false);
});

test("lab page loads mini scripts", () => {
  const html = fs.readFileSync(path.join(root, "labs", "mini", "index.html"), "utf8");
  assert.match(html, /assets\/mini\/copy-tip\.js/);
  assert.match(html, /TBMini\.mountUnitCalc/);
  assert.match(html, /TBMini\.countdown/);
});
