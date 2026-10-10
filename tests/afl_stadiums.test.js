const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const S = require("../assets/afl-stadiums.js");
const builderJs = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
const apexCss = fs.readFileSync(path.join(root, "assets/theme-apex.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const MAIN_VENUES = [
  ["MCG", "mcg"],
  ["Marvel Stadium", "marvel"],
  ["Adelaide Oval", "adelaide_oval"],
  ["Optus Stadium", "optus"],
  ["Gabba", "gabba"],
  ["SCG", "scg"],
  ["ENGIE Stadium", "sydney_showground"],
  ["Sydney Showground", "sydney_showground"],
  ["People First Stadium", "people_first"],
  ["GMHBA Stadium", "gmhba"],
  ["UTAS Stadium", "utas"],
  ["Blundstone Arena", "blundstone"],
  ["Manuka Oval", "manuka"],
  ["TIO Stadium", "tio_marrara"],
  ["Marrara Oval", "tio_marrara"],
  ["Ninja Stadium", "ninja"],
];

test("AFL stadiums: main venues resolve from fixture names", () => {
  MAIN_VENUES.forEach(([name, id]) => {
    const spec = S.lookupVenue(name);
    assert.ok(spec, "missing venue for " + name);
    assert.equal(spec.id, id, name);
  });
  assert.equal(S.VENUES.length, 14);
});

test("AFL stadiums: aliases cover common renames", () => {
  assert.equal(S.lookupVenue("Docklands").id, "marvel");
  assert.equal(S.lookupVenue("Perth Stadium").id, "optus");
  assert.equal(S.lookupVenue("Metricon Stadium").id, "people_first");
  assert.equal(S.lookupVenue("Kardinia Park").id, "gmhba");
  assert.equal(S.lookupVenue("York Park").id, "utas");
});

test("AFL stadiums: unknown venue uses generic oval fallback", () => {
  const spec = S.specFor("Regional Sports Centre");
  assert.equal(spec.id, "generic");
  const svg = S.stadiumSvg(spec, "hero");
  assert.match(svg, /data-stadium="generic"/);
  assert.match(svg, /afs-svg--hero/);
  assert.doesNotMatch(svg, /<image/i);
});

test("AFL stadiums: hero and card SVG are original markup only", () => {
  const hero = S.heroHtml("MCG");
  assert.match(hero, /afs-scene/);
  assert.match(hero, /data-stadium="mcg"/);
  assert.match(hero, /afs-tower/);
  const card = S.cardHtml("Optus Stadium");
  assert.match(card, /afs-card-scene/);
  assert.match(card, /data-stadium="optus"/);
});

test("AFL stadium UI: game page hero, cards, reduced motion", () => {
  assert.match(builderJs, /id="afl-app"/);
  assert.match(builderJs, /afl-hero-bg/);
  assert.match(builderJs, /wireAflHero/);
  assert.match(builderJs, /gcard-stadium/);
  assert.match(builderJs, /TBAflStadiums\.heroHtml/);
  assert.match(builderJs, /prefers-reduced-motion: reduce/);
  assert.match(html, /afl-stadiums\.js/);
  assert.match(apexCss, /#afl-app/);
  assert.match(apexCss, /prefers-reduced-motion:\s*reduce/);
});
