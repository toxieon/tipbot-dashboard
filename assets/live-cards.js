/* Live player cards (tipdash).
 *
 * Turns payloads the dashboard already fetches into games-in-progress and one
 * card per active tip leg. No new backend. Callers pass the JSON from:
 *   GET /api/live-tips?guild_id=
 *   GET /api/server?guild_id=
 *   GET /api/server/prop-counts?guild_id=
 *   GET /api/fixtures?rosters=0
 *   GET /api/live-stats?match=&complete=   (AFL player totals, same call as the builder)
 * A clock is whatever those payloads already include (phase label, phase clock,
 * or clock). There is no live-plays route in this repo; missing counts stay blank.
 *
 * Historical imports are left out (same check as the server page).
 * window.LiveCards + CommonJS for node --test.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.LiveCards = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var POLL_MS = 45000;

  var STAT_FIELDS = {
    disposals: ["disposals"],
    goals: ["goals"],
    marks: ["marks"],
    tackles: ["tackles"],
    kicks: ["kicks"],
    handballs: ["handballs"],
    hitouts: ["hitouts"],
    clearances: ["totalClearances", "clearances"],
    "fantasy points": ["dreamTeamPoints", "fantasyPoints", "fantasy"],
    points: ["points"],
    rebounds: ["rebounds"],
    assists: ["assists"],
    "threes made": ["threes", "threePointersMade"],
    threes: ["threes", "threePointersMade"],
    "points + rebounds + assists": ["pra"]
  };

  function sv() {
    if (typeof require === "function") {
      try { return require("./server-view.js"); } catch (e) {}
    }
    var g = typeof window !== "undefined" ? window : null;
    return (g && g.ServerView) || null;
  }

  function sportsApi() {
    var g = typeof globalThis !== "undefined" ? globalThis : null;
    if (g && g.TBSports) return g.TBSports;
    if (typeof require === "function") {
      try { return require("./sport-marks.js"); } catch (e) {}
    }
    return null;
  }

  function sportLabel(name) {
    var api = sportsApi();
    var raw = name == null ? "" : String(name);
    return api && api.label ? api.label(raw) : raw;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c];
    });
  }

  function num(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function fmtNum(v) {
    var n = num(v);
    if (n == null) return "";
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return (Math.round(n * 10) / 10).toFixed(1);
  }

  function fmtUnits(v) {
    var n = num(v);
    if (n == null) return "";
    return fmtNum(n) + "u";
  }

  function fmtOdds(v) {
    var n = num(v);
    if (n == null || !(n > 1)) return "";
    return n.toFixed(2);
  }

  function tkey(s) {
    return String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
  }

  function normName(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  function normSide(v) {
    var s = String(v || "").trim().toLowerCase();
    if (s === "under" || s === "u") return "under";
    if (s === "over" || s === "o") return "over";
    return "";
  }

  function normStat(v) {
    var s = String(v || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    if (s === "disposal") return "disposals";
    if (s === "player disposals") return "disposals";
    if (s === "dream team points" || s === "fantasy") return "fantasy points";
    if (s === "three pointers" || s === "3pm" || s === "threes made") return "threes";
    return s;
  }

  function isHistorical(tip) {
    var api = sv();
    if (api && typeof api.isHistoricalImport === "function") return !!api.isHistoricalImport(tip);
    return false;
  }

  function isSettled(tip) {
    if (!tip || typeof tip !== "object") return false;
    var api = sv();
    if (api && typeof api.resultOf === "function" && api.resultOf(tip)) return true;
    var st = String(tip.status || "").trim().toLowerCase();
    return st === "settled" || st === "won" || st === "lost" || st === "win" || st === "loss" || st === "push" || st === "void";
  }

  function listTips(server) {
    var tips = server && server.tips;
    if (!tips) return [];
    if (Array.isArray(tips)) return tips.filter(function (t) { return t && typeof t === "object"; });
    var out = [];
    ["queued", "settled"].forEach(function (k) {
      var rows = tips[k];
      if (!Array.isArray(rows)) return;
      rows.forEach(function (t) { if (t && typeof t === "object") out.push(t); });
    });
    return out;
  }

  function parseDesc(text) {
    var t = String(text || "").replace(/\s+/g, " ").trim();
    var m = t.match(/^(?:(.*)\s+)?(under|over)\s+(\d+(?:\.\d+)?)(?:\s+(.+))?$/i);
    if (m && m[2]) return {player: (m[1] || "").trim(), side: normSide(m[2]), line: Number(m[3]), stat: normStat(m[4] || "")};
    m = t.match(/^(?:(.*)\s+)?(\d+(?:\.\d+)?)\s*\+\s*(.*)$/);
    if (m && m[2]) return {player: (m[1] || "").trim(), side: "over", line: Number(m[2]), stat: normStat(m[3] || "")};
    return {player: "", side: "", line: null, stat: ""};
  }

  function clockText(g) {
    if (!g || typeof g !== "object") return "";
    var ph = g.phase && typeof g.phase === "object" ? g.phase : {};
    var bits = [g.clock, g.clock_display, ph.clock, ph.clock_display, ph.label, g.status_label, g.status];
    var i, s, withDigit = "", plain = "";
    for (i = 0; i < bits.length; i++) {
      s = bits[i] == null ? "" : String(bits[i]).trim();
      if (!s || s === "[object Object]") continue;
      if (/\d/.test(s) && !withDigit) withDigit = s;
      if (!plain) plain = s;
    }
    return withDigit || plain;
  }

  function finalLabel(text) {
    return /^(full time|final|ft)$/i.test(String(text || "").trim());
  }

  function inProgress(g) {
    if (!g || typeof g !== "object") return false;
    if (g.concluded === true || g.finished === true) return false;
    if (finalLabel(clockText(g))) return false;
    var c = num(g.complete);
    if (c != null && c >= 100) return false;
    if (g.live === true) return true;
    if (c != null && c > 0 && c < 100) return true;
    if (g._fromLiveTips) return true;
    return false;
  }

  function teamName(t) {
    if (!t) return "";
    if (typeof t === "string") return t.trim();
    if (typeof t === "object") return String(t.name || t.team || t.abbr || t.abbrev || "").trim();
    return "";
  }

  function splitTitle(name) {
    var raw = String(name || "").trim();
    var at = raw.split(/\s+@\s+/);
    if (at.length === 2) return {away: at[0].trim(), home: at[1].trim(), swapped: true};
    var v = raw.split(/\s+(?:vs|v)\s+/i);
    if (v.length === 2) return {home: v[0].trim(), away: v[1].trim(), swapped: false};
    return {home: "", away: "", swapped: false};
  }

  function sidesOf(g) {
    var home = teamName(g.home) || teamName(g.hteam) || teamName(g.home_team);
    var away = teamName(g.away) || teamName(g.ateam) || teamName(g.away_team);
    if (!home || !away) {
      var parts = splitTitle(g.game_name || g.title || "");
      if (!home) home = parts.home;
      if (!away) away = parts.away;
    }
    var hs = num(g.hscore);
    var as = num(g.ascore);
    if (hs == null && g.home && typeof g.home === "object") hs = num(g.home.score);
    if (as == null && g.away && typeof g.away === "object") as = num(g.away.score);
    if (hs == null) hs = num(g.home_score);
    if (as == null) as = num(g.away_score);
    return {home: {name: home, score: hs}, away: {name: away, score: as}};
  }

  function fractionOf(g) {
    var ph = g && g.phase && typeof g.phase === "object" ? g.phase : {};
    var f = num(ph.fraction);
    if (f == null) f = num(ph.progress);
    if (f == null) f = num(g && g.complete);
    if (f == null) return null;
    if (f > 1) f = f / 100;
    if (!(f > 0) || f > 1) return null;
    return f;
  }

  function sportOf(g) {
    return String((g && (g.sport || g.league || g.comp)) || "").trim().toUpperCase();
  }

  function isAflGame(g) {
    var sport = sportOf(g);
    if (sport === "AFL" || sport === "AFLW") return true;
    if (g && g.aflMatchId) return true;
    var id = String((g && (g.match_id || g.matchId || g.aflMatchId)) || "");
    return /^CD_/.test(id);
  }

  function gameId(g) {
    if (!g) return "";
    var id = g.aflMatchId || g.match_id || g.matchId || g.key || g.id || "";
    return String(id || "").trim();
  }

  function prefer(a, b) {
    return a == null || a === "" ? b : a;
  }

  function mergeGame(base, extra) {
    if (!extra) return base;
    var out = base;
    out.game_name = prefer(out.game_name, extra.game_name);
    out.sport = prefer(out.sport, extra.sport || extra.league || extra.comp);
    out.venue = prefer(out.venue, extra.venue);
    if (out.hscore == null) out.hscore = extra.hscore;
    if (out.ascore == null) out.ascore = extra.ascore;
    if (!out.home) out.home = extra.home;
    if (!out.away) out.away = extra.away;
    if (!out.hteam) out.hteam = extra.hteam;
    if (!out.ateam) out.ateam = extra.ateam;
    if (out.complete == null && extra.complete != null) out.complete = extra.complete;
    if (!out.phase && extra.phase) out.phase = extra.phase;
    if (!out.clock && extra.clock) out.clock = extra.clock;
    if (!out.aflMatchId && extra.aflMatchId) out.aflMatchId = extra.aflMatchId;
    if (!out.match_id && extra.match_id) out.match_id = extra.match_id;
    if (extra.live === true) out.live = true;
    if (extra._fromLiveTips) out._fromLiveTips = true;
    var tips = (out._tipRefs || []).concat(extra._tipRefs || []);
    out._tipRefs = tips;
    return out;
  }

  function sameGame(a, b) {
    var ia = gameId(a), ib = gameId(b);
    if (ia && ib && ia === ib) return true;
    var na = normName(a.game_name || a.title);
    var nb = normName(b.game_name || b.title);
    return !!na && na === nb;
  }

  function collectGames(input) {
    var games = [];
    function add(raw, fromTips) {
      if (!raw || typeof raw !== "object") return;
      var g = {
        game_name: raw.game_name || raw.title || "",
        sport: raw.sport || raw.league || raw.comp || "",
        venue: raw.venue || "",
        hscore: raw.hscore,
        ascore: raw.ascore,
        home: raw.home,
        away: raw.away,
        hteam: raw.hteam,
        ateam: raw.ateam,
        complete: raw.complete,
        phase: raw.phase,
        clock: raw.clock,
        clock_display: raw.clock_display,
        status_label: raw.status_label,
        aflMatchId: raw.aflMatchId || "",
        match_id: raw.match_id || raw.matchId || raw.aflMatchId || "",
        live: raw.live === true,
        concluded: raw.concluded === true,
        finished: raw.finished === true,
        _fromLiveTips: !!fromTips,
        _tipRefs: Array.isArray(raw.tips) ? raw.tips.filter(Boolean) : []
      };
      if (!inProgress(g)) return;
      for (var i = 0; i < games.length; i++) {
        if (sameGame(games[i], g)) { mergeGame(games[i], g); return; }
      }
      games.push(g);
    }
    var live = input && input.liveTips;
    (live && live.games || []).forEach(function (g) { add(g, true); });
    var fx = input && input.fixtures;
    (fx && fx.games || []).forEach(function (g) { add(g, false); });
    return games;
  }

  function tipListedOn(game, tipId) {
    var id = String(tipId);
    return (game._tipRefs || []).some(function (t) {
      return t && String(t.tip_id != null ? t.tip_id : t.id) === id;
    });
  }

  function gameForTip(tip, games) {
    var id = tip && tip.tip_id != null ? String(tip.tip_id) : "";
    var i;
    if (id) {
      for (i = 0; i < games.length; i++) if (tipListedOn(games[i], id)) return games[i];
    }
    var mid = String((tip && (tip.match_id || tip.aflMatchId || tip.game_id)) || "");
    if (mid) {
      for (i = 0; i < games.length; i++) if (gameId(games[i]) === mid) return games[i];
    }
    var name = normName(tip && (tip.game_name || tip.event || ""));
    if (name) {
      for (i = 0; i < games.length; i++) {
        if (normName(games[i].game_name) === name) return games[i];
      }
    }
    return null;
  }

  function liveLegFor(tipId, games) {
    var id = String(tipId);
    for (var i = 0; i < games.length; i++) {
      var refs = games[i]._tipRefs || [];
      for (var j = 0; j < refs.length; j++) {
        var t = refs[j];
        if (t && String(t.tip_id != null ? t.tip_id : t.id) === id && Array.isArray(t.legs)) return t.legs;
      }
    }
    return [];
  }

  function activeTips(input, games) {
    var known = listTips(input && input.server);
    var byId = {};
    known.forEach(function (t) { if (t.tip_id != null) byId[String(t.tip_id)] = t; });
    var out = [];
    var seen = {};
    known.forEach(function (t) {
      if (t.tip_id == null || isHistorical(t) || isSettled(t)) return;
      seen[String(t.tip_id)] = 1;
      out.push(t);
    });
    var serverGiven = !!(input && input.server);
    games.forEach(function (g) {
      (g._tipRefs || []).forEach(function (stub) {
        if (!stub || stub.tip_id == null) return;
        var id = String(stub.tip_id);
        if (seen[id]) return;
        var row = byId[id];
        if (row && (isHistorical(row) || isSettled(row))) return;
        if (row) return;
        if (serverGiven && !stub.legs) return;
        seen[id] = 1;
        out.push(stub);
      });
    });
    return out;
  }

  function legFields(base, countLeg, textLeg) {
    var b = base && typeof base === "object" ? base : {};
    var c = countLeg && typeof countLeg === "object" ? countLeg : {};
    var t = textLeg && typeof textLeg === "object" ? textLeg : {};
    var text = b.description || b.text || b.market || t.description || t.text || "";
    var parsed = parseDesc(text);
    var side = normSide(b.side || b.ou || c.side || t.side || parsed.side);
    var line = num(b.line);
    if (line == null) line = num(b.line_value);
    if (line == null) line = num(c.line);
    if (line == null) line = num(t.line);
    if (line == null) line = parsed.line;
    var stat = normStat(b.stat || b.market || b.prop || b.stat_key || t.stat || t.market || parsed.stat);
    var player = String(b.player || t.player || parsed.player || "").trim();
    var current = num(c.current);
    if (current == null) current = num(b.current);
    if (current == null) current = num(b.live_current);
    if (current == null) current = num(t.current);
    if (current == null) current = num(t.live_current);
    return {player: player, side: side, line: line, stat: stat, current: current, text: String(text || "").trim()};
  }

  function playerStat(payload, player, stat) {
    if (!payload || payload.available === false || !player) return null;
    var bag = payload.players;
    if (!bag) return null;
    var key = tkey(player);
    var row = null;
    if (Array.isArray(bag)) {
      for (var i = 0; i < bag.length; i++) {
        var name = bag[i] && (bag[i].player || bag[i].name);
        if (name && tkey(name) === key) { row = bag[i]; break; }
      }
    } else if (typeof bag === "object") {
      row = bag[key] || null;
      if (!row) {
        var keys = Object.keys(bag);
        for (var k = 0; k < keys.length; k++) {
          var item = bag[keys[k]];
          var nm = item && (item.player || item.name);
          if ((nm && tkey(nm) === key) || tkey(keys[k]) === key) { row = item; break; }
        }
      }
    }
    if (!row || typeof row !== "object") return null;
    var summary = row.summary && typeof row.summary === "object" ? row.summary : row;
    var fields = STAT_FIELDS[stat] || (stat ? [stat] : []);
    for (var f = 0; f < fields.length; f++) {
      var n = num(summary[fields[f]]);
      if (n != null) return n;
    }
    return null;
  }

  function statusOf(o) {
    o = o || {};
    var side = normSide(o.side);
    var cur = num(o.current);
    var line = num(o.line);
    if (cur == null || line == null) return "";
    var frac = num(o.fraction);
    if (frac != null && frac > 1) frac = frac / 100;
    if (frac != null && (frac <= 0.05 || frac > 1)) frac = null;
    var done = !!o.concluded || frac === 1;
    var over = side !== "under";
    if (over) {
      if (cur > line) return "hit";
      if (done) return "miss";
      if (frac != null) return (cur / frac) > line ? "on-track" : "at-risk";
      return (line - cur) <= 1 ? "at-risk" : "on-track";
    }
    if (cur > line) return "miss";
    if (done) return "hit";
    if (frac != null) {
      if ((cur / frac) > line) return "at-risk";
      if ((line - cur) <= 1 && frac >= 0.75) return "at-risk";
      return "on-track";
    }
    return (line - cur) <= 1 ? "at-risk" : "on-track";
  }

  function marketLine(o) {
    o = o || {};
    var side = normSide(o.side);
    var line = num(o.line);
    var stat = normStat(o.stat);
    if (!side || line == null || !stat) {
      var parsed = parseDesc(o.text || o.description || "");
      if (!side) side = parsed.side;
      if (line == null) line = parsed.line;
      if (!stat) stat = parsed.stat;
    }
    var lineText = fmtNum(line);
    if (side && lineText) return side + " " + lineText + (stat ? " " + stat : "");
    var text = String(o.text || o.description || "").trim();
    if (text) return text;
    if (lineText && stat) return lineText + " " + stat;
    return stat || "";
  }

  var STATUS_LABEL = {"on-track": "On track", "at-risk": "At risk", hit: "Hit", miss: "Miss"};

  function barFor(current, line) {
    var cur = num(current), ln = num(line);
    if (cur == null || ln == null || !(ln > 0)) return null;
    var scale = Math.max(ln * 1.15, cur, 1);
    var pct = Math.max(0, Math.min(100, cur / scale * 100));
    var at = Math.max(0, Math.min(100, ln / scale * 100));
    return {pct: Math.round(pct * 10) / 10, at: Math.round(at * 10) / 10};
  }

  function initials(name) {
    var p = String(name || "?").trim().split(/\s+/);
    return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  }

  function buildModel(input) {
    input = input || {};
    var games = collectGames(input);
    var counts = (input.propCounts && input.propCounts.tips) || {};
    var stats = input.liveStats || {};
    var tips = activeTips(input, games);
    games.forEach(function (g) { g._cards = []; });
    tips.forEach(function (tip) {
      var game = gameForTip(tip, games);
      if (!game) return;
      var id = tip.tip_id != null ? String(tip.tip_id) : "";
      var countLegs = id && Array.isArray(counts[id]) ? counts[id] : [];
      var textLegs = Array.isArray(tip.legs) && tip.legs.length ? tip.legs : liveLegFor(id, games);
      if (!textLegs.length && countLegs.length) textLegs = countLegs.map(function () { return {}; });
      textLegs.forEach(function (leg, i) {
        var fields = legFields(leg, countLegs[i], (liveLegFor(id, games) || [])[i]);
        if (fields.current == null) {
          var payload = stats[gameId(game)] || stats[game.aflMatchId] || stats[game.match_id];
          var fromLive = playerStat(payload, fields.player, fields.stat);
          if (fromLive != null) fields.current = fromLive;
        }
        if (!fields.player && !fields.text && fields.line == null) return;
        var frac = fractionOf(game);
        var status = statusOf({side: fields.side, current: fields.current, line: fields.line, fraction: frac, concluded: false});
        var phrase = marketLine(fields);
        var bar = barFor(fields.current, fields.line);
        game._cards.push({
          player: fields.player || "Selection",
          market: phrase,
          stat: fields.stat,
          side: fields.side,
          current: fields.current,
          line: fields.line,
          currentText: fields.current == null ? "" : fmtNum(fields.current),
          lineText: fields.line == null ? "" : fmtNum(fields.line),
          status: status,
          statusLabel: STATUS_LABEL[status] || "",
          unitsText: fmtUnits(tip.units),
          oddsText: fmtOdds(tip.odds),
          pct: bar ? bar.pct : null,
          lineAt: bar ? bar.at : null,
          note: fields.current == null && fields.line != null ? "Count not in yet" : ""
        });
      });
    });
    var server = input.server || {};
    var settings = server.settings || {};
    return {
      serverName: String(settings.display_name || settings.name || ""),
      games: games.filter(function (g) { return g._cards && g._cards.length; }).map(function (g) {
        var sides = sidesOf(g);
        var title = g.game_name || [sides.home.name, sides.away.name].filter(Boolean).join(" v ") || "Live game";
        var clock = clockText(g) || "Live";
        var gid = gameId(g);
        return {
          id: gid || normName(title).replace(/\s+/g, "-"),
          title: title,
          sport: sportOf(g),
          clock: clock,
          venue: g.venue || "",
          matchId: isAflGame(g) ? gid : "",
          afl: isAflGame(g),
          complete: num(g.complete),
          home: sides.home,
          away: sides.away,
          legs: g._cards
        };
      })
    };
  }

  function stakeLine(leg) {
    var bits = [];
    if (leg.unitsText) bits.push(leg.unitsText);
    if (leg.oddsText) bits.push("@ " + leg.oddsText);
    return bits.join(" · ");
  }

  function gameHtml(g) {
    var teams = "";
    if (g.home.name || g.away.name) {
      teams = [g.home, g.away].map(function (t) {
        var sc = t.score == null ? "" : fmtNum(t.score);
        return '<div class="tm"><span class="nm">' + esc(t.name || "Team") + '</span><b class="sc">' + esc(sc) + "</b></div>";
      }).join("");
    } else {
      teams = '<div class="tm"><span class="nm">' + esc(g.title) + "</span><b class=\"sc\"></b></div>";
    }
    var sport = g.sport ? '<span class="sport">' + esc(sportLabel(g.sport)) + "</span>" : "";
    var cards = g.legs.map(cardHtml).join("");
    return '<section class="game" id="g-' + esc(g.id) + '">'
      + '<header class="ghead"><div class="teams">' + teams + "</div>"
      + '<div class="clock">' + sport + '<span class="pchip"><i class="dot" aria-hidden="true"></i>' + esc(g.clock) + "</span></div></header>"
      + '<div class="legs">' + cards + "</div></section>";
  }

  function cardHtml(leg) {
    var cls = leg.status ? " st-" + leg.status.replace("on-track", "track").replace("at-risk", "risk") : "";
    var chip = leg.statusLabel ? '<span class="chip">' + esc(leg.statusLabel) + "</span>" : "";
    var nums = "";
    if (leg.currentText) {
      nums = '<div class="nums"><b>' + esc(leg.currentText) + "</b>"
        + (leg.lineText ? '<span>/ ' + esc(leg.lineText) + "</span>" : "") + "</div>";
    }
    var bar = "";
    if (leg.pct != null) {
      var label = (leg.currentText || "0") + " of " + (leg.lineText || "") + (leg.stat ? " " + leg.stat : "");
      bar = '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + esc(String(leg.pct)) + '" aria-label="' + esc(label.trim()) + '">'
        + '<i style="width:' + leg.pct + '%"></i>'
        + '<em class="mark" style="left:' + leg.lineAt + '%"></em></div>';
    }
    var note = leg.note ? '<p class="note">' + esc(leg.note) + "</p>" : "";
    var stake = stakeLine(leg);
    var aria = [leg.player, leg.market, leg.currentText && leg.lineText ? (leg.currentText + " of " + leg.lineText) : "", leg.statusLabel].filter(Boolean).join(", ");
    return '<article class="pcard' + cls + '" data-status="' + esc(leg.status) + '" aria-label="' + esc(aria) + '">'
      + '<div class="prow"><div class="av" aria-hidden="true">' + esc(initials(leg.player)) + "</div>"
      + '<div class="who"><div class="pname">' + esc(leg.player) + '</div>'
      + (leg.market ? '<div class="mkt">' + esc(leg.market) + "</div>" : "") + "</div>"
      + chip + "</div>"
      + nums + bar + note
      + (stake ? '<p class="stake">' + esc(stake) + "</p>" : "")
      + "</article>";
  }

  function render(model) {
    var games = model && model.games || [];
    if (!games.length) {
      return '<div class="empty"><h2>Nothing in progress</h2><p>When a game is on, each active tip shows here as a player card.</p></div>';
    }
    return games.map(gameHtml).join("");
  }

  function statQueries(input) {
    var model = buildModel(Object.assign({}, input || {}, {liveStats: {}}));
    var seen = {};
    var out = [];
    model.games.forEach(function (g) {
      if (!g.afl || !g.matchId || seen[g.matchId]) return;
      var need = g.legs.some(function (l) { return l.current == null && l.stat; });
      if (!need) return;
      seen[g.matchId] = 1;
      var c = num(g.complete);
      if (c == null || c <= 0 || c >= 100) c = 50;
      out.push({match: g.matchId, complete: c});
    });
    return out;
  }

  function pickGuild(servers, queryGuild, savedGuild) {
    var list = [];
    (servers || []).forEach(function (s) {
      if (!s || s.guild_id == null) return;
      var id = String(s.guild_id);
      if (!/^\d+$/.test(id)) return;
      list.push({id: id, name: String(s.display_name || s.name || ("Server " + id))});
    });
    var q = queryGuild != null && /^\d+$/.test(String(queryGuild)) ? String(queryGuild) : "";
    if (q) return {id: q, servers: list};
    var saved = savedGuild != null ? String(savedGuild) : "";
    if (saved && list.some(function (s) { return s.id === saved; })) return {id: saved, servers: list};
    return {id: (list[0] && list[0].id) || "", servers: list};
  }

  function endpointPaths(guildId) {
    var g = encodeURIComponent(String(guildId || ""));
    return {
      servers: "/api/servers?lite=1",
      liveTips: "/api/live-tips?guild_id=" + g,
      server: "/api/server?guild_id=" + g,
      propCounts: "/api/server/prop-counts?guild_id=" + g,
      fixtures: "/api/fixtures?rosters=0"
    };
  }

  function liveStatsPath(matchId, complete) {
    return "/api/live-stats?match=" + encodeURIComponent(String(matchId || ""))
      + "&complete=" + encodeURIComponent(String(complete == null ? "" : complete));
  }

  function sampleInput() {
    return {
      server: {
        settings: {display_name: "Saturday server"},
        tips: {
          queued: [
            {tip_id: "t-risk", units: 2, odds: 1.85, game_name: "Geelong v Carlton", match_id: "CD_M1",
              legs: [{player: "Patrick Dangerfield", stat: "Disposals", side: "Under", line: 19.5}]},
            {tip_id: "t-track", units: 1.5, odds: 1.9, game_name: "Geelong v Carlton", match_id: "CD_M1",
              legs: [{player: "Marcus Bontempelli", stat: "disposals", side: "Over", line: 28.5}]},
            {tip_id: "t-hit", units: 1, odds: 1.72, game_name: "Geelong v Carlton", match_id: "CD_M1",
              legs: [{player: "Jeremy Cameron", stat: "Goals", side: "Over", line: 2.5}]},
            {tip_id: "t-miss", units: 1, odds: 1.95, game_name: "Geelong v Carlton", match_id: "CD_M1",
              legs: [{player: "Tom Stewart", stat: "Marks", side: "Under", line: 4.5}]},
            {tip_id: "t-old", units: 5, odds: 2.1, historical: true, game_name: "Geelong v Carlton", match_id: "CD_M1",
              legs: [{player: "Imported Player", stat: "Disposals", side: "Over", line: 20}]},
            {tip_id: "t-nba", units: 1.5, odds: 1.91, game_name: "Lakers v Celtics", match_id: "NBA1",
              legs: [{player: "LeBron James", stat: "Points", side: "Over", line: 24.5}]},
            {tip_id: "t-done", units: 1, odds: 1.8, game_name: "Sydney v Brisbane Lions", match_id: "CD_DONE",
              legs: [{player: "Finished Player", stat: "Disposals", side: "Over", line: 25}]}
          ],
          settled: []
        }
      },
      propCounts: {tips: {
        "t-risk": [{current: 14, line: 19.5, side: "Under", status: "pending"}],
        "t-track": [{current: 22, line: 28.5, side: "Over", status: "pending"}],
        "t-hit": [{current: 3, line: 2.5, side: "Over", status: "pending"}],
        "t-miss": [{current: 6, line: 4.5, side: "Under", status: "pending"}],
        "t-old": [{current: 10, line: 20, side: "Over", status: "pending"}],
        "t-nba": [{current: 23, line: 24.5, side: "Over", status: "pending"}],
        "t-done": [{current: 30, line: 25, side: "Over", status: "hit"}]
      }},
      liveTips: {games: [
        {match_id: "CD_M1", game_name: "Geelong v Carlton", sport: "AFL", concluded: false,
          hscore: 68, ascore: 54, complete: 62, phase: {label: "Q3 8:12"}, venue: "MCG",
          tips: [{tip_id: "t-risk"}, {tip_id: "t-track"}, {tip_id: "t-hit"}, {tip_id: "t-miss"}, {tip_id: "t-old"}]},
        {match_id: "NBA1", game_name: "Lakers v Celtics", sport: "NBA", concluded: false,
          hscore: 102, ascore: 98, complete: 90, phase: {label: "Q4 2:11"},
          tips: [{tip_id: "t-nba"}]},
        {match_id: "CD_DONE", game_name: "Sydney v Brisbane Lions", sport: "AFL", concluded: true,
          hscore: 90, ascore: 70, phase: {label: "Full time"}, tips: [{tip_id: "t-done"}]}
      ]},
      fixtures: {games: [
        {aflMatchId: "CD_M1", game_name: "Geelong v Carlton", live: true, complete: 62,
          hscore: 68, ascore: 54, venue: "MCG",
          hteam: {name: "Geelong"}, ateam: {name: "Carlton"}},
        {aflMatchId: "CD_DONE", game_name: "Sydney v Brisbane Lions", live: false, complete: 100, finished: true,
          hscore: 90, ascore: 70, hteam: {name: "Sydney"}, ateam: {name: "Brisbane Lions"}}
      ]},
      liveStats: {}
    };
  }

  return {
    POLL_MS: POLL_MS,
    statusOf: statusOf,
    marketLine: marketLine,
    buildModel: buildModel,
    render: render,
    statQueries: statQueries,
    pickGuild: pickGuild,
    sampleInput: sampleInput,
    barFor: barFor,
    endpointPaths: endpointPaths,
    liveStatsPath: liveStatsPath
  };
});
