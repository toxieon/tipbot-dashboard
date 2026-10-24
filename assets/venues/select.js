/* Which Game view ground to load for a game. Pure, no DOM; works as an ES module in
   the page and through require() in node --test (a plain script with a global too). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBVenues = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  // Exact names (league codes, sport labels, sport_kind) to a ground. Cricket plays
  // on the MCG itself, so it keeps the MCG model.
  var NAMES = {
    nba: "arena", wnba: "arena", nbl: "arena", basketball: "arena",
    nfl: "nfl", football: "nfl", "american football": "nfl", "college-football": "nfl", ncaaf: "nfl",
    mlb: "baseball", baseball: "baseball",
    soccer: "soccer", epl: "soccer", "a-league": "soccer", "a-league men": "soccer", "a-league women": "soccer", mls: "soccer",
    nrl: "nrl", nrlw: "nrl", "rugby league": "nrl", "state of origin": "nrl",
    racing: "racecourse", horse: "racecourse", "horse racing": "racecourse", horses: "racecourse",
    thoroughbred: "racecourse", harness: "racecourse", greyhound: "racecourse", greyhounds: "racecourse",
    tennis: "tennis", atp: "tennis", wta: "tennis",
    cricket: "mcg", bbl: "mcg", wbbl: "mcg", afl: "mcg", aflw: "mcg"
  };
  // ESPN soccer league codes: "eng.1", "aus.1", "uefa.champions", "fifa.world" ...
  var SOCCER_CODE = /^(?:[a-z]{3}\.[0-9a-z_.]+|uefa\.[a-z_.]+|fifa\.[a-z_.]+|conmebol\.[a-z_.]+|concacaf\.[a-z_.]+)$/;
  var MODULES = {
    mcg: "./assets/mcg/mount.js",
    arena: "./assets/venues/arena.js",
    soccer: "./assets/venues/soccer.js",
    nfl: "./assets/venues/nfl.js",
    baseball: "./assets/venues/baseball.js",
    nrl: "./assets/venues/nrl.js",
    racecourse: "./assets/venues/racecourse.js",
    tennis: "./assets/venues/tennis.js"
  };
  var FALLBACKS = {mcg: "./assets/mcg/fallback.png"};
  Object.keys(MODULES).forEach(function (v) { if (v !== "mcg") FALLBACKS[v] = "./assets/venues/" + v + "-fallback.png"; });

  function key(v) {
    return String(v == null ? "" : v).trim().toLowerCase();
  }

  function nameVenue(v) {
    var k = key(v);
    if (!k) return "";
    if (Object.prototype.hasOwnProperty.call(NAMES, k)) return NAMES[k];
    return SOCCER_CODE.test(k) ? "soccer" : "";
  }

  /** The ground for a game: arena (basketball), nfl, baseball, soccer, nrl,
      racecourse, tennis, or mcg for AFL, cricket and anything unknown or empty.
      Reads sport_kind, league, sport, comp, or a plain string. */
  function venueFor(game) {
    if (game == null) return "mcg";
    if (typeof game === "string") return nameVenue(game) || "mcg";
    var fields = [game.sport_kind, game.league, game.sport, game.comp];
    for (var i = 0; i < fields.length; i++) {
      var v = nameVenue(fields[i]);
      if (v) return v;
    }
    return "mcg";
  }

  function moduleFor(venue) {
    return MODULES[venue] || MODULES.mcg;
  }

  function fallbackFor(venue) {
    return FALLBACKS[venue] || FALLBACKS.mcg;
  }

  /** True for a ground this build can load (new venues just add a module). */
  function isVenue(venue) {
    return Object.prototype.hasOwnProperty.call(MODULES, key(venue));
  }

  return {venueFor: venueFor, moduleFor: moduleFor, fallbackFor: fallbackFor, isVenue: isVenue,
    VENUES: Object.keys(MODULES)};
});
