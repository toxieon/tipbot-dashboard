// node --test tests/   The extra settings tab is gated and its panel is not in the public site.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("the extra settings tab is gated and loads its panel on demand", () => {
  assert.match(html, /const connTab=isAdmin\?/);
  assert.match(html, /STATE\.ops===true&&!STATE\.viewAs/);
  assert.match(html, /ensureExt\(\)\.then\(function\(\)\{/);
  assert.doesNotMatch(html, /assets\/connectors\.js/);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "assets", "connectors.js")), false);
});
