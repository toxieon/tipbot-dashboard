// node --test tests/   Half-point rule parity with TipBot (services/lines.py), shared vectors.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const L = require("../assets/lines.js");
const raw = fs.readFileSync(path.join(__dirname, "fixtures", "half_point_vectors.json"));
// Same sha256 as TipBot tests/test_consensus.py HALF_POINT_SHA256.
const SHA = "15ac00f6a1fb8a2fda363286220d203e40bcc7df9b63dc7a8efe9bc8ceab9554";

test("vectors file is the shared copy", () => {
  assert.equal(crypto.createHash("sha256").update(raw).digest("hex"), SHA);
});
test("applyHalfPointLine matches every vector", () => {
  for (const c of JSON.parse(raw.toString("utf8")).cases) assert.deepEqual(L.applyHalfPointLine(c.in), c.out, c.name);
});
test("note text unchanged", () => {
  assert.equal(L.lineAdjustNote({line: 14.5, line_adjusted_from: 15}), "Line adjusted 15 → 14.5 (half-point)");
  assert.equal(L.lineAdjustNote({line: 14.5}), "");
});
test("index.html uses the shared helper", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  // 0.40.2: the builder (which calls it) moved to the lazy assets/builder.js.
  const builder = fs.readFileSync(path.join(__dirname, "..", "assets", "builder.js"), "utf8");
  assert.match(html, /<script src="\.\/assets\/lines\.js"><\/script>/);
  assert.match(builder, /function applyHalfPointLine\(leg\)\{ return TBLines\.applyHalfPointLine\(leg\); \}/);
});
