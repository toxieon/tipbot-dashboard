/* Goal moments from the live-tips feed, and the ball path through the sticks.
   A goal is six points. Behinds are one point and do not play. */
(function (root) {
  "use strict";

  var FIELD = (root && root.TBMcgField) || (typeof require === "function" ? require("./field.js") : null);
  var GOAL_X = FIELD ? FIELD.GOAL_X : 84;
  var POST_HALF = FIELD ? FIELD.POST_HALF : 3.2;
  var BALL_KEY = "tipdash_ball_sponsor";
  var MAX_BURST = 3;

  function num(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function parseScore(raw) {
    if (raw && typeof raw === "object") {
      var g = num(raw.goals != null ? raw.goals : raw.g);
      var behinds = num(raw.behinds != null ? raw.behinds : raw.b);
      var p = num(raw.points != null ? raw.points : raw.total);
      if (p == null && g != null && behinds != null) p = g * 6 + behinds;
      return { goals: g, points: p };
    }
    if (typeof raw === "string" && raw.indexOf(".") >= 0) {
      var bits = raw.split(".");
      if (bits.length >= 3) return { goals: num(bits[0]), points: num(bits[2]) };
      if (bits.length === 2) {
        var gg = num(bits[0]);
        var bb = num(bits[1]);
        return { goals: gg, points: gg != null && bb != null ? gg * 6 + bb : null };
      }
    }
    return { goals: null, points: num(raw) };
  }

  function sideRaw(game, side) {
    if (!game) return null;
    if (side === "home") return game.hscore != null ? game.hscore : game.home_score;
    return game.ascore != null ? game.ascore : game.away_score;
  }

  function explicitGoals(game, side) {
    if (!game) return null;
    var keys = side === "home"
      ? ["hgoals", "home_goals", "goals_home"]
      : ["agoals", "away_goals", "goals_away"];
    var i;
    for (i = 0; i < keys.length; i++) {
      var n = num(game[keys[i]]);
      if (n != null) return n;
    }
    var bag = side === "home" ? (game.home || game.hteam) : (game.away || game.ateam);
    if (bag && typeof bag === "object") {
      var g = num(bag.goals);
      if (g != null) return g;
    }
    return null;
  }

  function sideState(game, side) {
    var parsed = parseScore(sideRaw(game, side));
    var goals = explicitGoals(game, side);
    if (goals == null) goals = parsed.goals;
    return { goals: goals, points: parsed.points };
  }

  function teamName(game, side) {
    var t = side === "home" ? (game.hteam || game.home) : (game.ateam || game.away);
    if (t && typeof t === "object") return String(t.name || t.team || t.abbrev || "");
    return t == null ? "" : String(t);
  }

  function matchId(game) {
    if (!game) return "";
    var id = game.match_id || game.aflMatchId || game.espn_event_id || game.game_id || game.id;
    return id == null ? "" : String(id);
  }

  function isAfl(game) {
    var s = String(game.sport || game.league || game.comp || "").toLowerCase();
    if (!s) return true;
    return s.indexOf("afl") >= 0 || s.indexOf("aussie") >= 0;
  }

  function quarterOf(game) {
    var label = "";
    if (game.phase && game.phase.label) label = game.phase.label;
    else if (game.quarter != null) label = game.quarter;
    else if (game.period != null) label = game.period;
    var text = String(label).toLowerCase();
    if (/q\s*4|4th|fourth|full/.test(text)) return 4;
    if (/q\s*3|3rd|third/.test(text)) return 3;
    if (/q\s*2|2nd|second/.test(text)) return 2;
    if (/q\s*1|1st|first/.test(text)) return 1;
    var n = num(game.quarter);
    if (n >= 1 && n <= 4) return n;
    return 1;
  }

  /* Q1 and Q3 the home side scores at the east sticks. Ends swap each break. */
  function scoringEnd(team, quarter) {
    var q = Number(quarter) || 1;
    var homeEast = q === 1 || q === 3;
    var home = team === "home" || team === "h";
    if (home) return homeEast ? "east" : "west";
    return homeEast ? "west" : "east";
  }

  function snapshot(games) {
    var out = {};
    var list = Array.isArray(games) ? games : [];
    var i;
    for (i = 0; i < list.length; i++) {
      var g = list[i];
      if (!g || !isAfl(g)) continue;
      var id = matchId(g);
      if (!id) continue;
      out[id] = {
        home: sideState(g, "home"),
        away: sideState(g, "away"),
        quarter: quarterOf(g),
        homeName: teamName(g, "home"),
        awayName: teamName(g, "away")
      };
    }
    return out;
  }

  function added(prev, next) {
    if (!prev || !next) return 0;
    if (prev.goals != null && next.goals != null) {
      var dg = next.goals - prev.goals;
      return dg > 0 ? dg : 0;
    }
    if (prev.points != null && next.points != null) {
      var dp = next.points - prev.points;
      if (dp < 6) return 0;
      return Math.floor(dp / 6);
    }
    return 0;
  }

  function diff(prevSnap, games) {
    var next = snapshot(games);
    var events = [];
    if (!prevSnap) return { events: events, snapshot: next };
    var id;
    for (id in next) {
      if (!Object.prototype.hasOwnProperty.call(next, id)) continue;
      var before = prevSnap[id];
      if (!before) continue;
      var row = next[id];
      var sides = ["home", "away"];
      var s;
      for (s = 0; s < sides.length; s++) {
        var side = sides[s];
        var n = added(before[side], row[side]);
        if (n > MAX_BURST) n = MAX_BURST;
        var k;
        for (k = 0; k < n; k++) {
          events.push({
            matchId: id,
            end: scoringEnd(side, row.quarter),
            team: side,
            teamName: side === "home" ? row.homeName : row.awayName,
            quarter: row.quarter
          });
        }
      }
    }
    return { events: events, snapshot: next };
  }

  /* t is 0 at the kick and 1 past the line. The ball crosses the sticks near t 0.81. */
  function sampleFlight(end, t) {
    var sign = end === "west" ? -1 : 1;
    var u = t < 0 ? 0 : t > 1 ? 1 : t;
    var goalX = sign * GOAL_X;
    var startX = goalX - sign * 34;
    var finishX = goalX + sign * 8;
    var x = startX + (finishX - startX) * u;
    var z = (1 - u) * (1 - u) * 2.4 * (sign < 0 ? 1 : -1);
    var y = 1.15 + Math.sin(Math.PI * Math.min(u * 1.05, 1)) * 7.4;
    return { x: x, y: y, z: z };
  }

  function crossesSticks(end) {
    var sign = end === "west" ? -1 : 1;
    var goalX = sign * GOAL_X;
    var lo = 0;
    var hi = 1;
    var i;
    for (i = 0; i < 24; i++) {
      var mid = (lo + hi) / 2;
      var p = sampleFlight(end, mid);
      if ((sign > 0 && p.x < goalX) || (sign < 0 && p.x > goalX)) lo = mid;
      else hi = mid;
    }
    var at = sampleFlight(end, (lo + hi) / 2);
    return {
      t: (lo + hi) / 2,
      x: at.x,
      y: at.y,
      z: at.z,
      betweenPosts: Math.abs(at.z) < POST_HALF && at.y > 1.5 && at.y < 15
    };
  }

  function ballSponsorFromPayload(body) {
    if (!body || typeof body !== "object") return "";
    if (typeof body.ballSponsorUrl === "string" && body.ballSponsorUrl) return body.ballSponsorUrl;
    var bag = body.ball_sponsor || body.ballSponsor;
    if (typeof bag === "string") return bag;
    if (bag && typeof bag.url === "string") return bag.url;
    var assets = body.assets;
    if (Array.isArray(assets)) {
      var i;
      for (i = 0; i < assets.length; i++) {
        var slot = String(assets[i] && assets[i].slot || "");
        if (slot === "ball" && assets[i].active !== false && assets[i].id) {
          return "/api/owner/sponsors/assets/" + assets[i].id + "/file";
        }
      }
    }
    return "";
  }

  function readBallSponsor(storage) {
    try {
      return String((storage && storage.getItem(BALL_KEY)) || "");
    } catch (e) {
      return "";
    }
  }

  function writeBallSponsor(storage, url) {
    try {
      if (!storage) return;
      if (url) storage.setItem(BALL_KEY, String(url));
      else storage.removeItem(BALL_KEY);
    } catch (e) {}
  }

  function absUrl(api, url) {
    if (!url) return "";
    if (/^https?:/i.test(url) || url.indexOf("data:") === 0 || url.indexOf("blob:") === 0) return url;
    var base = String(api || "").replace(/\/$/, "");
    if (url.charAt(0) === "/") return base + url;
    return base ? base + "/" + url : url;
  }

  function boardSlides(body, api) {
    var list = [];
    if (!body || typeof body !== "object") return list;
    if (Array.isArray(body.playlist) && body.playlist.length) list = body.playlist;
    else if (Array.isArray(body.slides) && body.slides.length) list = body.slides;
    else if (body.rotation && Array.isArray(body.rotation.playlist)) list = body.rotation.playlist;
    var out = [];
    var i;
    for (i = 0; i < list.length; i++) {
      var item = list[i] || {};
      var url = item.url || item.image || "";
      if (!url && item.asset_id) url = "/api/owner/sponsors/assets/" + item.asset_id + "/file";
      if (!url) continue;
      var hold = Number(item.hold_s != null ? item.hold_s : (item.hold != null ? item.hold : item.duration));
      if (!isFinite(hold) || hold <= 0) hold = 8;
      out.push({
        image: absUrl(api, url),
        duration: hold,
        scroll: item.scroll != null && isFinite(Number(item.scroll)) ? Number(item.scroll) : 0.15,
        bg: item.bg || "#0F1420",
        sponsor: item.sponsor || item.name || ""
      });
    }
    return out;
  }

  function groundPlacements(rotation, api) {
    var rows = rotation && Array.isArray(rotation.ground) ? rotation.ground : [];
    var out = [];
    var i;
    for (i = 0; i < rows.length; i++) {
      var row = rows[i] || {};
      if (!row.asset_id) continue;
      out.push({
        id: row.slot_id || "",
        assetId: row.asset_id,
        url: absUrl(api, "/api/owner/sponsors/assets/" + row.asset_id + "/file"),
        x: Number(row.x) || 0,
        z: Number(row.z) || 0,
        w: Number(row.w) || 0,
        h: Number(row.h) || 0,
        rot: Number(row.rot) || 0,
        opacity: row.opacity != null ? Number(row.opacity) : 0.85
      });
    }
    return out;
  }

  var api = {
    BALL_KEY: BALL_KEY,
    parseScore: parseScore,
    quarterOf: quarterOf,
    scoringEnd: scoringEnd,
    snapshot: snapshot,
    diff: diff,
    sampleFlight: sampleFlight,
    crossesSticks: crossesSticks,
    ballSponsorFromPayload: ballSponsorFromPayload,
    readBallSponsor: readBallSponsor,
    writeBallSponsor: writeBallSponsor,
    boardSlides: boardSlides,
    groundPlacements: groundPlacements,
    absUrl: absUrl,
    isAfl: isAfl,
    matchId: matchId
  };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBMcgGoals = api;
  if (root && root.TD && root.TD.loaded) root.TD.loaded["mcg/goals"] = true;
})(typeof window !== "undefined" ? window : globalThis);
