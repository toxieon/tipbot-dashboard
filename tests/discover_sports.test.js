// node --test tests/discover_sports.test.js — Discover sport chips and card tags.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
require(path.join(root, "assets/sport-marks.js"));
const DS = require(path.join(root, "assets/discover-sports.js"));
const VERSION = "__TD_VERSION__";

const listed = [
  { guild_id: "1", display_name: "Footy Edge", sports: [{ sport: "AFL", settled: 30 }, { sport: "NRL", settled: 8 }, { sport: "NBA", settled: 2 }] },
  { guild_id: "2", display_name: "Railbird", sports: [{ sport: "Racing", settled: 22 }] },
  { guild_id: "3", display_name: "Sunday Sheet", sports: ["NFL", "NBA"] },
  { guild_id: "4", display_name: "Pitch Side", sport_stats: { Soccer: 12 } },
  { guild_id: "5", display_name: "Quiet Book", units_net: 4 }
];

test("chips are the sports listed tipsters actually tip, in a stable order", () => {
  assert.deepEqual(DS.catalog(listed), ["AFL", "Horse Racing", "NRL", "NBA", "NFL", "Soccer"]);
  assert.deepEqual(DS.displayOf("horse-racing"), "Horse Racing");
  assert.deepEqual(DS.displayOf("gallops"), "Horse Racing");
  assert.equal(DS.displayOf("AFL tipster"), "");
  assert.equal(DS.displayOf(""), "");
});

test("top sports are the highest settled counts, three at most", () => {
  assert.deepEqual(DS.topSports(listed[0], 3), ["AFL", "NRL", "NBA"]);
  assert.deepEqual(DS.topSports(listed[1]), ["Horse Racing"]);
  assert.deepEqual(DS.sportsOf(listed[2]).map((row) => row.name), ["NBA", "NFL"]);
  assert.equal(DS.sportsOf(listed[2])[0].n, 1);
});

test("more than one sport matches any of them; All shows everyone", () => {
  assert.equal(DS.matches(listed[0], []), true);
  assert.equal(DS.matches(listed[4], []), true);
  assert.equal(DS.matches(listed[4], ["AFL"]), false);
  const picked = DS.toggle(DS.toggle([], "AFL"), "Racing");
  assert.deepEqual(picked, ["AFL", "Horse Racing"]);
  assert.equal(DS.matches(listed[0], picked), true);
  assert.equal(DS.matches(listed[1], picked), true);
  assert.equal(DS.matches(listed[3], picked), false);
  assert.deepEqual(DS.toggle(picked, "AFL"), ["Horse Racing"]);
  assert.deepEqual(DS.toggle(picked, "All"), []);
  assert.deepEqual(DS.toggle(picked, ""), []);
});

test("stats and tip rows fill in when the sports field is missing", () => {
  const fromStats = { stats: { by_sport: { NFL: { settled: 4 }, NBA: { n: 9 } } } };
  assert.deepEqual(DS.topSports(fromStats), ["NBA", "NFL"]);
  const fromTips = {
    tips: {
      settled: [{ sport: "AFL" }, { sport: "AFL" }, { league: "NRL" }, { sport: "AFL", imported: true }],
      pending: [{ sport: "Soccer" }]
    },
    recent_tips: [{ sport: "AFL" }],
    form: { entries: [{ comp: "NRL", source: "import" }, { sport: "NFL" }] }
  };
  const rows = DS.sportsOf(fromTips);
  assert.deepEqual(rows.map((row) => row.name), ["AFL", "NRL", "NFL", "Soccer"]);
  assert.equal(rows[0].n, 3);
  const explicitWins = { sports: [{ sport: "NBA", settled: 2 }], tips: [{ sport: "AFL" }, { sport: "AFL" }] };
  assert.deepEqual(DS.topSports(explicitWins), ["NBA"]);
  assert.deepEqual(DS.topSports({ sport: "WNBA" }), ["WNBA"]);
  assert.deepEqual(DS.catalog([{ sports: [{ sport: "Cricket", settled: 0 }, { sport: "Golf", settled: 3 }] }]), ["Golf"]);
});

test("chip and tag markup escapes labels and marks the selection", () => {
  const html = DS.chipsHtml(["AFL", "Horse Racing", "<script>"], ["Horse Racing"]);
  assert.match(html, /data-sport=""[^>]*aria-pressed="false"/);
  assert.match(html, /data-sport="AFL"/);
  assert.match(html, /data-sport="Horse Racing"[^>]*aria-pressed="true"/);
  assert.match(html, /🏇 Horse Racing/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  const tags = DS.tagsHtml(DS.topSports(listed[0]));
  assert.match(tags, /class="dc-sport-tags"/);
  assert.match(tags, /🏉 AFL/);
  assert.match(tags, /dc-sport-tag/);
  assert.equal(DS.tagsHtml([]), "");
  const all = DS.chipsHtml(["AFL"], []);
  assert.match(all, /data-sport=""[^>]*aria-pressed="true"/);
  assert.match(all, />All</);
});

test("Discover page wires the chip row, card tags, and phone layout", () => {
  const html = read("index.html");
  const css = html;
  assert.match(html, new RegExp('<script src="\\./assets/discover-sports\\.js\\?v=' + VERSION + '"></script>'));
  assert.match(html, /id="dc-sports" class="dc-sports"/);
  assert.match(html, /aria-label="Filter by sport"/);
  assert.match(html, /DiscoverSports\.catalog\(list\)/);
  assert.match(html, /DiscoverSports\.toggle\(picked/);
  assert.match(html, /DiscoverSports\.matches\(t, picked\)/);
  assert.match(html, /DiscoverSports\.tagsHtml\(DiscoverSports\.topSports\(/);
  assert.match(css, /\.dc-sport\{[^}]*min-height:44px/);
  assert.match(css, /\.dc-sports\{[^}]*overflow-x:auto/);
  assert.match(css, /@media \(max-width:639px\)\{[\s\S]*\.dc-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(read("assets/tb-motion.js"), /dc-sports/);
});
