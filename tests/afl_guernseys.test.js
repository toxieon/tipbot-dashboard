const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const G = require("../assets/afl-guernseys.js");
const builderJs = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
const apexCss = fs.readFileSync(path.join(root, "assets/theme-apex.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

const AFL_MEN_IDS = [
  "adelaide",
  "brisbane",
  "carlton",
  "collingwood",
  "essendon",
  "fremantle",
  "geelong",
  "goldcoast",
  "gws",
  "hawthorn",
  "melbourne",
  "northmelbourne",
  "portadelaide",
  "richmond",
  "stkilda",
  "sydney",
  "westcoast",
  "westernbulldogs",
];

test("AFL guernseys: all 18 AFL clubs resolve from fixture names", () => {
  const names = [
    "Adelaide Crows",
    "Brisbane Lions",
    "Carlton",
    "Collingwood",
    "Essendon",
    "Fremantle",
    "Geelong Cats",
    "Gold Coast Suns",
    "GWS Giants",
    "Hawthorn",
    "Melbourne",
    "North Melbourne",
    "Port Adelaide",
    "Richmond",
    "St Kilda",
    "Sydney Swans",
    "West Coast Eagles",
    "Western Bulldogs",
  ];
  names.forEach((n, i) => {
    const spec = G.lookupTeam(n);
    assert.ok(spec, "missing spec for " + n);
    assert.equal(spec.id, AFL_MEN_IDS[i]);
  });
  assert.equal(G.CLUBS.filter((c) => AFL_MEN_IDS.includes(c.id)).length, 18);
});

test("AFLW clubs share the same map (incl. Tasmania)", () => {
  assert.equal(G.lookupTeam("Greater Western Sydney").id, "gws");
  assert.equal(G.lookupTeam("Tasmania").id, "tasmania");
});

test("AFL guernseys: unknown team uses neutral fallback pattern", () => {
  const spec = G.specFor("Fictional FC");
  assert.equal(spec.id, "unknown");
  const svg = G.guernseySvg("Fictional FC", null, 34);
  assert.match(svg, /guernsey-svg/);
  assert.match(svg, /#2a3550/);
  assert.doesNotMatch(svg, /<text/);
});

test("AFL guernseys: jumper number when present, omitted otherwise", () => {
  const withNum = G.guernseySvg("Carlton", 5, 34);
  assert.match(withNum, /<text[^>]*>5</);
  const noNum = G.guernseySvg("Carlton", null, 34);
  assert.doesNotMatch(noNum, /<text/);
  const empty = G.guernseySvg("Carlton", "", 34);
  assert.doesNotMatch(empty, /<text/);
});

test("white-striped jumpers use a primary plate behind the number", () => {
  const clubs = ["Carlton", "Collingwood", "Geelong", "North Melbourne", "St Kilda", "Western Bulldogs"];
  clubs.forEach((name) => {
    const svg = G.guernseySvg(name, 4, 34);
    assert.ok(G.needsNumberPlate(G.specFor(name)), name);
    assert.match(svg, /<ellipse[^>]*opacity=".93"/, name);
    assert.match(svg, /<text[^>]*>4</, name);
  });
  const ess = G.guernseySvg("Essendon", 4, 34);
  assert.ok(!G.needsNumberPlate(G.specFor("Essendon")));
  assert.doesNotMatch(ess, /<ellipse[^>]*opacity=".93"/);
});

test("AFL player legs: tray/review wiring and reduced motion", () => {
  const leg = { player: "Pat Cripps", team: "Carlton", number: 9, stat: "Disposals", line: 24.5, side: "Over" };
  assert.ok(G.isAflPlayerLeg(leg));
  assert.ok(!G.isAflPlayerLeg({ kind: "racing", runner_number: 3 }));
  assert.ok(!G.isAflPlayerLeg({ player: "X", custom: true }));
  assert.match(G.legChipHtml(leg, true), /tray-guernsey-pop/);
  assert.match(G.legChipHtml(leg, false), /data-reduced="1"/);
  assert.match(builderJs, /chip--afl/);
  assert.match(builderJs, /TBAflGuernseys\.playerMarkHtml/);
  assert.match(html, /afl-guernseys\.js/);
  assert.match(apexCss, /prefers-reduced-motion:\s*reduce/);
  assert.match(apexCss, /guernsey-row-in/);
  assert.match(apexCss, /tray-guernsey-pop/);
});
