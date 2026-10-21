const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const FL = require("../assets/follower-live.js");
const V = require("../assets/venues/select.js");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function store() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }, m };
}

test("remembers the last game and its ground", () => {
  const s = store(); const mem = FL.createGameMemory(s, V.isVenue);
  assert.equal(mem.get(), null);
  mem.set("nba:okc-sa", "arena");
  assert.deepEqual(mem.get(), { key: "nba:okc-sa", venue: "arena" });
  mem.set("afl:gf", "mcg");
  assert.deepEqual(FL.createGameMemory(s, V.isVenue).get(), { key: "afl:gf", venue: "mcg" });
});

test("bad or unknown memory falls back cleanly", () => {
  const s = store();
  s.setItem(FL.GAME_MEMORY_KEY, "{not json");
  assert.equal(FL.createGameMemory(s, V.isVenue).get(), null);
  s.setItem(FL.GAME_MEMORY_KEY, JSON.stringify({ key: "x", venue: "moon-base" }));
  assert.deepEqual(FL.createGameMemory(s, V.isVenue).get(), { key: "x", venue: "" });
  assert.equal(FL.createGameMemory(null, V.isVenue).get(), null);
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const mem = FL.createGameMemory(throwing, V.isVenue);
  assert.equal(mem.get(), null);
  mem.set("k", "mcg");   // no throw
});

test("opens the remembered game if it is still on, else the first", () => {
  const games = [{ key: "a" }, { key: "b" }];
  assert.equal(FL.pickGameIndex(games, "b"), 1);
  assert.equal(FL.pickGameIndex(games, "gone"), 0);
  assert.equal(FL.pickGameIndex(games, ""), 0);
});

test("venues are extensible and validated", () => {
  assert.ok(V.isVenue("mcg") && V.isVenue("arena"));
  assert.ok(!V.isVenue("moon-base"));
});

test("Game view wires the memory on open and on paint", () => {
  assert.match(html, /const mem=window\.FollowerLive&&FollowerLive\.createGameMemory\?fliveMemory\(\)\.get\(\):null;/);
  assert.match(html, /if\(mem\.venue\) FLIVE\.venue=mem\.venue;/);
  assert.match(html, /fliveMemory\(\)\.set\(key, FLIVE\.venue\)/);
  assert.match(html, /FollowerLive\.pickGameIndex\(games, FLIVE\.gameKey\)/);
});

test("feed-built games keep a sport hint so the ground can follow them", () => {
  const FL = require("../assets/follower-live.js");
  const games = FL.gamesFromFeeds([{ guild_id: "9", feed: [
    { tip_id: "b", game_name: "Hawks @ Owls", bet_type: "Y 25+ points", sport: "NBA", odds: 2, result: "Pending", starts_at: "2099-01-01T00:00:00Z" },
  ] }]);
  assert.equal(games[0].payload.game.sport, "NBA");
  const merged = FL.mergeGamePayload(games[0].payload, [{ game: { game_name: "Hawks @ Owls" }, tipsters: [] }]);
  assert.equal(merged.game.sport, "NBA");
  assert.equal(FL.mergeGamePayload(games[0].payload, []).game.sport, "NBA");
});
