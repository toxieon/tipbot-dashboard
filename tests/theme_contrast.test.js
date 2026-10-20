// WCAG 2.1 AA for the key theme pairs on every surface. Text pairs need 4.5:1,
// UI / large-text pairs (accent, pending border) need 3:1. The maths lives in
// scripts/token-sheet.mjs (own luminance function, no library).
const test = require("node:test");
const assert = require("node:assert/strict");

// "surface theme pairId" entries that are known to fail today. Each one needs
// a comment and a decision from Cinna. Colours are not changed in this job.
// Empty on 18 Oct 2026: every key pair passes.
const KNOWN_FAILS = [];

test("luminance and contrast maths match WCAG reference values", async () => {
  const ts = await import("../scripts/token-sheet.mjs");
  const black = ts.parseColor("#000"), white = ts.parseColor("#ffffff");
  assert.equal(ts.luminance(black), 0);
  assert.equal(ts.luminance(white), 1);
  assert.equal(Math.round(ts.contrastRatio(black, white) * 100) / 100, 21);
  // #767676 on white is the classic 4.54:1 AA edge.
  assert.equal(Math.round(ts.contrastRatio(ts.parseColor("#767676"), white) * 100) / 100, 4.54);
  assert.deepEqual(ts.parseColor("rgba(255, 0, 0, .5)"), { r: 255, g: 0, b: 0, a: 0.5 });
  assert.equal(ts.resolveValue("var(--a)", { "--a": "var(--b)", "--b": "#123456" }), "#123456");
});

test("every key text pair meets AA on every surface and theme", async () => {
  const ts = await import("../scripts/token-sheet.mjs");
  const model = ts.buildModel();
  const fails = [], unresolved = [];
  for (const [surface, themes] of Object.entries(model)) {
    for (const [theme, map] of Object.entries(themes)) {
      for (const row of ts.contrastFor(map)) {
        const id = `${surface} ${theme} ${row.id}`;
        if (row.ratio == null) { if (row.declared) unresolved.push(id); continue; } // a surface that never declares the var doesn't use it
        if (!row.pass && !KNOWN_FAILS.includes(id)) fails.push(`${id} ${row.ratio}:1 (needs ${row.need}:1)`);
      }
    }
  }
  assert.deepEqual(unresolved, [], "pairs whose colours could not be resolved");
  assert.deepEqual(fails, []);
});

test("generated sheet stays out of the public build and makes no external requests", async () => {
  const ts = await import("../scripts/token-sheet.mjs");
  const { ALLOW } = await import("../scripts/build-public.mjs");
  assert.ok(!ALLOW.some(entry => entry === "labs" || entry.startsWith("labs/")));
  const html = ts.renderPage(ts.buildModel(), ["test"]);
  assert.doesNotMatch(html, /(?:src|href)=["']https?:/i);
  assert.doesNotMatch(html, /url\(\s*["']?https?:/i);
  assert.doesNotMatch(html, /console\./);
  assert.doesNotMatch(html, /target=["']_blank/);
});
