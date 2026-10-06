/* Upcoming vs Finished split (tipdash 0.43.4).
 * A pending tip whose start is more than 4 h ago leaves Upcoming Bets and
 * sits under Finished games. The header counts must follow that split.
 * A date-only start (YYYY-MM-DD, no clock) is the end of that local day,
 * so a same-day tip is not treated as already finished.
 * Plain browser global (window.TBUpcoming) + CommonJS export for node --test.
 */
(function (root) {
  "use strict";
  var FOUR_H = 4 * 3600 * 1000;

  function tipStartTs(t) {
    var raw = t && (t.game_start || t.start_date || t.commence_time);
    if (!raw) return null;
    var s = String(raw).trim();
    if (/^\d{9,11}$/.test(s)) return +s;
    // Date only: no kickoff time was stored. Use the end of that local day
    // so the 4 h grace doesn't bury a game that is still on today's card.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      var p = s.split("-");
      var end = new Date(+p[0], +p[1] - 1, +p[2], 23, 59, 59);
      var endMs = end.getTime();
      return Number.isFinite(endMs) ? Math.floor(endMs / 1000) : null;
    }
    if (/^\d{4}-\d{2}-\d{2} \d/.test(s)) s = s.replace(" ", "T");
    var ms = Date.parse(s);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }

  function tipLooksFinished(t, starts, finished, now) {
    if (!t) return false;
    var clock = now == null ? Date.now() : now;
    var st = String(t.status || "").trim().toLowerCase();
    if (st === "settled" || st === "deleted") return true;
    if (t.result && /^(win|loss|push|void|won|lost)$/i.test(String(t.result).trim())) return true;
    if (t.finished || t.game_finished || t.ft || t.full_time) return true;
    var g = t.game_name || "";
    var info = starts && starts[g];
    if (info && !info.finished && !info.concluded && (info.live || (info.ts && info.ts * 1000 > clock))) return false;
    if (finished && finished[g]) return true;
    if (info && (info.finished || info.complete >= 100 || info.concluded)) return true;
    if (info && info.ts && !info.live) {
      if (clock - (info.ts * 1000) > FOUR_H) return true;
    }
    var tipTs = tipStartTs(t);
    if (tipTs && !(info && info.live)) {
      if (clock - (tipTs * 1000) > FOUR_H) return true;
    }
    return false;
  }

  function countGroups(groups) {
    var n = 0;
    Object.keys(groups || {}).forEach(function (k) { n += (groups[k] || []).length; });
    return n;
  }

  function upcomingSum(n) { return (Number(n) || 0) + " upcoming"; }
  function finishedSum(n) {
    n = Number(n) || 0;
    return n > 0 ? (n + " to settle") : "";
  }
  function upcomingEmpty(finN) {
    finN = Number(finN) || 0;
    if (!finN) return "No upcoming bets. Build one with \uFF0B Build a tip.";
    return "No upcoming bets — " + finN + " finished tip" + (finN === 1 ? "" : "s") + " waiting to be graded (see Finished games).";
  }

  function splitGroups(queued, starts, finished, now) {
    var up = {}, fin = {};
    (queued || []).forEach(function (t) {
      var k = (t && t.game_name) || "Other";
      var bag = tipLooksFinished(t, starts || {}, finished || {}, now) ? fin : up;
      (bag[k] = bag[k] || []).push(t);
    });
    var upN = countGroups(up), finN = countGroups(fin);
    return {
      upcoming: up, finished: fin, upcomingCount: upN, finishedCount: finN,
      upcomingSum: upcomingSum(upN), finishedSum: finishedSum(finN), upcomingEmpty: upcomingEmpty(finN)
    };
  }

  var api = {
    tipStartTs: tipStartTs, tipLooksFinished: tipLooksFinished, splitGroups: splitGroups,
    upcomingSum: upcomingSum, finishedSum: finishedSum, upcomingEmpty: upcomingEmpty
  };
  root.TBUpcoming = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
