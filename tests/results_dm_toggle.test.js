// Results DM (TipBot feat.results_dm): the Features toggle carries one line of help.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("the Results DM toggle explains itself to every admin", () => {
  const start = html.indexOf("const FEATURE_HELP={");
  const end = html.indexOf("function ftGradeRowNote(data, key){");
  assert.ok(start > 0 && end > start);
  const featureHelp = new Function(html.slice(start, end) + "; return featureHelp;")();
  assert.match(featureHelp("feat.results_dm"), /copy-paste results list/);
  assert.equal(featureHelp("feat.builder"), "");
  assert.equal(featureHelp("constructor"), "");
  assert.match(html, /const help=featureHelp\(k\);/);
  assert.match(html, /\(help\?'<span class="feat-help"[^']*'\+esc\(help\)\+'<\/span>':''\)/);
  // Saved through the same Features path as every other flag.
  assert.match(html, /api\("\/api\/feature-flags",\{method:"POST"/);
});
