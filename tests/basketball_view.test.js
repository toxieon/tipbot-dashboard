// Basketball Game view: quarter scores, stat labels on cards, the box score panel,
// venue selection (arena vs MCG), arena cameras and the Player animations gate.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const FL = require("../assets/follower-live.js");
const V = require("../assets/venues/select.js");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const arenaSrc = fs.readFileSync(path.join(root, "assets/venues/arena.js"), "utf8");

function memoryStorage(init) {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

const GAME = {
  game_name: "Thunder @ Pacers", sport: "NBA", league: "nba", sport_kind: "basketball",
  live: true, concluded: false, phase_label: "Q3 5:32", period: 3, clock_display: "5:32", venue: "",
  home: { name: "Indiana Pacers", abbr: "IND", score: 87, period_scores: [35, 25, 27] },
  away: { name: "Oklahoma City Thunder", abbr: "OKC", score: 80, period_scores: [34, 23, 23] },
  box: {
    home: { abbr: "IND", name: "Indiana Pacers", players: [
      { player_id: "1", name: "Pascal Siakam", min: 35, starter: true, has_leg: false, pts: 20, reb: 8, ast: 5, "3pm": 2, stl: 5, blk: 1, pra: 33 },
      { player_id: "2", name: "Obi Toppin", min: 29, starter: false, has_leg: false, pts: 17, reb: 7, ast: 1, "3pm": 2, stl: 1, blk: 1, pra: 25 },
    ] },
    away: { abbr: "OKC", name: "Oklahoma City Thunder", players: [
      { player_id: "4278073", name: "Shai Gilgeous-Alexander", min: 40, starter: true, has_leg: true, pts: 18, reb: 3, ast: 0, "3pm": 1, stl: 3, blk: 1, pra: 22 },
      { player_id: "3", name: "Alex Caruso", min: 30, starter: false, has_leg: false, pts: 20, reb: 3, ast: 0, "3pm": 1, stl: 5, blk: 1, pra: 23 },
    ] },
  },
};

const PAYLOAD = {
  ok: true, game: GAME,
  tipsters: [{ user_id: "42", name: "Tipster", legs: [
    { id: "t1:0", player: "Shai Gilgeous-Alexander", line_label: "25+", stat_label: "PTS", current: 18, line: 25, status: "pending", odds: 1.9 },
    { id: "t1:1", player: "Williams", line_label: "10+", stat_label: "PTS", current: null, line: 10, status: "pending", note: "player not found in box score" },
  ] }],
};

test("score: plain points with quarter scores for basketball, none for AFL", () => {
  const h = FL.scoreHtml(GAME);
  assert.match(h, /<b>87<\/b>/);
  assert.match(h, /Q3 5:32/);
  assert.match(h, /class="fl-qs"[^>]*>35 · 25 · 27</);
  assert.match(h, />34 · 23 · 23</);
  const afl = FL.scoreHtml({ sport: "AFL", home: { name: "A", score: 61, period_scores: [1, 2] }, away: { name: "B", score: 40 }, phase_label: "Q3" });
  assert.doesNotMatch(afl, /fl-qs/);
});

test("cards: 18/25 PTS, the stat label in the title, and the reason when there are no stats", () => {
  const out = FL.render(PAYLOAD);
  assert.match(out, /<b>18\/25<small> PTS<\/small><\/b>/);
  assert.match(out, /Shai Gilgeous-Alexander 25\+ PTS/);
  assert.match(out, /class="fl-why">Player not found in box score</);
  assert.equal(FL.progressPct(18, 25), 72);
  // AFL cards with a worded label are untouched.
  const afl = FL.render({ game: { live: true }, tipsters: [{ name: "x", legs: [{ id: "a", player: "Z. Quill", line_label: "25+ disposals", current: 18, line: 25, status: "pending" }] }] });
  assert.match(afl, /Z\. Quill 25\+ disposals/);
  assert.doesNotMatch(afl, /<small>/);
});

test("box score: two team tabs, eight columns, leg players highlighted, sortable", () => {
  const h = FL.boxScoreHtml(GAME, { team: "away" });
  assert.match(h, /<details class="fl-box" id="flive-box" open>/);
  assert.match(h, /data-box-team="home"[^>]*>IND</);
  assert.match(h, /data-box-team="away" aria-selected="true" class="on">OKC</);
  for (const col of ["MIN", "PTS", "REB", "AST", "3PM", "STL", "BLK", "PRA"]) assert.match(h, new RegExp(">" + col + "</button>"));
  assert.match(h, /<tr class="fl-bx-leg"><th scope="row" class="fl-bx-name">Shai Gilgeous-Alexander/);
  assert.doesNotMatch(h, /Pascal Siakam/);
  assert.deepEqual(FL.boxRows(GAME.box.away, "pts").map((p) => p.name), ["Alex Caruso", "Shai Gilgeous-Alexander"]);
  assert.deepEqual(FL.boxRows(GAME.box.away, "").map((p) => p.name), ["Shai Gilgeous-Alexander", "Alex Caruso"]);
  assert.match(FL.boxScoreHtml(GAME, { sort: "pra" }), /aria-sort="descending"><button type="button" data-box-sort="pra" class="on">/);
  assert.doesNotMatch(FL.boxScoreHtml(GAME, { open: false }), / open>/);
  assert.equal(FL.boxScoreHtml({ sport: "AFL", box: GAME.box }), "");
  assert.equal(FL.boxScoreHtml(Object.assign({}, GAME, { box: null })), "");
  assert.doesNotMatch(h, /target="_blank"|window\.open/);
});

test("box score escapes names", () => {
  const g = JSON.parse(JSON.stringify(GAME));
  g.box.home.players[0].name = "<img src=x onerror=alert(1)>";
  assert.doesNotMatch(FL.boxScoreHtml(g), /<img src=x/);
});

test("ESPN period keys count as live", () => {
  assert.equal(FL.gameIsLive({ phase: { key: "P3", label: "Q3 5:32" } }), true);
  assert.equal(FL.gameIsLive({ phase_label: "Q3 5:32" }), true);
  assert.equal(FL.gameIsLive({ concluded: true, phase: { key: "P4" } }), false);
});

test("venueFor: basketball gets the arena, AFL and unknown the MCG", () => {
  for (const g of [{ league: "nba" }, { league: "wnba" }, { sport: "NBL" }, { sport_kind: "basketball" }, "NBA", "basketball"]) {
    assert.equal(V.venueFor(g), "arena", JSON.stringify(g));
  }
  for (const g of [{ sport: "AFL" }, { sport: "AFLW" }, {}, null, "", "curling"]) {
    assert.equal(V.venueFor(g), "mcg", JSON.stringify(g));
  }
  assert.equal(V.moduleFor("arena"), "./assets/venues/arena.js");
  assert.equal(V.moduleFor("nope"), "./assets/mcg/mount.js");
  assert.equal(V.fallbackFor("arena"), "./assets/venues/arena-fallback.png");
});

test("arena cameras pass validCamera, stay inside the stands, reuse the chip ids", async () => {
  const C = await import("../assets/mcg/cameras.js");
  const A = await import("../assets/venues/arena.js");
  assert.deepEqual(A.ARENA_CAMERAS.map((c) => c.id), ["broadcast", "goals-north", "goals-south", "wing", "blimp"]);
  for (const c of A.ARENA_CAMERAS) {
    assert.ok(C.validCamera(c), c.id);
    assert.ok(Math.abs(c.pos[0]) < 26 && Math.abs(c.pos[2]) < 21 && c.pos[1] < 34, c.id + " inside the bowl");
  }
  assert.equal(C.camerasFor({ cameras: A.ARENA_CAMERAS }), A.ARENA_CAMERAS);
  assert.equal(C.cameraName("goals-north", A.ARENA_CHIPS), "Baseline");
  assert.equal(C.cameraName("blimp", A.ARENA_CHIPS), "Overhead");
  assert.match(C.cycleButtonHtml("wing", A.ARENA_CHIPS), /title="Change view: Wing"/);
  assert.equal(C.nextCameraInCycle("blimp", A.ARENA_CAMERAS), "broadcast");
  // MCG labels unchanged.
  assert.equal(C.cameraName("goals-north"), "North end");
  assert.equal(C.cameraName("blimp"), "Blimp");
  assert.equal(C.storageKeyFor("arena"), "tipdash_gv_cam:arena");
  assert.equal(C.storageKeyFor("mcg"), "tipdash_gv_cam");
  const s = memoryStorage({ tipdash_gv_cam: "blimp" });
  assert.equal(C.loadCameraChoice(s, A.ARENA_CAMERAS, "tipdash_gv_cam:arena"), "broadcast");
  C.saveCameraChoice(s, "wing", "tipdash_gv_cam:arena");
  assert.equal(s.getItem("tipdash_gv_cam"), "blimp");
  assert.equal(C.loadCameraChoice(s, A.ARENA_CAMERAS, "tipdash_gv_cam:arena"), "wing");
});

test("arena module: same handle contract, no controls, no player models, no league marks", () => {
  assert.match(arenaSrc, /from "\.\.\/vendor\/three\/three\.module\.min\.js"/);
  assert.doesNotMatch(arenaSrc, /OrbitControls|kits\.js|players\(|player-base/);
  assert.doesNotMatch(arenaSrc, /console\.|window\.open|target="_blank"/);
  // No league marks: the only images are the house LED slides and the still.
  assert.doesNotMatch(arenaSrc, /nba\.com|espncdn|logos?\/(nba|wnba|nbl)/i);
  assert.deepEqual((arenaSrc.match(/["'][^"']+\.(?:png|svg|jpg|webp)["']/g) || []), ['"./arena-fallback.png"']);
  // The handle itself is built by the shared kit.
  assert.match(arenaSrc, /mountVenue\(host, opts, DEF\)/);
  const kitSrc = fs.readFileSync(path.join(root, "assets/venues/kit.js"), "utf8");
  for (const k of ["fallback", "cameras", "cameraId", "setCamera", "resize", "setBoards", "setLogos", "celebrate", "stop"]) {
    assert.match(kitSrc, new RegExp("\\b" + k + "\\b"), k);
  }
  const png = fs.statSync(path.join(root, "assets/venues/arena-fallback.png"));
  assert.ok(png.size > 1000 && png.size <= 200 * 1024, "fallback still <= 200 KB");
});

test("Player animations: off by default, per device, reduced motion wins", () => {
  const s = memoryStorage();
  assert.equal(FL.animationsOn(s, ""), false);
  assert.equal(FL.animationsOn(null, ""), false);
  FL.setAnimations(s, "", true);
  assert.equal(s.getItem("tipdash_gv_anim"), "1");
  assert.equal(FL.animationsOn(s, ""), true);
  assert.equal(FL.animationsOn(s, "", true), false);
  FL.setAnimations(s, "", false);
  assert.equal(FL.animationsOn(s, ""), false);
  assert.equal(FL.animKey("77"), "tipdash_gv_anim:77");
  assert.equal(FL.animationsOn({ getItem() { throw new Error("private"); } }, ""), false);
});

test("shouldAnimate: setting on, a live game, and never basketball", () => {
  assert.equal(FL.shouldAnimate(false, true, { sport: "AFL" }), false);
  assert.equal(FL.shouldAnimate(true, false, { sport: "AFL" }), false);
  assert.equal(FL.shouldAnimate(true, true, { sport: "AFL" }), true);
  assert.equal(FL.shouldAnimate(true, true, null), true);
  assert.equal(FL.shouldAnimate(true, true, { league: "nba" }), false);
  assert.equal(FL.shouldAnimate(true, true, "NBL"), false);
});

test("index.html: settings toggle, gated overlay, venue mount, box host", () => {
  assert.match(html, /id="dd-gv-anim-on"/);
  assert.match(html, /FollowerLive\.shouldAnimate\(fliveAnimOn\(\), !!run, g\)/);
  assert.match(html, /<script src="\.\/assets\/venues\/select\.js\?v=__TD_VERSION__"><\/script>/);
  assert.match(html, /data-venue="'\+esc\(venue\)\+'"/);
  assert.match(html, /<div id="flive-boxhost"><\/div>/);
  assert.match(html, /function fliveSetVenue\(venue, remount\)/);
});
