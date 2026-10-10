const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const raceDir = path.join(root, "assets/racecourses");
const manifest = JSON.parse(fs.readFileSync(path.join(raceDir, "manifest.json"), "utf8"));

const EXPECTED_SLUGS = [
  "flemington",
  "caulfield",
  "moonee_valley",
  "randwick",
  "rosehill",
  "warwick_farm",
  "canterbury",
  "eagle_farm",
  "doomben",
  "morphettville",
  "ascot",
  "belmont",
  "geelong",
  "ballarat",
  "bendigo",
  "sandown",
  "pakenham",
  "cranbourne",
  "kensington",
  "newcastle",
  "gosford",
  "kembla",
  "hawkesbury",
  "gold_coast",
  "sunshine_coast",
  "ipswich",
  "hobart",
  "launceston",
  "ellerslie",
  "trentham",
  "riccarton",
  "menangle",
  "melton",
  "albion_park",
  "gloucester_park",
];

test("Racecourse assets: manifest lists every expected slug", () => {
  assert.equal(manifest.tracks.length, EXPECTED_SLUGS.length);
  const slugs = manifest.tracks.map((t) => t.slug).sort();
  assert.deepEqual(slugs, [...EXPECTED_SLUGS].sort());
});

test("Racecourse assets: each SVG exists and is well-formed", () => {
  for (const t of manifest.tracks) {
    const abs = path.join(raceDir, t.file);
    assert.ok(fs.existsSync(abs), "missing " + t.file);
    const svg = fs.readFileSync(abs, "utf8");
    assert.match(svg, /^<\?xml version="1\.0"/);
    assert.match(svg, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, new RegExp("<title>" + t.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "</title>"));
    assert.match(svg, /id="scene"/);
    assert.match(svg, /id="track-map"/);
    assert.ok(Array.isArray(t.aliases) && t.aliases.length > 0);
  }
});

test("Public build excludes labs gallery", async () => {
  const { DENY_DIRS } = await import("../scripts/build-public.mjs");
  assert.ok(DENY_DIRS.has("labs"));
});
