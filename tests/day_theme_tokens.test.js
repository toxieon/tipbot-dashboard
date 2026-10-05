// node --test tests/   B2: no dark-only pastel text colours in index.html's <style> block (Day theme contrast).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

// Rules the handoff says to leave alone: a later theme block overrides them with tokens.
const LEAVE_ALONE = [".b-win", ".b-loss", ".addbtn", ".compbadge", ".viewas b"];
const BANNED = ["#7ee0a6", "#f0857f", "#9cc0ff", "#9fc7ff"];

test("no banned pastel hex as a color: value inside <style>", () => {
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(m, "<style> block missing");
  const css = m[1].replace(/\/\*[\s\S]*?\*\//g, "");
  const offenders = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let r;
  while ((r = ruleRe.exec(css))) {
    const sel = r[1].trim();
    if (LEAVE_ALONE.some(s => sel.split(",").some(part => part.trim().startsWith(s)))) continue;
    const declRe = /(?:^|;|\s)color\s*:\s*([^;]+)/gi;
    let d;
    while ((d = declRe.exec(r[2]))) {
      const v = d[1].toLowerCase();
      for (const hex of BANNED) if (v.includes(hex)) offenders.push(sel + " → color:" + d[1].trim());
    }
  }
  assert.deepEqual(offenders, []);
});
