const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const apexCss = fs.readFileSync(path.join(root, "assets", "theme-apex.css"), "utf8");
const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
const publicLog = fs.readFileSync(path.join(root, "PUBLIC_CHANGELOG.md"), "utf8");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();

test("0.73.4 version and changelog stay in lockstep", () => {
  assert.equal(version, "0.73.4");
  assert.match(changelog, /^## 0\.73\.4 · 2026-11-28 · `fix` · Units calendar readable on phones/m);
  assert.match(publicLog, /^## 0\.73\.4$/m);
  const head = changelog.split("## 0.73.3")[0] + publicLog.split("## 0.73.3")[0];
  assert.doesNotMatch(head, /platform owner|owner-only|owner only/i);
});

test("renderCalendar marks day numbers, units and the month tools for mobile CSS", () => {
  assert.match(html, /function calPlText\(net\)\{/);
  assert.match(html, /class="cal-num"/);
  assert.match(html, /class="cal-pl"/);
  assert.match(html, /calPlText\(e\.net\)/);
  assert.match(html, /class="cal-hd-tools"/);
  assert.match(html, /class="cal-month-label"/);
  // Desktop inline layout is still the square cell; mobile CSS overrides it.
  assert.match(html, /class="cal-day"[^>]*style="aspect-ratio:1;/);
});

test("Apex scopes the phone Units calendar layout to the calendar panel", () => {
  const start = apexCss.indexOf("0.73.4: Units calendar on phones");
  assert.ok(start >= 0, "mobile calendar comment");
  const block = apexCss.slice(start);
  assert.match(block, /@media \(max-width: 640px\)/);
  assert.match(block, /html\[data-theme="apex"\] \.panel\[data-sec\$="calendar"\] \.cal-day/);
  assert.match(block, /min-height:\s*56px/);
  assert.match(block, /aspect-ratio:\s*auto\s*!important/);
  assert.match(block, /flex-wrap:\s*nowrap\s*!important/);
  assert.match(block, /\.cal-pl/);
  assert.match(block, /\.cal-nav-row/);
  // Every rule in the new block stays on the calendar panel or its calendar classes.
  const media = block.slice(block.indexOf("@media"));
  const inner = media.slice(media.indexOf("{") + 1, media.lastIndexOf("}"));
  const rules = inner.split("}").map((s) => s.trim()).filter(Boolean);
  assert.ok(rules.length >= 6, "expected several calendar rules");
  for (const rule of rules) {
    const sel = rule.split("{")[0];
    assert.match(
      sel,
      /\[data-sec\$="calendar"\]/,
      "selector is scoped to the calendar panel: " + sel
    );
  }
});
