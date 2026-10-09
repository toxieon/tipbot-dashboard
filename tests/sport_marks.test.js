// node --test tests/   One sport-mark map for chips, filters, and game labels.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const S = require("../assets/sport-marks.js");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const VERSION = read("VERSION").trim().replace(/\./g, "\\.");
const EMOJI = /🏉|🏈|🏀|⚽|⚾|🎾|🏏|🏇|⛳|🏒|🥊|➕/;

test("every listed sport uses the shared mark", () => {
  assert.equal(S.label("AFL"), "🏉 AFL");
  assert.equal(S.label("AFLW"), "🏉 AFLW");
  assert.equal(S.label("NFL"), "🏈 NFL");
  assert.equal(S.label("NBA"), "🏀 NBA");
  assert.equal(S.label("WNBA"), "🏀 WNBA");
  assert.equal(S.label("NBL"), "🏀 NBL");
  assert.equal(S.label("Soccer"), "⚽ Soccer");
  assert.equal(S.label("NRL"), "🏉 NRL");
  assert.equal(S.label("MLB"), "⚾ MLB");
  assert.equal(S.label("Tennis"), "🎾 Tennis");
  assert.equal(S.label("Cricket"), "🏏 Cricket");
  assert.equal(S.label("Horse racing"), "🏇 Horse racing");
  assert.equal(S.label("Golf"), "⛳ Golf");
  assert.equal(S.label("Hockey"), "🏒 Hockey");
  assert.equal(S.label("NHL"), "🏒 NHL");
  assert.equal(S.label("UFC"), "🥊 UFC");
  assert.equal(S.label("MMA"), "🥊 MMA");
  assert.equal(S.label("Boxing"), "🥊 Boxing");
  assert.equal(S.label("Other"), "➕ Other");
});

test("aliases fold to the same mark and unknown names stay plain", () => {
  assert.equal(S.mark("nhl"), "🏒");
  assert.equal(S.label("Ice hockey"), "🏒 Ice hockey");
  assert.equal(S.label("Hockey/NHL"), "🏒 Hockey/NHL");
  assert.equal(S.label("UFC/MMA"), "🥊 UFC/MMA");
  assert.equal(S.label("horseracing"), "🏇 horseracing");
  assert.equal(S.label("Racing"), "🏇 Racing");
  assert.equal(S.label("OTHER"), "➕ OTHER");
  assert.equal(S.label("  nfl "), "🏈 nfl");
  assert.equal(S.label("🏉 AFL"), "🏉 AFL");
  assert.equal(S.label("All"), "All");
  assert.equal(S.label("Football"), "Football");
  assert.equal(S.label("EPL"), "EPL");
  assert.equal(S.label(""), "");
  assert.equal(S.mark("All"), "");
  assert.equal(S.mark(null), "");
});

test("emoji strings live in the shared map, and each surface calls it", () => {
  const pages = [
    "assets/builder.js",
    "index.html",
    "assets/live-cards.js",
    "live/index.html",
    "live/board/index.html",
    "assets/consensus-ui.js",
    "master/index.html"
  ];
  pages.forEach((p) => assert.doesNotMatch(read(p), EMOJI, p));
  assert.match(read("assets/sport-marks.js"), EMOJI);
  assert.match(read("index.html"), new RegExp("assets/sport-marks\\.js\\?v=" + VERSION));
  assert.match(read("index.html"), /function sportLabel\(name\)/);
  assert.match(read("index.html"), /sportLabel\(sport\)/);
  assert.match(read("assets/builder.js"), /sportLabel\(/);
  assert.doesNotMatch(read("assets/builder.js"), /function sportLabel/);
  assert.match(read("assets/live-cards.js"), /sport-marks\.js/);
  assert.match(read("live/index.html"), new RegExp("assets/sport-marks\\.js\\?v=" + VERSION));
  assert.match(read("live/board/index.html"), new RegExp("assets/sport-marks\\.js\\?v=" + VERSION));
  assert.match(read("live/board/index.html"), /sportLabel\(s\)/);
  assert.match(read("assets/consensus-ui.js"), /sport-marks\.js/);
  assert.match(read("master/index.html"), new RegExp("assets/sport-marks\\.js\\?v=" + VERSION));
});
