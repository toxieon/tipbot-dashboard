"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "assets/owner-horse.js"), "utf8");
const build = fs.readFileSync(path.join(__dirname, "..", "scripts/build-public.mjs"), "utf8");

test("owner horse tools stay out of the public build", () => {
  assert.match(build, /"assets\/owner-horse\.js"/);
  assert.match(build, /"\/api\/owner\/horse"/);
});
test("owner horse tools label every report as a prediction", () => {
  assert.match(src, /Prediction only .* not betting advice/);
  assert.match(src, /\/api\/owner\/horse\/predict/);
  assert.match(src, /\/api\/owner\/horse\/profile/);
  assert.match(src, /TD\.loaded\["owner-horse"\]=true/);
});
