/* Follower live game: only the bets this person holds on one game.
   window.FollowerLive + CommonJS for node --test.
   Cards: pending (purple), hit (green), miss (red), with a bar toward the line.
   A demo clock (#/demo/game) walks one scripted game from the opening bounce
   through mixed states to the final score. AFL and AFLW share this page.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FollowerLive = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var POLL_MS = 30000;
  var DEMO_MS = 22000;
  var COLORS = ["#6d5efc", "#e08a3a", "#2eaf62", "#5b8cff", "#e5595f", "#3aa0a8"];

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

  function statusLabel(status, upcoming) {
    if (status === "hit") return "Hit";
    if (status === "miss") return "Missed";
    if (upcoming) return "Upcoming";
    return "Live";
  }

  function gameStartMs(game) {
    if (!game) return null;
    var v = game.starts_at != null ? game.starts_at
      : (game.start_time != null ? game.start_time
      : (game.game_start != null ? game.game_start
      : (game.kickoff != null ? game.kickoff : game.commence_time)));
    if (v == null || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
    var n = Date.parse(v);
    return Number.isFinite(n) ? n : null;
  }

  function gameNotStarted(game, now) {
    game = game || {};
    if (game.concluded === true || game.concluded === 1 || game.concluded === "1") return false;
    var phase = String(game.phase_label || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (phase === "final" || phase === "full time" || phase === "ft") return false;
    var start = gameStartMs(game);
    var clock = now == null ? Date.now() : now;
    if (start != null && start > clock) return true;
    if (phase === "upcoming") return true;
    if (game.live === true) return false;
    return true;
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
    var raw = String(name || "?").trim();
    if (!raw) return "?";
    var parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      var words = raw.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])/g);
      if (words && words.length >= 2) parts = words;
    }
    if (parts.length >= 2) {
      return ((parts[0][0] || "?") + (parts[parts.length - 1][0] || "")).toUpperCase();
    }
    return (raw.slice(0, 2) || "?").toUpperCase();
  }

  function colorFor(name, explicit) {
    if (explicit) return String(explicit);
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
    var word = gameNotStarted(payload && payload.game) ? "upcoming" : "live";
    return c.legs + " leg" + (c.legs === 1 ? "" : "s") + " · " + c.live + " " + word;
  }

  function cardHtml(leg, game) {
    var st = statusOf(leg && leg.status);
    var upcoming = st === "pending" && gameNotStarted(game);
    var pct = progressPct(leg && leg.current, leg && leg.line);
    var odds = fmtOdds(leg && leg.odds);
    var nowLabel = st === "pending" ? "Now" : "Final";
    var cur = fmtCount(leg && leg.current);
    var line = fmtCount(leg && leg.line);
    var id = leg && leg.id != null ? String(leg.id) : "";
    var track = upcoming ? ""
      : '<div class="fl-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'
      + esc(String(Math.round(pct))) + '" aria-label="' + esc((leg && leg.player || "Selection") + " " + cur + " of " + line) + '">'
      + '<i style="width:' + pct.toFixed(1) + '%"></i></div>'
      + '<div class="fl-prog"><span>' + nowLabel + "</span><b>" + esc(cur) + "/" + esc(line) + "</b></div>";
    return '<article class="fl-card ' + st + '" data-leg="' + esc(id) + '" data-status="' + st + '">'
      + '<div class="fl-top"><span class="fl-st">' + statusLabel(st, upcoming) + "</span>"
      + (odds ? '<span class="fl-odds">' + esc(odds) + "</span>" : "<span></span>")
      + "</div>"
      + '<div class="fl-leg">' + esc(leg && leg.player || "Selection")
      + "<small>" + esc(leg && leg.line_label || "") + "</small></div>"
      + track
      + "</article>";
  }

  function tipsterHtml(group, game) {
    var name = (group && group.name) || "Tipster";
    var n = (group && group.legs && group.legs.length) || 0;
    var ini = initials(name);
    var col = colorFor(name, group && group.color);
    var av = '<div class="fl-av" style="background:' + esc(col) + '" aria-hidden="true">' + esc(ini);
    if (group && group.avatar) {
      av += '<img src="' + esc(group.avatar) + '" alt="" data-ini="' + esc(ini) + '" onerror="this.remove()">';
    }
    av += "</div>";
    var cards = (group.legs || []).map(function (leg) { return cardHtml(leg, game); }).join("");
    return '<section class="fl-group"><header class="fl-tip">' + av
      + "<b>" + esc(name) + '</b><span class="fl-rule" aria-hidden="true"></span><em>'
      + n + " leg" + (n === 1 ? "" : "s") + "</em></header>"
      + '<div class="fl-grid">' + cards + "</div></section>";
  }

  function render(payload) {
    var groups = (payload && payload.tipsters) || [];
    var game = payload && payload.game;
    if (!groups.length) return '<div class="empty">No bets on this game yet.</div>';
    return groups.map(function (group) { return tipsterHtml(group, game); }).join("");
  }

  function scoreHtml(game) {
    game = game || {};
    var home = game.home || {};
    var away = game.away || {};
    var phase = game.phase_label || (game.concluded ? "Final" : (game.live ? "Live" : "Upcoming"));
    var venue = game.venue || "";
    function side(team, right) {
      var sc = team.score == null || team.score === "" ? "–" : String(team.score);
      return '<div class="fl-team' + (right ? " fl-team-r" : "") + '"><span>'
        + esc(team.name || "") + "</span><b>" + esc(sc) + "</b></div>";
    }
    return side(home, false)
      + '<div class="fl-clock"><b>' + esc(phase) + "</b><span>" + esc(venue) + "</span></div>"
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

  function splitSides(name) {
    var raw = String(name || "").trim();
    var parts = raw.split(/\s+(?:vs|v)\s+/i);
    if (parts.length >= 2) return {home: parts[0].trim(), away: parts.slice(1).join(" v ").trim()};
    return {home: raw, away: ""};
  }

  function slipResult(tip) {
    return String((tip && (tip.result || tip.follow_result || tip.tip_result)) || "").trim().toLowerCase();
  }

  function slipStatus(tip) {
    return String((tip && (tip.tip_status || tip.status)) || "").trim().toLowerCase();
  }

  function slipSettled(tip) {
    if (!tip) return true;
    var result = slipResult(tip);
    var status = slipStatus(tip);
    if (result === "win" || result === "won" || result === "loss" || result === "lost" || result === "miss" || result === "push" || result === "void") return true;
    if (status === "settled" || status === "won" || status === "lost" || status === "win" || status === "loss" || status === "void" || status === "push") return true;
    if (tip.settled === true || tip.settled === 1) return true;
    if (tip.settled_at) return true;
    return false;
  }

  function slipOpen(tip) {
    return !slipSettled(tip);
  }

  function slipConcluded(tip) {
    if (!tip) return false;
    if (tip.concluded === true || tip.game_concluded === true) return true;
    var phase = tip.phase && typeof tip.phase === "object" ? tip.phase : {};
    return isFullTime({
      concluded: tip.concluded || tip.game_concluded,
      phase: phase,
      phase_key: tip.phase_key || tip.game_phase_key || phase.key,
      phase_label: tip.phase_label || tip.game_phase || phase.label || ""
    });
  }

  function slipLive(tip) {
    if (!tip || slipConcluded(tip)) return false;
    if (tip.live === true || tip.game_live === true) return true;
    var phase = tip.phase && typeof tip.phase === "object" ? tip.phase : null;
    var label = phase ? String(phase.label || phase.key || "") : String(tip.phase_label || tip.game_phase || tip.phase || "");
    if (!label || label === "[object Object]") return false;
    if (/full\s*time|^final$|^ft$/i.test(label)) return false;
    return /q[1-4]|live|quarter|half/i.test(label);
  }

  function slipStart(tip) {
    var v = tip && (tip.starts_at || tip.start_time || tip.game_start || tip.kickoff || tip.commence_time || tip.date_time);
    if (v == null || v === "") return null;
    if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;
    var n = Date.parse(v);
    return Number.isFinite(n) ? n : null;
  }

  function slipGameName(tip) {
    var name = String((tip && (tip.game_name || tip.event || tip.match_name || tip.fixture)) || "").replace(/\s+/g, " ").trim();
    if (name) return name;
    var legs = (tip && tip.legs) || [];
    var i;
    var n;
    for (i = 0; i < legs.length; i++) {
      n = String((legs[i] && (legs[i].event || legs[i].game_name || legs[i].game)) || "").replace(/\s+/g, " ").trim();
      if (n) return n;
    }
    return "";
  }

  function slipAhead(tip, now) {
    if (slipSettled(tip)) return false;
    var st = slipStart(tip);
    var clock = now == null ? Date.now() : now;
    return st != null && st > clock;
  }

  function gameIsLive(game) {
    if (!game || isFullTime(game)) return false;
    if (game.live === true || game.game_live === true) return true;
    var phase = game.phase && typeof game.phase === "object" ? game.phase : {};
    var key = String(phase.key || game.phase_key || game.phase || "").trim().toUpperCase();
    if (key === "Q1" || key === "Q2" || key === "Q3" || key === "Q4" || key === "LIVE") return true;
    var label = String(phase.label || game.phase_label || "");
    if (!label || /full\s*time|^final$|^ft$|^upcoming$/i.test(label)) return false;
    return /q[1-4]|quarter|\blive\b/i.test(label);
  }

  function payloadFromTips(game) {
    var sides = splitSides(game.game_name);
    var by = {};
    var order = [];
    (game.tips || []).forEach(function (t) {
      var key = String(t.tipster_id || t.created_by || t.user_id || t.tipster_name || t.tipster || "you");
      if (!by[key]) {
        by[key] = {
          user_id: key,
          name: t.tipster_name || t.tipster || "Your tips",
          avatar: t.tipster_avatar || t.avatar || "",
          color: t.color || "",
          legs: []
        };
        order.push(key);
      }
      by[key].legs.push(legFromTip(t));
    });
    return {
      ok: true,
      game: {
        game_name: game.game_name,
        live: !!game.live,
        concluded: false,
        phase_label: game.live ? "Live" : "Upcoming",
        venue: game.venue || "",
        home: {name: sides.home, score: null},
        away: {name: sides.away, score: null}
      },
      tipsters: order.map(function (k) { return by[k]; })
    };
  }

  function gamesFromFeeds(packs) {
    var byGame = {};
    var order = [];
    (packs || []).forEach(function (pack) {
      if (!pack || pack.sample) return;
      var gid = pack.guild_id != null ? String(pack.guild_id) : "";
      (pack.feed || []).forEach(function (tip) {
        if (!slipOpen(tip)) return;
        if (slipConcluded(tip) && !slipAhead(tip)) return;
        var name = slipGameName(tip);
        if (!name) return;
        var key = norm(name);
        if (!byGame[key]) {
          byGame[key] = {key: key, game_name: name, guild_ids: [], live: false, start: null, venue: "", tips: []};
          order.push(key);
        }
        var g = byGame[key];
        if (gid && g.guild_ids.indexOf(gid) < 0) g.guild_ids.push(gid);
        if (slipLive(tip)) g.live = true;
        var st = slipStart(tip);
        if (st != null && (g.start == null || st < g.start)) g.start = st;
        if (!g.venue && tip.venue) g.venue = String(tip.venue);
        g.tips.push(tip);
      });
    });
    var games = order.map(function (k) { return byGame[k]; });
    games.sort(function (a, b) {
      if (!!a.live !== !!b.live) return a.live ? -1 : 1;
      var as = a.start == null ? Infinity : a.start;
      var bs = b.start == null ? Infinity : b.start;
      if (as !== bs) return as - bs;
      return String(a.game_name).localeCompare(String(b.game_name));
    });
    return games.map(function (g) {
      return {
        key: g.key,
        game_name: g.game_name,
        guild_ids: g.guild_ids,
        live: !!g.live,
        start: g.start,
        payload: payloadFromTips(g)
      };
    });
  }

  function mergeGamePayload(fallback, reads) {
    var tipsters = [];
    var game = fallback && fallback.game;
    (reads || []).forEach(function (data) {
      if (!data) return;
      if (data.game) game = data.game;
      (data.tipsters || []).forEach(function (t) {
        if (t) tipsters.push(t);
      });
    });
    if (!tipsters.length) {
      if (game && fallback) return {ok: true, game: game, tipsters: fallback.tipsters || [], note: fallback.note};
      return fallback;
    }
    return {ok: true, game: game || (fallback && fallback.game) || {}, tipsters: tipsters};
  }

  function switcherHtml(games, activeKey) {
    if (!games || games.length < 2) return "";
    return games.map(function (g) {
      var on = g.key === activeKey;
      return '<button type="button" role="tab" data-key="' + esc(g.key) + '" aria-selected="' + (on ? "true" : "false") + '"' + (on ? ' class="on"' : "") + ">" + esc(g.game_name) + "</button>";
    }).join("");
  }

  function emptyBoardGame() {
    return {
      game_name: "",
      live: false,
      concluded: false,
      phase_label: "No game on",
      venue: "Follow a tip to see it here",
      home: {name: "", score: ""},
      away: {name: "", score: ""}
    };
  }

  function emptyStateHtml() {
    return '<div class="empty fl-empty"><b>Nothing coming up</b><span>When you follow a tip for an upcoming or live game, your bets show up here.</span></div>';
  }

  function playersShouldRun(games, game, anyLive) {
    if (anyLive) return true;
    if (gameIsLive(game)) return true;
    var i;
    var row;
    for (i = 0; i < (games || []).length; i++) {
      row = games[i];
      if (!row) continue;
      if (row.live || gameIsLive(row) || gameIsLive(row.payload && row.payload.game)) return true;
    }
    return false;
  }

  function upcomingNames(feed) {
    var seen = {};
    var out = [];
    (feed || []).forEach(function (tip) {
      if (!slipOpen(tip)) return;
      if (slipConcluded(tip) && !slipAhead(tip)) return;
      var name = slipGameName(tip);
      if (!name || seen[norm(name)]) return;
      seen[norm(name)] = true;
      out.push(name);
    });
    return out;
  }

  function isFullTime(game) {
    if (!game) return false;
    if (game.concluded === true || game.concluded === 1 || game.concluded === "1") return true;
    var phase = game.phase || {};
    var key = String(phase.key || game.phase_key || "").trim().toUpperCase();
    if (key === "FT" || key === "FULLTIME" || key === "FULL_TIME") return true;
    var label = String(phase.label || game.phase_label || "");
    return /full\s*time/i.test(label);
  }

  function liveNowGames(games) {
    var out = [];
    var seen = {};
    (games || []).forEach(function (g) {
      if (!g) return;
      var name = String(g.game_name || "").replace(/\s+/g, " ").trim();
      if (!name || seen[norm(name)]) return;
      if (isFullTime(g)) return;
      seen[norm(name)] = true;
      out.push({
        game_name: name,
        match_id: g.match_id || g.aflMatchId || "",
        sport: g.sport || g.comp || g.league || ""
      });
    });
    return out;
  }

  function liveNowHtml(games) {
    return liveNowGames(games).map(function (g) {
      return '<button type="button" class="live-now" data-game="' + esc(g.game_name) + '">'
        + '<i aria-hidden="true"></i>'
        + "<span><b>LIVE NOW:</b> " + esc(g.game_name) + ", tap to follow your bets</span>"
        + "</button>";
    }).join("");
  }

  function lerp(a, b, u) {
    return a + (b - a) * u;
  }

  function sampleAt(samples, t) {
    var i;
    var a = samples[0];
    for (i = 0; i < samples.length; i++) {
      if (samples[i].t <= t + 1e-9) a = samples[i];
      else break;
    }
    var b = samples[Math.min(i, samples.length - 1)];
    if (!b || b === a || b.t === a.t) return {c: a.c, s: a.s, phase: a.phase, home: a.home, away: a.away, live: a.live, concluded: a.concluded, venue: a.venue};
    var u = (t - a.t) / (b.t - a.t);
    return {
      c: lerp(a.c, b.c, u),
      s: a.s,
      home: lerp(a.home, b.home, u),
      away: lerp(a.away, b.away, u),
      phase: a.phase,
      live: a.live,
      concluded: a.concluded,
      venue: a.venue
    };
  }

  var DEMO_CLOCK = [
    {t: 0, home: 12, away: 8, phase: "Q1 · 4:20", venue: "MCG", live: true, concluded: false},
    {t: 0.5, home: 64, away: 58, phase: "Q3 · 12:41", venue: "MCG", live: true, concluded: false},
    {t: 1, home: 91, away: 74, phase: "Final", venue: "MCG", live: false, concluded: true}
  ];

  var DEMO_LEGS = [
    {id: "quill", player: "Z. Quill", line_label: "25+ disposals", odds: 2.1, line: 25, samples: [
      {t: 0, c: 6, s: "pending"}, {t: 0.5, c: 18, s: "pending"}, {t: 0.82, c: 25, s: "hit"}, {t: 1, c: 27, s: "hit"}
    ]},
    {id: "okonbo", player: "R. Okonbo", line_label: "2+ goals", odds: 3.4, line: 2, samples: [
      {t: 0, c: 0, s: "pending"}, {t: 0.22, c: 1, s: "pending"}, {t: 0.38, c: 2, s: "hit"}, {t: 0.5, c: 2, s: "hit"}, {t: 1, c: 3, s: "hit"}
    ]},
    {id: "varga", player: "T. Varga", line_label: "6+ tackles", odds: 2.55, line: 6, samples: [
      {t: 0, c: 1, s: "pending"}, {t: 0.5, c: 3, s: "pending"}, {t: 1, c: 4, s: "miss"}
    ]},
    {id: "pembry", player: "L. Pembry", line_label: "1+ goal", odds: 1.85, line: 1, samples: [
      {t: 0, c: 0, s: "pending"}, {t: 0.34, c: 0, s: "miss"}, {t: 0.5, c: 0, s: "miss"}, {t: 1, c: 0, s: "miss"}
    ]},
    {id: "strand", player: "H. Strand", line_label: "20+ disposals", odds: 1.6, line: 20, samples: [
      {t: 0, c: 8, s: "pending"}, {t: 0.4, c: 20, s: "hit"}, {t: 0.5, c: 21, s: "hit"}, {t: 1, c: 28, s: "hit"}
    ]},
    {id: "north-q3", player: "Northside", line_label: "4+ goals in Q3", odds: 3.25, line: 4, samples: [
      {t: 0, c: 0, s: "pending"}, {t: 0.5, c: 2, s: "pending"}, {t: 0.72, c: 4, s: "hit"}, {t: 1, c: 5, s: "hit"}
    ]}
  ];

  function roundStat(v) {
    return Math.round(v);
  }

  function demoPayload(t) {
    var time = Math.max(0, Math.min(1, Number(t) || 0));
    var clock = sampleAt(DEMO_CLOCK, time);
    var legs = DEMO_LEGS.map(function (leg) {
      var s = sampleAt(leg.samples, time);
      return {
        id: leg.id,
        player: leg.player,
        line_label: leg.line_label,
        odds: leg.odds,
        line: leg.line,
        current: roundStat(s.c),
        status: s.s
      };
    });
    return {
      ok: true,
      demo: true,
      game: {
        game_name: "Northside v Bayside",
        sport: "AFL",
        venue: clock.venue || "MCG",
        live: !!clock.live,
        concluded: !!clock.concluded,
        phase_label: clock.phase,
        home: {name: "Northside", score: roundStat(clock.home)},
        away: {name: "Bayside", score: roundStat(clock.away)}
      },
      tipsters: [{
        user_id: "demo-mick",
        name: "MidfieldMick",
        color: "#6d5efc",
        avatar: "",
        legs: legs
      }]
    };
  }

  function createDemo(onFrame) {
    var t = 0;
    var playing = false;
    var raf = 0;
    var last = 0;
    function emit() {
      if (typeof onFrame === "function") onFrame(demoPayload(t), t, playing);
    }
    function stopRaf() {
      if (raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }
    function tick(now) {
      if (!playing) return;
      if (!last) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t = Math.min(1, t + dt / (DEMO_MS / 1000));
      if (t >= 1) {
        t = 1;
        playing = false;
        stopRaf();
        emit();
        return;
      }
      emit();
      raf = requestAnimationFrame(tick);
    }
    return {
      play: function () {
        if (t >= 1) t = 0;
        playing = true;
        stopRaf();
        emit();
        if (typeof requestAnimationFrame === "function") raf = requestAnimationFrame(tick);
      },
      pause: function () {
        playing = false;
        stopRaf();
        emit();
      },
      reset: function () {
        playing = false;
        t = 0;
        stopRaf();
        emit();
      },
      seek: function (n) {
        t = Math.max(0, Math.min(1, Number(n) || 0));
        emit();
      },
      stop: function () {
        playing = false;
        stopRaf();
      },
      time: function () { return t; },
      playing: function () { return playing; }
    };
  }

  return {
    POLL_MS: POLL_MS,
    DEMO_MS: DEMO_MS,
    esc: esc,
    statusOf: statusOf,
    statusLabel: statusLabel,
    gameNotStarted: gameNotStarted,
    progressPct: progressPct,
    fmtOdds: fmtOdds,
    initials: initials,
    endpoint: endpoint,
    routeHash: routeHash,
    flatLegs: flatLegs,
    newlyHit: newlyHit,
    remember: remember,
    summaryText: summaryText,
    render: render,
    scoreHtml: scoreHtml,
    fallbackFromFeed: fallbackFromFeed,
    liveNowGames: liveNowGames,
    liveNowHtml: liveNowHtml,
    gamesFromFeeds: gamesFromFeeds,
    mergeGamePayload: mergeGamePayload,
    switcherHtml: switcherHtml,
    emptyBoardGame: emptyBoardGame,
    emptyStateHtml: emptyStateHtml,
    slipOpen: slipOpen,
    slipGameName: slipGameName,
    slipAhead: slipAhead,
    gameIsLive: gameIsLive,
    playersShouldRun: playersShouldRun,
    upcomingNames: upcomingNames,
    demoPayload: demoPayload,
    createDemo: createDemo
  };
});
