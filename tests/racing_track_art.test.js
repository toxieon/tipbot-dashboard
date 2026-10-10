const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const A = require("../assets/racing-track-art.js");
const R = require("../assets/racing-legs.js");
const builderJs = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const apexCss = fs.readFileSync(path.join(root, "assets/theme-apex.css"), "utf8");

const METRO = [
  ["Flemington", "flemington"],
  ["Caulfield", "caulfield"],
  ["Moonee Valley", "moonee_valley"],
  ["Randwick", "randwick"],
  ["Rosehill Gardens", "rosehill"],
  ["Warwick Farm", "warwick_farm"],
  ["Canterbury Park", "canterbury"],
  ["Eagle Farm", "eagle_farm"],
  ["Doomben", "doomben"],
  ["Morphettville", "morphettville"],
  ["Ascot", "ascot"],
  ["Belmont Park", "belmont"],
  ["Hobart (Elwick)", "hobart"],
  ["Launceston", "launceston"],
];

const PROVINCIAL = [
  ["Sandown", "sandown"],
  ["Pakenham", "pakenham"],
  ["Geelong", "geelong"],
  ["Ballarat", "ballarat"],
  ["Bendigo", "bendigo"],
  ["Kembla Grange", "kembla_grange"],
  ["Newcastle", "newcastle"],
  ["Gosford", "gosford"],
  ["Hawkesbury", "hawkesbury"],
  ["Gold Coast", "gold_coast"],
  ["Sunshine Coast", "sunshine_coast"],
  ["Ipswich", "ipswich"],
  ["Ellerslie", "ellerslie"],
  ["Trentham", "trentham"],
  ["Riccarton Park", "riccarton"],
];

test("venue hero: metro and provincial Ladbrokes meeting names map to keys", () => {
  for (const [name, key] of METRO.concat(PROVINCIAL)) {
    assert.equal(A.venueKey(name), key, name);
  }
});

test("venue hero: aliases and unknown meetings", () => {
  assert.equal(A.venueKey("Caloundra"), "sunshine_coast");
  assert.equal(A.venueKey("Bundall"), "gold_coast");
  assert.equal(A.venueKey("Mowbray"), "launceston");
  assert.equal(A.venueKey("Elwick"), "hobart");
  assert.equal(A.venueKey("The Valley"), "moonee_valley");
  assert.equal(A.venueKey("Kembla"), "kembla_grange");
  assert.equal(A.venueKey("Warrnambool"), "generic");
  assert.equal(A.venueKey(""), "generic");
});

test("venue hero: SVG is original markup with grandstand, turf and rails", () => {
  const svg = A.venueHeroSvg("Flemington");
  assert.match(svg, /^<svg class="race-venue-hero"/);
  assert.match(svg, /rvh-stand/);
  assert.match(svg, /rvh-rail/);
  assert.match(svg, /rvh-turf-stripes/);
  assert.match(svg, /aria-label="Flemington"/);
  assert.doesNotMatch(svg, /<image/i);
});

test("venue hero: generic fallback when track is not in the feed set", () => {
  const svg = A.venueHeroSvg("Toowoomba");
  assert.equal(A.venueKey("Toowoomba"), "generic");
  assert.match(svg, /aria-label="Racecourse"/);
  assert.match(svg, /race-venue-hero/);
});

test("major track maps unchanged (separate from venue heroes)", () => {
  assert.equal(R.trackKey("Randwick"), "randwick");
  assert.equal(R.trackKey("Ballarat"), null);
  assert.match(R.trackMapSvg("Flemington"), /Flemington/);
  assert.equal(R.trackMapSvg("Geelong"), "");
});

test("Racing UI: meeting page renders venue hero header", () => {
  assert.match(html, /racing-track-art\.js/);
  assert.match(builderJs, /racing-meeting-hero/);
  assert.match(builderJs, /TBRacingTrackArt\.venueHeroSvg/);
  assert.match(apexCss, /\.racing-meeting-hero/);
});
