// node --test tests/   Versioning (VERSIONING.md): VERSION file, Settings-menu label and CHANGELOG agree.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();

test("VERSION is x.y.z", () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
});

test("Settings menu label and CHANGELOG show the current version", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const m = html.match(/id="dd-version"[^>]*>tipdash v(\d+\.\d+\.\d+)</);
  assert.ok(m, "#dd-version label missing");
  assert.equal(m[1], version);
  const log = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  assert.match(log, new RegExp("^## " + version.replace(/\./g, "\\.") + " ", "m"));
});
