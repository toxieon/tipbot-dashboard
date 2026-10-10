/* AFL goal / behind score moments (tipdash). SVG + CSS only. TBAFLScoreMoment + CommonJS. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AFLScoreMoment = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var prevScores = Object.create(null);
  var prevLegGoals = Object.create(null);
  var styleDone = false;
  var queue = [];
  var playing = false;

  function num(v) {
    if (v == null || v === "") return null;
    var n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function reduced() {
    try {
      var g = typeof window !== "undefined" ? window : globalThis;
      return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function isAflSport(g) {
    var s = String((g && (g.sport || g.league || g.comp)) || "").toLowerCase();
    if (!s) return true;
    return /afl/.test(s);
  }

  function gameKey(g) {
    if (!g) return "";
    return String(g.match_id || g.aflMatchId || g.id || g.game_name || "").trim();
  }

  function scoresFromGame(g) {
    var h = num(g.hscore);
    var a = num(g.ascore);
    if (h == null && g.home && typeof g.home === "object") h = num(g.home.score);
    if (a == null && g.away && typeof g.away === "object") a = num(g.away.score);
    return { h: h, a: a };
  }

  function normalizeGame(g) {
    if (!g || !isAflSport(g)) return null;
    var sc = scoresFromGame(g);
    var key = gameKey(g);
    if (!key && sc.h == null && sc.a == null) return null;
    return { key: key || "game", h: sc.h, a: sc.a, afl: true };
  }

  function teamEvents(delta, team) {
    var out = [];
    var d = delta;
    while (d >= 6) {
      out.push({ type: "goal", team: team });
      d -= 6;
    }
    while (d >= 1) {
      out.push({ type: "behind", team: team });
      d -= 1;
    }
    return out;
  }

  function diffGame(prev, next, matchId) {
    if (!next || next.h == null || next.a == null) return [];
    if (!prev || prev.h == null || prev.a == null) return [];
    var dh = next.h - prev.h;
    var da = next.a - prev.a;
    if (dh <= 0 && da <= 0) return [];
    var events = [];
    if (dh > 0 && da === 0) events = teamEvents(dh, "home");
    else if (da > 0 && dh === 0) events = teamEvents(da, "away");
    else {
      if (dh > 0) events = events.concat(teamEvents(dh, "home"));
      if (da > 0) events = events.concat(teamEvents(da, "away"));
    }
    return events.map(function (ev) {
      ev.matchId = matchId;
      return ev;
    });
  }

  function scoreEvents(games, prevMap) {
    var map = prevMap || prevScores;
    var all = [];
    (games || []).forEach(function (g) {
      var n = normalizeGame(g);
      if (!n) return;
      var prev = map[n.key];
      if (prev) all = all.concat(diffGame(prev, n, n.key));
      map[n.key] = { h: n.h, a: n.a };
    });
    return all;
  }

  function normStat(v) {
    var s = String(v || "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    if (s === "goal" || s === "player goals") return "goals";
    return s;
  }

  function legGoals(leg) {
    if (!leg) return null;
    var stat = normStat(leg.stat || leg.market || leg.prop || "");
    if (stat !== "goals") return null;
    return num(leg.current != null ? leg.current : leg.live_current != null ? leg.live_current : leg.actual);
  }

  function legGoalEvents(tipId, legs, prevMap) {
    var map = prevMap || prevLegGoals;
    var events = [];
    (legs || []).forEach(function (leg, i) {
      var cur = legGoals(leg);
      if (cur == null) return;
      var key = String(tipId) + ":" + i;
      var prev = map[key];
      map[key] = cur;
      if (prev == null || cur <= prev) return;
      var delta = cur - prev;
      var j;
      for (j = 0; j < delta; j++) events.push({ type: "goal", team: "home", matchId: "", source: "leg" });
    });
    return events;
  }

  function injectStyle(doc) {
    if (styleDone || !doc) return;
    styleDone = true;
    var css = [
      ".afl-moment-host{position:relative}",
      ".afl-moment{position:absolute;inset:auto 0 100% 0;margin-bottom:6px;display:flex;justify-content:center;pointer-events:none;z-index:4}",
      ".afl-moment svg{width:132px;height:88px;overflow:visible}",
      ".afl-moment--float{position:fixed;left:50%;bottom:calc(12px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:90;margin:0}",
      ".afl-ball{fill:var(--accent,#5b8cff);stroke:var(--line,#1e2430);stroke-width:1.2}",
      ".afl-post{stroke:var(--txt,#f5f7fa);stroke-width:2.2;stroke-linecap:round}",
      ".afl-post-behind{stroke:var(--muted,#8b93a7);stroke-width:1.6;opacity:.85}",
      ".afl-ump{fill:var(--txt,#f5f7fa)}",
      ".afl-burst{stroke:var(--win,#34d399);stroke-width:2;fill:none;opacity:0}",
      "@media (prefers-reduced-motion:no-preference){",
      ".afl-moment--play .afl-ball-goal{animation:afl-ball-goal 720ms cubic-bezier(.22,1,.36,1) both}",
      ".afl-moment--play .afl-ball-behind{animation:afl-ball-behind 640ms cubic-bezier(.22,1,.36,1) both}",
      ".afl-moment--play .afl-fingers--two{animation:afl-signal 520ms ease 280ms both}",
      ".afl-moment--play .afl-fingers--one{animation:afl-signal 480ms ease 240ms both}",
      ".afl-moment--play .afl-burst{animation:afl-burst 520ms ease 360ms both}",
      "}",
      "@keyframes afl-ball-goal{0%{opacity:0;transform:translate(18px,62px) scale(.7)}35%{opacity:1}100%{opacity:1;transform:translate(66px,8px) scale(1)}}",
      "@keyframes afl-ball-behind{0%{opacity:0;transform:translate(8px,58px) scale(.75)}40%{opacity:1}100%{opacity:1;transform:translate(38px,14px) scale(1)}}",
      "@keyframes afl-signal{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}",
      "@keyframes afl-burst{0%{opacity:0;stroke-width:1;transform:scale(.6)}40%{opacity:.9}100%{opacity:0;stroke-width:3;transform:scale(1.15)}}",
      "@media (prefers-reduced-motion:reduce){.afl-moment--rm .afl-ball,.afl-moment--rm .afl-ump{opacity:.85}}"
    ].join("");
    var el = doc.createElement("style");
    el.id = "afl-score-moment-css";
    el.textContent = css;
    (doc.head || doc.documentElement).appendChild(el);
  }

  function svgFor(type) {
    var behind = type === "behind";
    var fingers = behind ? "one" : "two";
    var ballClass = behind ? "afl-ball afl-ball-behind" : "afl-ball afl-ball-goal";
    var burst = behind
      ? ""
      : '<circle class="afl-burst" cx="66" cy="22" r="14"/><circle class="afl-burst" cx="66" cy="22" r="22" style="animation-delay:80ms"/>';
    return (
      '<svg viewBox="0 0 132 88" aria-hidden="true" role="presentation">'
      + '<line class="afl-post-behind" x1="18" y1="52" x2="18" y2="28"/>'
      + '<line class="afl-post" x1="48" y1="56" x2="48" y2="12"/>'
      + '<line class="afl-post" x1="84" y1="56" x2="84" y2="12"/>'
      + '<line class="afl-post-behind" x1="114" y1="52" x2="114" y2="28"/>'
      + '<line x1="12" y1="56" x2="120" y2="56" stroke="var(--line)" stroke-width="1" opacity=".5"/>'
      + burst
      + '<circle class="' + ballClass + '" r="5" cx="18" cy="62"/>'
      + '<g class="afl-ump afl-fingers--' + fingers + '" transform="translate(98,58)">'
      + '<circle r="7" cy="-10"/>'
      + '<rect x="-5" y="-4" width="10" height="16" rx="3"/>'
      + (behind
        ? '<line x1="2" y1="-18" x2="2" y2="-28" stroke="var(--txt)" stroke-width="2" stroke-linecap="round"/>'
        : '<line x1="-4" y1="-18" x2="-4" y2="-28" stroke="var(--txt)" stroke-width="2" stroke-linecap="round"/>'
          + '<line x1="4" y1="-18" x2="4" y2="-28" stroke="var(--txt)" stroke-width="2" stroke-linecap="round"/>')
      + "</g></svg>"
    );
  }

  function playOne(type, anchor, doc) {
    injectStyle(doc);
    var host = anchor;
    var float = false;
    if (host && host.classList) {
      host.classList.add("afl-moment-host");
    } else {
      float = true;
      host = doc.body;
    }
    var layer = doc.createElement("div");
    layer.className = "afl-moment" + (float ? " afl-moment--float" : "");
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = svgFor(type === "behind" ? "behind" : "goal");
    if (reduced()) layer.classList.add("afl-moment--rm");
    else layer.classList.add("afl-moment--play");
    host.appendChild(layer);
    var ms = reduced() ? 400 : type === "behind" ? 700 : 820;
    setTimeout(function () {
      if (layer.parentNode) layer.parentNode.removeChild(layer);
    }, ms);
  }

  function drain() {
    if (playing || !queue.length) return;
    playing = true;
    var job = queue.shift();
    var doc = job.doc;
    playOne(job.type, job.anchor, doc);
    setTimeout(function () {
      playing = false;
      drain();
    }, reduced() ? 420 : 520);
  }

  function enqueue(type, anchor, doc) {
    if (!doc || !doc.body) return;
    queue.push({ type: type, anchor: anchor || null, doc: doc });
    drain();
  }

  function trackGames(games, opts) {
    opts = opts || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var events = scoreEvents(games, opts.prevMap);
    events.forEach(function (ev) {
      var anchor = opts.anchorFor ? opts.anchorFor(ev) : null;
      enqueue(ev.type, anchor, doc);
    });
    return events;
  }

  function trackLegGoals(tipId, legs, anchor, opts) {
    opts = opts || {};
    var doc = opts.document || (typeof document !== "undefined" ? document : null);
    var events = legGoalEvents(tipId, legs, opts.prevMap);
    events.forEach(function (ev) {
      enqueue(ev.type, anchor, doc);
    });
    return events;
  }

  function reset(prevMap) {
    if (prevMap) {
      Object.keys(prevMap).forEach(function (k) {
        delete prevMap[k];
      });
      return;
    }
    prevScores = Object.create(null);
    prevLegGoals = Object.create(null);
  }

  return {
    normalizeGame: normalizeGame,
    scoreEvents: scoreEvents,
    legGoalEvents: legGoalEvents,
    trackGames: trackGames,
    trackLegGoals: trackLegGoals,
    reset: reset,
    reduced: reduced,
    svgFor: svgFor
  };
});
