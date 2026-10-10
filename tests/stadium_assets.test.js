const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const V = require("../assets/stadiums/venues.js");
const { isDeniedRel } = require("../scripts/build-public.mjs");

const stadiumDir = path.join(root, "assets", "stadiums");

function readSvg(id) {
  return fs.readFileSync(path.join(stadiumDir, id + ".svg"), "utf8");
}

test("stadium assets: every registry id has a standalone SVG file", () => {
  for (const id of V.STADIUM_IDS) {
    const file = path.join(stadiumDir, V.svgFile(id));
    assert.ok(fs.existsSync(file), id + " missing " + V.svgFile(id));
  }
});

test("stadium assets: SVG files are well-formed and self-contained", () => {
  for (const id of V.STADIUM_IDS) {
    const svg = readSvg(id);
    assert.match(svg, /^<\?xml version="1\.0"/);
    assert.match(svg, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /viewBox="0 0 200 120"/);
    assert.ok(svg.includes('data-venue-id="' + id + '"'), id + " data-venue-id");
    assert.doesNotMatch(svg, /<image/i);
    assert.doesNotMatch(svg, /(?:href|xlink:href)\s*=\s*["']https?:/i);
    assert.ok(svg.trim().endsWith("</svg>"));
  }
});

test("stadium assets: venue alias map resolves home grounds", () => {
  assert.equal(V.venueId("MCG"), "mcg");
  assert.equal(V.venueId("Marvel Stadium"), "marvel");
  assert.equal(V.venueId("Adelaide Oval"), "adelaide");
  assert.equal(V.venueId("People First Stadium"), "carrara");
  assert.equal(V.venueId("Moon Base"), "generic");
});

test("stadium assets: match centre lab prototype exists and public build denies labs/", () => {
  const lab = path.join(root, "labs", "match-centre", "index.html");
  assert.ok(fs.existsSync(lab));
  assert.match(fs.readFileSync(lab, "utf8"), /assets\/stadiums\//);
  assert.equal(isDeniedRel("labs/match-centre/index.html"), true);
  assert.equal(isDeniedRel("assets/stadiums/mcg.svg"), false);
});

test("stadium assets: handoff doc references asset paths", () => {
  const doc = fs.readFileSync(path.join(root, "docs", "match_centre.md"), "utf8");
  assert.match(doc, /assets\/stadiums\//);
  assert.match(doc, /labs\/match-centre\//);
});
