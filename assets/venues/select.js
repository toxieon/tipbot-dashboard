/* Which Game view ground to load for a game. Pure, no DOM; works as an ES module in
   the page and through require() in node --test (a plain script with a global too). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBVenues = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var BASKETBALL = {nba: 1, wnba: 1, nbl: 1, basketball: 1};
  var MODULES = {mcg: "./assets/mcg/mount.js", arena: "./assets/venues/arena.js"};
  var FALLBACKS = {mcg: "./assets/mcg/fallback.png", arena: "./assets/venues/arena-fallback.png"};

  function key(v) {
    return String(v == null ? "" : v).trim().toLowerCase();
  }

  /** "arena" for NBA/WNBA/NBL/basketball, "mcg" for everything else (AFL, AFLW,
      unknown or empty). Reads league, sport_kind, sport, comp, or a plain string. */
  function venueFor(game) {
    if (game == null) return "mcg";
    if (typeof game === "string") return BASKETBALL[key(game)] ? "arena" : "mcg";
    var fields = [game.sport_kind, game.league, game.sport, game.comp];
    for (var i = 0; i < fields.length; i++) {
      if (BASKETBALL[key(fields[i])]) return "arena";
    }
    return "mcg";
  }

  function moduleFor(venue) {
    return MODULES[venue] || MODULES.mcg;
  }

  function fallbackFor(venue) {
    return FALLBACKS[venue] || FALLBACKS.mcg;
  }

  return {venueFor: venueFor, moduleFor: moduleFor, fallbackFor: fallbackFor};
});
