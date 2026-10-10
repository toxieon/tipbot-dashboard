/* AFL Match Centre panel (tipdash). TBMatchCentre + CommonJS for node --test. */
(function (root) {
  "use strict";

  function num(v) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : null;
  }

  function teamName(t) {
    return t && typeof t === "object" ? String(t.name || t.aflName || "") : String(t || "");
  }

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function pick(obj, keys) {
    if (!obj) return null;
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (v != null && v !== "") return v;
    }
    return null;
  }

  function mergeFrom(src, snap) {
    if (!src) return snap;
    var m = src.match && typeof src.match === "object" ? src.match : src;
    snap.homePts = num(pick(m, ["hscore", "home_score", "homePoints"])) ?? snap.homePts;
    snap.awayPts = num(pick(m, ["ascore", "away_score", "awayPoints"])) ?? snap.awayPts;
    snap.hG = num(pick(m, ["hgoals", "home_goals"])) ?? snap.hG;
    snap.hB = num(pick(m, ["hbehinds", "home_behinds"])) ?? snap.hB;
    snap.aG = num(pick(m, ["agoals", "away_goals"])) ?? snap.aG;
    snap.aB = num(pick(m, ["abehinds", "away_behinds"])) ?? snap.aB;
    var ph = pick(m, ["phase"]) || (src.phase && typeof src.phase === "object" ? src.phase : null);
    if (ph) snap.phaseLabel = String(ph.label || ph.short || snap.phaseLabel || "");
    if (ph && ph.fraction != null) snap.phaseFraction = Number(ph.fraction);
    snap.complete = num(pick(m, ["complete"])) ?? snap.complete;
    return snap;
  }

  function snapshot(game, live) {
    var snap = {
      homePts: null,
      awayPts: null,
      hG: 0,
      hB: 0,
      aG: 0,
      aB: 0,
      phaseLabel: "",
      phaseFraction: null,
      complete: num(game && game.complete),
      homeName: teamName(game && game.hteam),
      awayName: teamName(game && game.ateam),
      venue: game && game.venue ? String(game.venue) : "",
      venueId: root.TBAflStadiums ? TBAflStadiums.venueId(game && game.venue) : "generic",
      live: !!(game && game.live),
      inPlay: false,
    };
    snap = mergeFrom(game, snap);
    snap = mergeFrom(live, snap);
    if (snap.hG == null) snap.hG = 0;
    if (snap.hB == null) snap.hB = 0;
    if (snap.aG == null) snap.aG = 0;
    if (snap.aB == null) snap.aB = 0;
    if (snap.homePts == null && snap.hG != null && snap.hB != null) snap.homePts = snap.hG * 6 + snap.hB;
    if (snap.awayPts == null && snap.aG != null && snap.aB != null) snap.awayPts = snap.aG * 6 + snap.aB;
    var c = snap.complete;
    snap.inPlay = !!(game && game.aflMatchId && c != null && c > 0 && c < 100);
    if (!snap.inPlay && snap.live) snap.inPlay = true;
    return snap;
  }

  function decomposePoints(delta) {
    var out = [];
    var d = delta;
    while (d >= 6) {
      out.push("goal");
      d -= 6;
    }
    while (d >= 1) {
      out.push("behind");
      d -= 1;
    }
    return out;
  }

  function detectEvents(prev, next, game) {
    var events = [];
    if (!prev) return events;
    var homeName = next.homeName || "Home";
    var awayName = next.awayName || "Away";

    if (prev.phaseLabel && next.phaseLabel && prev.phaseLabel !== next.phaseLabel) {
      events.push({ type: "quarter", label: next.phaseLabel, team: "" });
    }

    var hdg = (next.hG || 0) - (prev.hG || 0);
    var hdb = (next.hB || 0) - (prev.hB || 0);
    var adg = (next.aG || 0) - (prev.aG || 0);
    var adb = (next.aB || 0) - (prev.aB || 0);

    if (hdg > 0 || hdb > 0 || adg > 0 || adb > 0) {
      for (var i = 0; i < hdg; i++) events.push({ type: "goal", team: "home", label: homeName + " goal" });
      for (var j = 0; j < hdb; j++) events.push({ type: "behind", team: "home", label: homeName + " behind" });
      for (var k = 0; k < adg; k++) events.push({ type: "goal", team: "away", label: awayName + " goal" });
      for (var m = 0; m < adb; m++) events.push({ type: "behind", team: "away", label: awayName + " behind" });
    } else if (next.homePts != null && next.awayPts != null && prev.homePts != null && prev.awayPts != null) {
      var dh = next.homePts - prev.homePts;
      var da = next.awayPts - prev.awayPts;
      if (dh > 0) {
        decomposePoints(dh).forEach(function (t) {
          events.push({ type: t, team: "home", label: homeName + " " + t });
        });
      }
      if (da > 0) {
        decomposePoints(da).forEach(function (t) {
          events.push({ type: t, team: "away", label: awayName + " " + t });
        });
      }
    }

    if (next.complete != null && next.complete >= 100 && (prev.complete == null || prev.complete < 100)) {
      events.push({ type: "final", label: "Full time", team: "" });
    }
    return events;
  }

  function fmtScoreLine(snap) {
    var h = snap.homePts;
    var a = snap.awayPts;
    var hs = h == null ? "—" : String(h);
    var as = a == null ? "—" : String(a);
    var det = "";
    if (snap.hG != null && snap.hB != null) det = snap.hG + "." + snap.hB;
    var detA = "";
    if (snap.aG != null && snap.aB != null) detA = snap.aG + "." + snap.aB;
    return { home: hs, away: as, homeDet: det, awayDet: detA };
  }

  function wormSvg(history) {
    var pts = history || [];
    if (!pts.length) {
      return (
        '<svg class="mc-worm-svg" viewBox="0 0 320 48" role="img" aria-label="Score margin worm">' +
        '<line x1="8" y1="24" x2="312" y2="24" stroke="rgba(255,255,255,.08)"/>' +
        '<text x="160" y="28" text-anchor="middle" fill="rgba(255,255,255,.35)" font-size="9">Margin builds from first score</text></svg>'
      );
    }
    var w = 320;
    var h = 48;
    var pad = 8;
    var margins = pts.map(function (p) {
      return p.home - p.away;
    });
    var max = Math.max.apply(null, margins.map(function (m) {
      return Math.abs(m);
    }).concat([12]));
    var coords = [];
    for (var i = 0; i < margins.length; i++) {
      var x = pad + (i * (w - 2 * pad)) / Math.max(1, margins.length - 1);
      var y = h / 2 - (margins[i] / max) * (h / 2 - pad);
      coords.push({ x: x, y: y });
    }
    var path = coords
      .map(function (c, i) {
        return (i ? "L" : "M") + c.x.toFixed(1) + " " + c.y.toFixed(1);
      })
      .join(" ");
    var last = coords[coords.length - 1];
    var col = margins[margins.length - 1] >= 0 ? "#5b8cff" : "#e5484d";
    return (
      '<svg class="mc-worm-svg" viewBox="0 0 320 48" role="img" aria-label="Score margin worm">' +
      '<line x1="' +
      pad +
      '" y1="' +
      h / 2 +
      '" x2="' +
      (w - pad) +
      '" y2="' +
      h / 2 +
      '" stroke="rgba(255,255,255,.1)"/>' +
      '<path d="' +
      path +
      '" fill="none" stroke="' +
      col +
      '" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="' +
      last.x.toFixed(1) +
      '" cy="' +
      last.y.toFixed(1) +
      '" r="3" fill="' +
      col +
      '"/></svg>'
    );
  }

  function stadiumBlock(snap) {
    var svg = root.TBAflStadiums ? TBAflStadiums.stadiumSvg(snap.venue) : "";
    return (
      '<div class="mc-stadium-stage" aria-hidden="true">' +
      '<div class="mc-stadium-tilt">' +
      svg +
      '<div class="mc-posts"><span class="mc-post mc-post-l"></span><span class="mc-post mc-post-r"></span></div>' +
      '<div class="mc-ball" aria-hidden="true"></div>' +
      '<div class="mc-burst" aria-hidden="true"></div>' +
      "</div></div>"
    );
  }

  function shellHtml(snap, state) {
    var scores = fmtScoreLine(snap);
    var status = snap.inPlay ? "live" : "upcoming";
    var clock = snap.phaseLabel || (snap.inPlay ? "Live" : "Upcoming");
    var ticker = (state && state.lastTicker) || (snap.inPlay ? "Waiting for first score…" : "Match yet to start");
    return (
      '<div class="match-centre mc-' +
      status +
      '" data-venue-id="' +
      esc(snap.venueId) +
      '">' +
      '<div class="mc-head"><span class="mc-badge">' +
      (snap.inPlay ? "● LIVE" : "MATCH CENTRE") +
      "</span>" +
      '<span class="mc-venue">' +
      esc(snap.venue) +
      "</span></div>" +
      '<div class="mc-stage-wrap">' +
      stadiumBlock(snap) +
      '<div class="mc-scoreline" aria-live="polite">' +
      '<div class="mc-team mc-home"><span class="mc-tname">' +
      esc(snap.homeName) +
      '</span><span class="mc-tscore" data-mc-home>' +
      esc(scores.home) +
      '</span><span class="mc-tdet" data-mc-hdet>' +
      esc(scores.homeDet) +
      "</span></div>" +
      '<div class="mc-team mc-away"><span class="mc-tname">' +
      esc(snap.awayName) +
      '</span><span class="mc-tscore" data-mc-away>' +
      esc(scores.away) +
      '</span><span class="mc-tdet" data-mc-adet>' +
      esc(scores.awayDet) +
      "</span></div></div></div>" +
      '<div class="mc-foot">' +
      '<div class="mc-clock-row"><span class="mc-clock" data-mc-clock>' +
      esc(clock) +
      '</span><span class="mc-worm-lab">Momentum</span></div>' +
      '<div class="mc-worm" data-mc-worm>' +
      wormSvg(state && state.worm) +
      "</div>" +
      '<div class="mc-ticker" data-mc-ticker aria-live="polite">' +
      esc(ticker) +
      "</div></div></div>"
    );
  }

  function applyLiveMatchFields(game, live) {
    if (!game || !live) return game;
    game._livePayload = live;
    var keys = ["hscore", "ascore", "hgoals", "hbehinds", "agoals", "abehinds", "complete"];
    keys.forEach(function (k) {
      if (live[k] != null) game[k] = live[k];
    });
    if (live.phase) game.phase = live.phase;
    return game;
  }

  function appendWorm(state, snap) {
    state = state || { worm: [], lastTicker: "", snap: null };
    if (snap.homePts == null || snap.awayPts == null) return state;
    var last = state.worm[state.worm.length - 1];
    if (last && last.home === snap.homePts && last.away === snap.awayPts) return state;
    state.worm = state.worm.concat([{ home: snap.homePts, away: snap.awayPts, label: snap.phaseLabel }]);
    if (state.worm.length > 48) state.worm = state.worm.slice(-48);
    return state;
  }

  function patchDom(el, snap, state) {
    if (!el) return;
    var scores = fmtScoreLine(snap);
    var h = el.querySelector("[data-mc-home]");
    var a = el.querySelector("[data-mc-away]");
    var hd = el.querySelector("[data-mc-hdet]");
    var ad = el.querySelector("[data-mc-adet]");
    var ck = el.querySelector("[data-mc-clock]");
    var tk = el.querySelector("[data-mc-ticker]");
    var wm = el.querySelector("[data-mc-worm]");
    if (h) h.textContent = scores.home;
    if (a) a.textContent = scores.away;
    if (hd) hd.textContent = scores.homeDet;
    if (ad) ad.textContent = scores.awayDet;
    if (ck) ck.textContent = snap.phaseLabel || (snap.inPlay ? "Live" : "Upcoming");
    if (tk && state.lastTicker) tk.textContent = state.lastTicker;
    if (wm) wm.innerHTML = wormSvg(state.worm);
  }

  function fireFx(events, venue, stage) {
    if (!root.TBMatchFx || !events.length) return;
    events.forEach(function (ev, i) {
      root.setTimeout(function () {
        if (ev.type === "goal") root.TBMatchFx.goal(venue, { stage: stage });
        else if (ev.type === "behind") root.TBMatchFx.behind(venue, { stage: stage });
      }, i * 180);
    });
  }

  function paint(el, game, live, state) {
    if (!el || !game) return state;
    var snap = snapshot(game, live);
    state = state || { worm: [], lastTicker: "", snap: null };
    state = appendWorm(state, snap);
    if (!el.querySelector(".match-centre")) {
      el.innerHTML = shellHtml(snap, state);
      if (root.TBMatchFx) root.TBMatchFx.bind(el.querySelector(".match-centre"));
    } else {
      patchDom(el.querySelector(".match-centre"), snap, state);
    }
    state.snap = snap;
    return state;
  }

  function onLiveTick(el, game, live, state) {
    if (!el || !game) return state;
    applyLiveMatchFields(game, live);
    var prev = state && state.snap ? state.snap : null;
    var snap = snapshot(game, live);
    state = state || { worm: [], lastTicker: "", snap: null };
    var events = detectEvents(prev, snap, game);
    if (events.length) {
      var last = events[events.length - 1];
      state.lastTicker = last.label || last.type;
    }
    state = appendWorm(state, snap);
    if (!el.querySelector(".match-centre")) {
      state = paint(el, game, live, state);
    } else {
      patchDom(el.querySelector(".match-centre"), snap, state);
    }
    var stage = el.querySelector(".mc-stadium-stage");
    fireFx(
      events.filter(function (e) {
        return e.type === "goal" || e.type === "behind";
      }),
      snap.venue,
      stage
    );
    state.snap = snap;
    return state;
  }

  var API = {
    snapshot: snapshot,
    detectEvents: detectEvents,
    decomposePoints: decomposePoints,
    applyLiveMatchFields: applyLiveMatchFields,
    wormSvg: wormSvg,
    shellHtml: shellHtml,
    paint: paint,
    onLiveTick: onLiveTick,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBMatchCentre = API;
})(typeof window !== "undefined" ? window : globalThis);
