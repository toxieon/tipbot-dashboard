/* light-data.js (tipdash 0.41.2, TipBot Phase 3 6.1c): the lighter server page and builder.
 *
 * - The server page (/api/server) no longer carries live/FT prop counts. They load
 *   after the page paints from /api/server/prop-counts and are merged into the
 *   tips here (mergePropCounts).
 * - The builder's games list asks for /api/fixtures?rosters=0 (no players) and
 *   fetches the picked game's players from /api/fixtures/roster?game= (loadRoster).
 *   An older TipBot ignores ?rosters=0 (players already there) or 404s the roster
 *   endpoint (falls back to the full /api/fixtures payload).
 *
 * Plain script (window.TBLight) and CommonJS (tests: node --test tests/).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBLight = api;
}(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  var COUNT_KEYS = ["current", "emoji", "status", "line", "side"];

  /* counts = {tips: {tip_id: [ {current, emoji, status, line, side} | {} per leg ]}}.
   * Copies those fields onto detail.tips.queued/settled legs (by position). Returns
   * how many legs changed. Never removes anything already on a leg. */
  function mergePropCounts(detail, counts) {
    var byTip = counts && counts.tips;
    var tips = detail && detail.tips;
    if (!byTip || !tips) return 0;
    var changed = 0;
    ["queued", "settled"].forEach(function (k) {
      (tips[k] || []).forEach(function (tip) {
        var legs = byTip[String(tip && tip.tip_id)];
        if (!legs || !Array.isArray(tip.legs)) return;
        legs.forEach(function (c, i) {
          var leg = tip.legs[i];
          if (!leg || !c || typeof c !== "object") return;
          var any = false;
          COUNT_KEYS.forEach(function (key) {
            if (c[key] !== undefined && c[key] !== null && leg[key] !== c[key]) { leg[key] = c[key]; any = true; }
          });
          if (any) changed += 1;
        });
      });
    });
    return changed;
  }

  function sideEmpty(t) {
    return !t || typeof t !== "object" ||
      (!(t.players || []).length && !(t.ins || []).length && !(t.outs || []).length);
  }
  /* True when a game from /api/fixtures?rosters=0 still needs its players. */
  function needsRoster(game) {
    return !!game && !game._rosterLoaded && sideEmpty(game.hteam) && sideEmpty(game.ateam);
  }
  function applyRoster(game, roster) {
    ["hteam", "ateam"].forEach(function (k) {
      var src = roster && roster[k];
      if (!src || typeof src !== "object") return;
      if (!game[k] || typeof game[k] !== "object") game[k] = {};
      game[k].players = Array.isArray(src.players) ? src.players : [];
      game[k].ins = Array.isArray(src.ins) ? src.ins : [];
      game[k].outs = Array.isArray(src.outs) ? src.outs : [];
    });
    game._rosterLoaded = true;
    return game;
  }
  function sameGame(a, b) {
    if (!a || !b) return false;
    return (a.id != null && String(a.id) === String(b.id)) ||
      (!!a.aflMatchId && String(a.aflMatchId) === String(b.aflMatchId));
  }

  /* getJson(url) -> Promise<{ok, status, data}> (index.html's sharedGet shape).
   * Resolves "roster" | "full" | "none" | "skip". Throws only {unauth}. */
  function loadRoster(game, getJson) {
    if (!needsRoster(game)) return Promise.resolve("skip");
    var id = game.id != null ? game.id : game.aflMatchId;
    return Promise.resolve(getJson("/api/fixtures/roster?game=" + encodeURIComponent(String(id))))
      .then(function (r) {
        if (r && r.ok && r.data) { applyRoster(game, r.data); return "roster"; }
        return fallback();
      }, function (e) {
        if (e && e.unauth) throw e;
        return fallback();
      });
    function fallback() {
      return Promise.resolve(getJson("/api/fixtures")).then(function (r) {
        var games = r && r.ok && r.data && r.data.games || [];
        for (var i = 0; i < games.length; i++) {
          if (sameGame(games[i], game)) { applyRoster(game, games[i]); return "full"; }
        }
        return "none";
      }, function (e) {
        if (e && e.unauth) throw e;
        return "none";
      });
    }
  }

  return { mergePropCounts: mergePropCounts, needsRoster: needsRoster, applyRoster: applyRoster,
           loadRoster: loadRoster, FIXTURES_LEAN: "/api/fixtures?rosters=0" };
}));
