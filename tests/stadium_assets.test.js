const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const V = require("../assets/stadiums/venues.js");
const B = require("../assets/stadiums/stadium-build.js");
const { isDeniedRel } = require("../scripts/build-public.mjs");

const stadiumDir = path.join(root, "assets", "stadiums");
const vendorDir = path.join(stadiumDir, "vendor");

test("stadium assets: every registry id has a venue JS module", () => {
  for (const id of V.STADIUM_IDS) {
    const file = path.join(stadiumDir, V.jsFile(id));
    assert.ok(fs.existsSync(file), id + " missing " + V.jsFile(id));
  }
});

test("stadium assets: venue modules export a procedural spec", () => {
  for (const id of V.STADIUM_IDS) {
    const mod = require(path.join(stadiumDir, V.jsFile(id)));
    assert.equal(mod.spec.id, id);
    assert.ok(mod.spec.oval && mod.spec.oval.rx > 0);
    assert.ok(mod.spec.tiers >= 2);
    const merged = B.mergeSpec(B.BASE_SPEC, mod.spec);
    assert.equal(merged.id, id);
  }
});

test("stadium assets: three.js vendor present with MIT licence", () => {
  assert.ok(fs.existsSync(path.join(vendorDir, "three.module.min.js")));
  assert.ok(fs.existsSync(path.join(vendorDir, "OrbitControls.js")));
  const lic = fs.readFileSync(path.join(vendorDir, "LICENSE-three.txt"), "utf8");
  assert.match(lic, /MIT/i);
});

test("stadium assets: stadium-build exposes procedural builder", () => {
  assert.equal(typeof B.build, "function");
  assert.equal(typeof B.mergeSpec, "function");
  assert.ok(B.BASE_SPEC.oval);
});

test("stadium assets: venue alias map resolves home grounds", () => {
  assert.equal(V.venueId("MCG"), "mcg");
  assert.equal(V.venueId("GMHBA Stadium"), "gmhba");
  assert.equal(V.venueId("Optus Stadium"), "optus");
  assert.equal(V.venueId("Moon Base"), "generic");
});

test("stadium assets: labs gallery and viewer exist; labs denied from public build", () => {
  assert.ok(fs.existsSync(path.join(root, "labs", "stadiums", "index.html")));
  assert.ok(fs.existsSync(path.join(root, "labs", "stadiums", "viewer.html")));
  assert.match(fs.readFileSync(path.join(root, "labs", "stadiums", "viewer.html"), "utf8"), /three\.module/);
  assert.equal(isDeniedRel("labs/stadiums/index.html"), true);
  assert.equal(isDeniedRel("assets/stadiums/mcg.js"), false);
});

test("stadium assets: handoff doc references 3D asset paths", () => {
  const doc = fs.readFileSync(path.join(root, "docs", "match_centre.md"), "utf8");
  assert.match(doc, /stadium-build\.js/);
  assert.match(doc, /labs\/stadiums\//);
});
