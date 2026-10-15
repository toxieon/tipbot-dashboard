/* Follower live game: only the bets this person holds on one game.
   window.FollowerLive + CommonJS for node --test.
   Cards: pending (purple), hit (green), miss (red), with a bar toward the line.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FollowerLive = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var POLL_MS = 30000;
  var COLORS = ["#5b8cff", "#e0a04a", "#2eaf62", "#8b6cff", "#e5595f", "#3aa0a8"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function num(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function norm(s) {
    return String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
  }

  function statusOf(raw) {
    var s = String(raw == null ? "" : raw).trim().toLowerCase();
    if (s === "hit" || s === "win" || s === "won") return "hit";
    if (s === "miss" || s === "dead" || s === "loss" || s === "lost") return "miss";
    return "pending";
  }

  function statusLabel(status) {
    if (status === "hit") return "Hit";
    if (status === "miss") return "Missed";
    return "Live";
  }

  function progressPct(current, line) {
    var c = num(current);
    var l = num(line);
    if (c == null) c = 0;
    if (l == null || l <= 0) return c > 0 ? 100 : 0;
    return Math.max(0, Math.min(100, (c / l) * 100));
  }

  function fmtOdds(v) {
    var n = num(v);
    if (n == null) {
      var s = String(v == null ? "" : v).trim();
      return s;
    }
    return n.toFixed(2);
  }

  function fmtCount(v) {
    var n = num(v);
    if (n == null) return "–";
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return String(Math.round(n * 10) / 10);
  }

  function initials(name) {
    var parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    var a = (parts[0] || "?")[0] || "?";
    var b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }

  function colorFor(name) {
    var s = String(name || "");
    var h = 0;
    var i;
    for (i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
    return COLORS[h % COLORS.length];
  }

  function endpoint(guildId, game) {
    return "/api/follower/game?guild_id=" + encodeURIComponent(guildId) + "&game=" + encodeURIComponent(game);
  }

  function routeHash(guildId, game) {
    return "#/s/" + encodeURIComponent(guildId) + "/game/" + encodeURIComponent(game);
  }

  function flatLegs(payload) {
    var out = [];
    var groups = (payload && payload.tipsters) || [];
    groups.forEach(function (g) {
      (g.legs || []).forEach(function (leg) { out.push(leg); });
    });
    return out;
  }

  function newlyHit(prev, legs) {
    var out = [];
    (legs || []).forEach(function (leg) {
      var id = leg && leg.id != null ? String(leg.id) : "";
      if (!id) return;
      var st = statusOf(leg.status);
      var before = prev ? prev[id] : undefined;
      if (st === "hit" && before && before !== "hit") out.push(id);
    });
    return out;
  }

  function remember(prev, legs) {
    var next = {};
    (legs || []).forEach(function (leg) {
      var id = leg && leg.id != null ? String(leg.id) : "";
      if (id) next[id] = statusOf(leg.status);
    });
    return next;
  }

  function counts(payload) {
    var legs = flatLegs(payload);
    var live = 0;
    legs.forEach(function (leg) { if (statusOf(leg.status) === "pending") live++; });
    return {legs: legs.length, live: live};
  }

  function summaryText(payload) {
    var c = counts(payload);
    if (!c.legs) return "";
    return c.legs + " leg" + (c.legs === 1 ? "" : "s") + " · " + c.live + " live";
  }

  function cardHtml(leg) {
    var st = statusOf(leg && leg.status);
    var pct = progressPct(leg && leg.current, leg && leg.line);
    var odds = fmtOdds(leg && leg.odds);
    var nowLabel = st === "pending" ? "Now" : "Final";
    var cur = fmtCount(leg && leg.current);
    var line = fmtCount(leg && leg.line);
    var id = leg && leg.id != null ? String(leg.id) : "";
    return '<article class="fl-card ' + st + '" data-leg="' + esc(id) + '" data-status="' + st + '">'
      + '<div class="fl-top"><span class="fl-st">' + statusLabel(st) + "</span>"
      + (odds ? '<span class="fl-odds">' + esc(odds) + "</span>" : "<span></span>")
      + "</div>"
      + '<div class="fl-leg">' + esc(leg && leg.player || "Selection")
      + "<small>" + esc(leg && leg.line_label || "") + "</small></div>"
      + '<div class="fl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'
      + esc(String(Math.round(pct))) + '" aria-label="' + esc((leg && leg.player || "Selection") + " " + cur + " of " + line) + '">'
      + '<i style="width:' + pct.toFixed(1) + '%"></i></div>'
      + '<div class="fl-prog"><span>' + nowLabel + "</span><b>" + esc(cur) + "/" + esc(line) + "</b></div>"
      + "</article>";
  }

  function tipsterHtml(group) {
    var name = (group && group.name) || "Tipster";
    var n = (group && group.legs && group.legs.length) || 0;
    var ini = initials(name);
    var col = colorFor(name);
    var av = '<div class="fl-av" style="background:' + col + '" aria-hidden="true">' + esc(ini);
    if (group && group.avatar) {
      av += '<img src="' + esc(group.avatar) + '" alt="" data-ini="' + esc(ini) + '" onerror="this.remove()">';
    }
    av += "</div>";
    var cards = (group.legs || []).map(cardHtml).join("");
    return '<div class="fl-tip">' + av + "<b>" + esc(name) + "</b><em>" + n + " leg" + (n === 1 ? "" : "s") + "</em></div>" + cards;
  }

  function render(payload) {
    var groups = (payload && payload.tipsters) || [];
    if (!groups.length) return '<div class="empty">No bets on this game yet.</div>';
    return groups.map(tipsterHtml).join("");
  }

  function scoreHtml(game) {
    game = game || {};
    var home = game.home || {};
    var away = game.away || {};
    var phase = game.phase_label || (game.concluded ? "Final" : (game.live ? "Live" : "Upcoming"));
    var venue = game.venue || "";
    function side(team, right) {
      var sc = team.score == null || team.score === "" ? "–" : String(team.score);
      return '<div class="fl-team"' + (right ? ' style="text-align:right"' : "") + "><span>"
        + esc(team.name || "") + "</span><b>" + esc(sc) + "</b></div>";
    }
    return side(home, false)
      + '<div class="fl-clock"><b>' + esc(phase) + "</b>" + esc(venue) + "</div>"
      + side(away, true);
  }

  function legFromTip(tip) {
    var result = String((tip && (tip.result || tip.follow_result || tip.tip_result)) || "").toLowerCase();
    var st = "pending";
    if (result === "win") st = "hit";
    else if (result === "loss") st = "miss";
    var label = (tip && (tip.bet_type || tip.display_id)) || "Bet";
    return {
      id: "tip:" + String(tip && tip.tip_id != null ? tip.tip_id : label),
      tip_id: tip && tip.tip_id,
      player: label,
      line_label: (tip && tip.game_name) || "",
      odds: tip && tip.odds,
      current: null,
      line: null,
      status: st
    };
  }

  function fallbackFromFeed(overview, game) {
    var want = norm(game);
    var feed = ((overview && overview.feed) || []).filter(function (t) {
      return norm(t && t.game_name) === want;
    });
    var by = {};
    var order = [];
    feed.forEach(function (t) {
      var key = String(t.tipster_id || t.created_by || t.tipster || "you");
      if (!by[key]) {
        by[key] = {
          user_id: key,
          name: t.tipster_name || t.tipster || "Your tips",
          avatar: t.tipster_avatar || t.avatar || "",
          legs: []
        };
        order.push(key);
      }
      by[key].legs.push(legFromTip(t));
    });
    return {
      ok: true,
      stale: true,
      note: "Live progress needs the latest TipBot deploy.",
      game: {game_name: game, live: false, concluded: false, phase_label: "Upcoming", home: {}, away: {}},
      tipsters: order.map(function (k) { return by[k]; }),
      refresh_after: 30
    };
  }

  return {
    POLL_MS: POLL_MS,
    esc: esc,
    statusOf: statusOf,
    statusLabel: statusLabel,
    progressPct: progressPct,
    fmtOdds: fmtOdds,
    endpoint: endpoint,
    routeHash: routeHash,
    flatLegs: flatLegs,
    newlyHit: newlyHit,
    remember: remember,
    summaryText: summaryText,
    render: render,
    scoreHtml: scoreHtml,
    fallbackFromFeed: fallbackFromFeed
  };
});
