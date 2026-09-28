// node --test tests/   Shared sport-routing keyword vectors (identical file in TipBot tests/fixtures).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const K = require("../assets/sport-keywords.js");
const FIXTURE = path.join(__dirname, "fixtures", "sport_keywords_vectors.json");
// Same sha256 as TipBot tests/test_sport_routing.py VECTORS_SHA256.
const VECTORS_SHA256 = "40802d4078b790de34ab53f9853c29a6cbcfc5610f659172db2230bc7c1ad37e";
const raw = fs.readFileSync(FIXTURE);
const V = JSON.parse(raw.toString("utf8"));

test("vectors file is the shared copy", () => {
  assert.equal(crypto.createHash("sha256").update(raw).digest("hex"), VECTORS_SHA256);
});
test("parse vectors", () => {
  for (const c of V.parse) assert.deepEqual(K.parseTerms(c.input), c.terms, JSON.stringify(c.input));
});
test("match vectors", () => {
  for (const c of V.match) assert.deepEqual(K.matchingTerms(K.parseTerms(c.terms), c.text), c.hits, c.terms + " | " + c.text);
});
test("limits", () => {
  assert.match(K.validateTerms(Array.from({length: 51}, (_, i) => "t" + i).join(",")).error, /50/);
  assert.match(K.validateTerms("x".repeat(61)).error, /60/);
  assert.equal(K.validateTerms("nfl, super bowl").error, null);
});
