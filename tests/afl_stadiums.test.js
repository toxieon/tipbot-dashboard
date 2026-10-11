const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const builderJs = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
const apexCss = fs.readFileSync(path.join(root, "assets/theme-apex.css"), "utf8");
const V = require("../assets/afl-venues.js");
const S = require("../assets/afl-stadiums.js");

const VENUE_KEYS = [
  "mcg",
  "marvel",
  "adelaide",
  "optus",
  "gabba",
  "scg",
  "giants",
  "gmhba",
  "people_first",
  "utas",
  "manuka",
  "blundstone",
];

test("AFL venues: major grounds resolve from API-style strings", () => {
  assert.equal(V.venueKey("MCG"), "mcg");
  assert.equal(V.venueKey("M.C.G."), "mcg");
  assert.equal(V.venueKey("Docklands"), "marvel");
  assert.equal(V.venueKey("Adelaide Oval"), "adelaide");
  assert.equal(V.venueKey("Perth Stadium"), "optus");
  assert.equal(V.venueKey("Gabba"), "gabba");
  assert.equal(V.venueKey("S.C.G."), "scg");
  assert.equal(V.venueKey("ENGIE Stadium"), "giants");
  assert.equal(V.venueKey("GMHBA Stadium"), "gmhba");
  assert.equal(V.venueKey("People First Stadium"), "people_first");
  assert.equal(V.venueKey("UTAS Stadium"), "utas");
  assert.equal(V.venueKey("Manuka Oval"), "manuka");
  assert.equal(V.venueKey("Bellerive Oval"), "blundstone");
});

test("AFL venues: poster assets exist for each major ground", () => {
  for (const key of VENUE_KEYS) {
    const rel = "assets/stadiums/" + key + ".png";
    assert.ok(fs.existsSync(path.join(root, rel)), rel);
    assert.match(V.posterPath(key, "0"), new RegExp(key + "\\.png"));
  }
});

test("AFL stadiums: Three.js vendored locally (MIT)", () => {
  const license = fs.readFileSync(path.join(root, "assets/vendor/THREE-LICENSE.txt"), "utf8");
  assert.match(license, /MIT/i);
  assert.ok(fs.statSync(path.join(root, "assets/vendor/three.module.js")).size > 500000);
  for (const key of VENUE_KEYS) {
    assert.ok(S.VARIANTS[key], key);
  }
});

test("AFL Build UI: hero scroll backdrop and lazy stadium scripts", () => {
  assert.match(builderJs, /afl-stadium-hero/);
  assert.match(builderJs, /afl-build-scroll/);
  assert.match(builderJs, /TD\.load\("afl-venues"\)/);
  assert.match(builderJs, /TD\.load\("afl-stadiums"\)/);
  assert.match(builderJs, /mountAflStadiumHero\(g\.venue,\s*g\)/);
  assert.match(builderJs, /stopAflStadiumHero/);
  assert.match(apexCss, /#afl-app \.afl-stadium-hero/);
  assert.match(apexCss, /#afl-app \.afl-build-scroll/);
});

test("AFL Build UI: static poster path when reduced motion / low power", () => {
  assert.match(builderJs, /TBAflStadiums\.mount/);
  const stadiumJs = fs.readFileSync(path.join(root, "assets/afl-stadiums.js"), "utf8");
  assert.match(stadiumJs, /prefers-reduced-motion/);
  assert.match(stadiumJs, /deviceMemory/);
  assert.match(stadiumJs, /posterEl/);
});
