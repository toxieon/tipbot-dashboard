const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const FL = require("../assets/follower-live.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("pending, hit and miss cards match the approved states", () => {
  const payload = {
    game: {
      game_name: "Northside v Bayside",
      live: true,
      phase_label: "Q3 · 12:41",
      venue: "MCG",
      home: {name: "Northside", score: 64},
      away: {name: "Bayside", score: 58}
    },
    tipsters: [{
      user_id: "1",
      name: "Midfield Mick",
      avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
      legs: [
        {id: "a", player: "Z. Quill", line_label: "25+ disposals", odds: 2.1, current: 18, line: 25, status: "pending"},
        {id: "b", player: "R. Okonbo", line_label: "2+ goals", odds: 3.4, current: 2, line: 2, status: "hit"},
        {id: "c", player: "L. Pembry", line_label: "1+ goal", odds: 1.85, current: 0, line: 1, status: "miss"}
      ]
    }]
  };
  const out = FL.render(payload);
  assert.match(out, /fl-card pending/);
  assert.match(out, /fl-card hit/);
  assert.match(out, /fl-card miss/);
  assert.match(out, />Live</);
  assert.match(out, />Hit</);
  assert.match(out, />Missed</);
  assert.match(out, /Midfield Mick/);
  assert.match(out, /3 legs/);
  assert.match(out, /2\.10/);
  assert.match(out, /18\/25/);
  assert.match(out, /width:72\.0%/);
  assert.match(out, /width:100\.0%/);
  assert.match(out, />Now</);
  assert.match(out, />Final</);
  assert.match(out, /cdn\.discordapp\.com/);
  assert.equal(FL.summaryText(payload), "3 legs · 1 live");
  const score = FL.scoreHtml(payload.game);
  assert.match(score, /Northside/);
  assert.match(score, />64</);
  assert.match(score, /Q3 · 12:41/);
  assert.match(score, /MCG/);
});

test("two tipsters stay in separate groups and a narrow grid is one column in CSS", () => {
  const payload = {
    tipsters: [
      {name: "Midfield Mick", legs: [{id: "1", player: "A", line_label: "line", odds: 1.5, current: 1, line: 2, status: "pending"}]},
      {name: "Tag Team Tess", legs: [{id: "2", player: "B", line_label: "line", odds: 2, current: 0, line: 1, status: "dead"}]}
    ]
  };
  const out = FL.render(payload);
  assert.equal((out.match(/class="fl-tip"/g) || []).length, 2);
  assert.match(out, /fl-card miss/);
  assert.match(html, /\.fl-grid\{display:grid;grid-template-columns:1fr 1fr/);
  assert.match(html, /@media \(max-width:340px\)\{\.fl-grid\{grid-template-columns:1fr\}\}/);
});

test("a win animation is only for a leg that just hit", () => {
  const legs = [
    {id: "a", status: "pending"},
    {id: "b", status: "hit"}
  ];
  const first = FL.remember({}, legs);
  assert.deepEqual(FL.newlyHit({}, legs), []);
  assert.deepEqual(FL.newlyHit(first, legs), []);
  const next = [
    {id: "a", status: "hit"},
    {id: "b", status: "hit"},
    {id: "c", status: "hit"}
  ];
  assert.deepEqual(FL.newlyHit(first, next), ["a"]);
});

test("the game opens in the app from Upcoming, Live tips, and followed bets", () => {
  assert.equal(FL.routeHash("9", "Northside v Bayside"), "#/s/9/game/Northside%20v%20Bayside");
  assert.equal(FL.endpoint("9", "Northside v Bayside"), "/api/follower/game?guild_id=9&game=Northside%20v%20Bayside");
  assert.match(html, /if\(m\[2\]==="game" && m\[3\]\) return openFollowerGame\(gid,nm,decodeURIComponent\(m\[3\]\)\), true;/);
  assert.match(html, /id="flive"/);
  assert.match(html, /"flive"/);
  assert.match(html, /class="flive-open"/);
  assert.match(html, /function openFollowerGame\(/);
  assert.match(html, /TBMatchFx\.win/);
  assert.match(html, /assets\/mcg\/mount\.js/);
  assert.doesNotMatch(html.slice(html.indexOf("function openFollowerGame")), /window\.open|target="_blank"/);
  const live = fs.readFileSync(path.join(__dirname, "..", "live", "index.html"), "utf8");
  assert.match(live, /flive-jump/);
  assert.doesNotMatch(live, /target="_blank"|window\.open/);
});

test("demo clock starts pending, mixes states, then settles", () => {
  const start = FL.demoPayload(0);
  const mid = FL.demoPayload(0.5);
  const end = FL.demoPayload(1);
  assert.equal(start.game.phase_label, "Q1 · 4:20");
  assert.equal(start.game.live, true);
  assert.equal(FL.summaryText(start), "6 legs · 6 live");
  assert.equal(mid.game.home.score, 64);
  assert.equal(mid.game.away.score, 58);
  assert.equal(mid.game.phase_label, "Q3 · 12:41");
  assert.equal(mid.game.venue, "MCG");
  assert.equal(FL.summaryText(mid), "6 legs · 3 live");
  const midHtml = FL.render(mid);
  assert.match(midHtml, /MidfieldMick/);
  assert.match(midHtml, /fl-card pending/);
  assert.match(midHtml, /fl-card hit/);
  assert.match(midHtml, /fl-card miss/);
  assert.match(midHtml, /18\/25/);
  assert.match(midHtml, /2\/2/);
  assert.match(midHtml, /0\/1/);
  assert.match(midHtml, /class="fl-rule"/);
  assert.equal(end.game.concluded, true);
  assert.equal(end.game.live, false);
  assert.equal(end.game.phase_label, "Final");
  assert.equal(FL.summaryText(end), "6 legs · 0 live");
  assert.equal(FL.initials("MidfieldMick"), "MM");
  assert.equal(FL.initials("TagTeamTess"), "TT");
  assert.equal(FL.initials("BehindThePosts"), "BP");
});

test("demo route and live banner stay inside the app", () => {
  assert.match(html, /m\[0\]==="demo" && m\[1\]==="game"\) return openFollowerDemo\(\), true;/);
  assert.match(html, /function openFollowerDemo\(\)\{\s*if\(!ownerSettingsAllowed\(\)\)/);
  assert.match(html, /id="livedemobtn"[^>]*hidden/);
  assert.match(html, /id="flivedemobtn"[^>]*hidden/);
  assert.match(html, /id="gameviewbtn"/);
  assert.match(html, /id="flgameviewbtn"/);
  assert.match(html, /function openGameView\(/);
  assert.match(html, /m\[0\]==="game" && m\.length===1\) return openGameView\(\), true;/);
  assert.match(html, /id="flive-scroll"/);
  assert.match(html, /class="fl-pin"/);
  assert.match(html, /#flive:not\(\[hidden\]\)\{position:fixed/);
  assert.match(html, /id="flive-play"/);
  assert.match(html, /id="flive-pause"/);
  assert.match(html, /id="flive-reset"/);
  assert.match(html, /id="live-now"/);
  assert.match(html, /function paintLiveNow\(/);
  assert.doesNotMatch(html, /window\.open|target="_blank"/);
  const rows = FL.liveNowGames([
    {game_name: "Carlton v Hawthorn", sport: "AFLW", concluded: false, phase: {key: "Q2", label: "Q2 · 8:10"}},
    {game_name: "Geelong v Carlton", sport: "AFL", concluded: true, phase: {label: "Full time"}},
    {game_name: "Carlton v Hawthorn", sport: "AFLW"}
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sport, "AFLW");
  const banner = FL.liveNowHtml(rows);
  assert.match(banner, /LIVE NOW:/);
  assert.match(banner, /Carlton v Hawthorn, tap to follow your bets/);
  assert.match(banner, /class="live-now"/);
  assert.doesNotMatch(banner, /target=|window\.open/);
  const mount = fs.readFileSync(path.join(__dirname, "..", "assets", "mcg", "mount.js"), "utf8");
  assert.match(mount, /fallback\.png/);
  assert.match(mount, /webglcontextlost/);
  assert.match(mount, /MeshoptDecoder\.ready/);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "assets", "mcg", "fallback.png")), true);
});

test("game view keeps the next open game and groups that follower's slips", () => {
  const packs = [{
    guild_id: "9",
    feed: [
      {tip_id: "later", game_name: "Richmond v Essendon", bet_type: "A Player 10+ disposals", odds: 1.9, result: "Pending", starts_at: "2026-10-20T05:00:00Z", tipster_name: "Midfield Mick"},
      {tip_id: "soon", game_name: "North Melbourne v Carlton", bet_type: "Z. Quill 25+ disposals", odds: 2.1, result: "Pending", starts_at: "2026-10-16T05:00:00Z", tipster_name: "Midfield Mick", tipster_id: "mick"},
      {tip_id: "soon2", game_name: "North Melbourne v Carlton", bet_type: "R. Okonbo 2+ goals", odds: 3.4, result: "Pending", starts_at: "2026-10-16T05:00:00Z", tipster_name: "Tag Team Tess", tipster_id: "tess"},
      {tip_id: "done", game_name: "North Melbourne v Carlton", bet_type: "settled", odds: 1.5, status: "Settled", result: "Win", tipster_name: "Tag Team Tess"},
      {tip_id: "ft", game_name: "Sydney v Brisbane", bet_type: "full time", result: "Pending", phase_label: "Full time", tipster_name: "Midfield Mick"},
      {tip_id: "live", game_name: "Geelong v Collingwood", bet_type: "H. Strand 20+ disposals", odds: 1.6, result: "Pending", live: true, tipster_name: "Midfield Mick"}
    ]
  }, {
    preview: true,
    guild_id: "1",
    feed: [{tip_id: "preview", game_name: "Preview v Only", bet_type: "nope", result: "Pending", tipster_name: "Nope"}]
  }];
  const games = FL.gamesFromFeeds(packs);
  assert.deepEqual(games.map((g) => g.game_name), ["Geelong v Collingwood", "North Melbourne v Carlton", "Richmond v Essendon"]);
  assert.equal(games[0].live, true);
  assert.equal(games[1].payload.tipsters.length, 2);
  assert.equal(games[1].payload.tipsters[0].legs.length, 1);
  assert.match(FL.render(games[1].payload), /Midfield Mick/);
  assert.match(FL.render(games[1].payload), /Tag Team Tess/);
  assert.doesNotMatch(FL.render(games[1].payload), /settled|full time|Preview/);
  const tabs = FL.switcherHtml(games, games[1].key);
  assert.match(tabs, /role="tab"/);
  assert.match(tabs, /North Melbourne v Carlton/);
  assert.match(tabs, /aria-selected="true"/);
  assert.equal(FL.switcherHtml([games[0]], games[0].key), "");
  assert.doesNotMatch(tabs, /target=|window\.open/);
  const empty = FL.emptyStateHtml();
  assert.match(empty, /Nothing coming up/);
  assert.match(empty, /upcoming or live game/);
  assert.match(FL.scoreHtml(FL.emptyBoardGame()), /No game on/);
  const merged = FL.mergeGamePayload(games[1].payload, [{
    game: {game_name: "North Melbourne v Carlton", live: true, phase_label: "Q2 · 8:10", venue: "Ikon Park", home: {name: "North Melbourne", score: 28}, away: {name: "Carlton", score: 22}},
    tipsters: [{name: "Midfield Mick", legs: [{id: "a", player: "Z. Quill", line_label: "25+ disposals", odds: 2.1, current: 8, line: 25, status: "pending"}]}]
  }]);
  assert.equal(merged.game.phase_label, "Q2 · 8:10");
  assert.equal(merged.tipsters[0].legs[0].player, "Z. Quill");
});

test("a missing read falls back to the follower feed for that game", () => {
  const model = FL.fallbackFromFeed({
    feed: [
      {tip_id: "t1", game_name: "Northside v Bayside", bet_type: "Z. Quill 25+", odds: 2.1, result: "Pending"},
      {tip_id: "t2", game_name: "Other v Game", bet_type: "nope", odds: 1.5, result: "Win"}
    ]
  }, "Northside v Bayside");
  assert.equal(model.stale, true);
  assert.equal(model.tipsters.length, 1);
  assert.equal(model.tipsters[0].legs.length, 1);
  assert.equal(model.tipsters[0].legs[0].status, "pending");
  assert.match(model.note, /latest TipBot deploy/);
});
