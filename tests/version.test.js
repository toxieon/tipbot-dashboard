// node --test tests/   Versioning (VERSIONING.md): VERSION file, settings placeholder and CHANGELOG agree.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();

test("VERSION is x.y.z", () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
});

test("Settings menu keeps the version placeholder and CHANGELOG names VERSION", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /id="dd-version"[^>]*>tipdash v__TD_VERSION__</);
  assert.match(html, /TD\.version="__TD_VERSION__"/);
  const log = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  assert.match(log, new RegExp("## " + version.replace(/\./g, "\\.") + " "));
});
