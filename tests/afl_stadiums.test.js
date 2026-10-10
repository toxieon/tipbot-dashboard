const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const S = require("../assets/afl-stadiums.js");
const builderJs = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const HOME_GROUNDS = [
  ["MCG", "mcg"],
  ["M.C.G.", "mcg"],
  ["Marvel Stadium", "marvel"],
  ["Docklands", "marvel"],
  ["Adelaide Oval", "adelaide"],
  ["Optus Stadium", "optus"],
  ["Perth Stadium", "optus"],
  ["Gabba", "gabba"],
  ["SCG", "scg"],
  ["S.C.G.", "scg"],
  ["Engie Stadium", "giants"],
  ["Sydney Showground", "giants"],
  ["GMHBA Stadium", "gmhba"],
  ["Kardinia Park", "gmhba"],
  ["People First Stadium", "carrara"],
  ["Carrara", "carrara"],
  ["Bellerive Oval", "bellerive"],
  ["UTAS Stadium", "yorkpark"],
  ["Manuka Oval", "manuka"],
  ["Norwood Oval", "norwood"],
  ["York Park", "yorkpark"],
  ["Traeger Park", "traeger"],
  ["Marrara Oval", "marrara"],
  ["Barossa Park", "barossa"],
  ["Hands Oval", "hands"],
];

test("AFL stadiums: home grounds resolve to distinct venue ids", () => {
  const seen = new Set();
  for (const [name, id] of HOME_GROUNDS) {
    assert.equal(S.venueId(name), id, name);
    seen.add(id);
  }
  assert.ok(seen.size >= 12, "expected many distinct silhouettes");
});

test("AFL stadiums: unknown venue uses generic fallback", () => {
  assert.equal(S.venueId(""), "generic");
  assert.equal(S.venueId("Moon Base Arena"), "generic");
  assert.match(S.stadiumSvg("Moon Base Arena"), /afl-stadium-svg/);
});

test("AFL stadiums: SVG is original markup only", () => {
  const svg = S.stadiumSvg("MCG");
  assert.match(svg, /<svg class="afl-stadium-svg"/);
  assert.doesNotMatch(svg, /<image/i);
  assert.doesNotMatch(svg, /http/i);
});

test("AFL stadiums: builder wires card + game heroes", () => {
  assert.match(builderJs, /aflStadiumCardHero/);
  assert.match(builderJs, /aflStadiumGameHero/);
  assert.match(builderJs, /TBAflStadiums\.cardHeroHtml/);
  assert.match(builderJs, /class="gcard-inner"/);
  assert.match(builderJs, /class="afl-game-hero"/);
});

test("AFL stadiums: styles honour reduced motion and avoid horizontal scroll", () => {
  assert.match(html, /afl-stadiums\.js/);
  assert.match(html, /prefers-reduced-motion:no-preference/);
  assert.match(html, /\.gcard\{[^}]*overflow:hidden/);
  assert.match(html, /\.gcard\{[^}]*min-width:0/);
  assert.match(html, /max-width:100%/);
});
