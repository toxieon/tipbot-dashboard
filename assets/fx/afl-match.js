/* Cartoon AFL oval loop — 18 per side, idle + kick moments. TBLiveFx.afl */
(function (root) {
  "use strict";

  var HOST = "tblfx-afl-host";
  var PLAYERS_PER_SIDE = 18;

  var HOME_FORMATION = [
    { role: "ruck", x: 200, y: 114 },
    { role: "back", x: 68, y: 68 },
    { role: "back", x: 52, y: 98 },
    { role: "back", x: 62, y: 132 },
    { role: "back", x: 78, y: 158 },
    { role: "back", x: 88, y: 52 },
    { role: "back", x: 74, y: 118 },
    { role: "mid", x: 132, y: 62 },
    { role: "mid", x: 148, y: 92 },
    { role: "mid", x: 138, y: 118 },
    { role: "mid", x: 152, y: 148 },
    { role: "mid", x: 168, y: 78 },
    { role: "fwd", x: 268, y: 70 },
    { role: "fwd", x: 292, y: 96 },
    { role: "fwd", x: 278, y: 118 },
    { role: "fwd", x: 304, y: 138 },
    { role: "fwd", x: 286, y: 158 },
    { role: "fwd", x: 310, y: 52 },
  ];

  function doc() {
    return root.document;
  }

  function reduced() {
    try {
      return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function raf(fn) {
    var run =
      (root.requestAnimationFrame && root.requestAnimationFrame.bind(root)) ||
      function (f) {
        return root.setTimeout(function () {
          f(Date.now());
        }, 16);
      };
    return run(fn);
  }

  function caf(id) {
    var cancel = (root.cancelAnimationFrame && root.cancelAnimationFrame.bind(root)) || root.clearTimeout;
    return cancel(id);
  }

  function now() {
    return root.performance && root.performance.now ? root.performance.now() : Date.now();
  }

  function pairColours(team, fallback) {
    if (Array.isArray(team) && team.length >= 2) return [String(team[0]), String(team[1])];
    if (team && typeof team === "object") {
      var p = team.primary || team.main || team.a;
      var s = team.secondary || team.trim || team.b;
      if (p && s) return [String(p), String(s)];
    }
    return fallback;
  }

  function flipFormation() {
    var out = [];
    var i;
    for (i = 0; i < HOME_FORMATION.length; i++) {
      var p = HOME_FORMATION[i];
      out.push({ role: p.role, x: 400 - p.x, y: p.y });
    }
    return out;
  }

  function buildRoster(side, formation) {
    var list = [];
    var i;
    for (i = 0; i < formation.length; i++) {
      list.push({
        side: side,
        role: formation[i].role,
        bx: formation[i].x,
        by: formation[i].y,
        phase: Math.random() * Math.PI * 2,
        pace: 0.7 + Math.random() * 0.6,
        face: side === "home" ? 1 : -1,
        kicker: formation[i].role === "fwd" && i % 5 === 0,
      });
    }
    return list;
  }

  function limb(x1, y1, x2, y2, w, col) {
    return (
      '<line x1="' +
      x1 +
      '" y1="' +
      y1 +
      '" x2="' +
      x2 +
      '" y2="' +
      y2 +
      '" stroke="' +
      col +
      '" stroke-width="' +
      w +
      '" stroke-linecap="round"/>'
    );
  }

  function playerFigure(team, anim) {
    var c = team[0];
    var trim = team[1];
    var f = anim.face;
    var skin = "#F0C9A6";
    var shortCol = "#2A3140";
    var sockCol = c;
    var bob = anim.bob;
    var hx = anim.headX;
    var hy = -22 + bob;
    var headRot = anim.headRot;
    var la = anim.armBack;
    var ra = anim.armFront;
    var lp = anim.legPlant;
    var lk = anim.legKick;
    var kick = anim.kicking;
    var parts = "";
    parts +=
      '<ellipse cx="0" cy="10" rx="7" ry="2.2" fill="rgba(0,0,0,.14)"/>' +
      limb(0, 4, lp.x * f, lp.y, kick ? 2.8 : 2.5, sockCol) +
      limb(0, 4, lk.x * f, lk.y, kick ? 3.2 : 2.5, sockCol) +
      '<rect x="-4.5" y="-1" width="9" height="5.5" rx="1.5" fill="' +
      shortCol +
      '"/>' +
      '<rect x="-5.5" y="-9" width="11" height="9" rx="2.2" fill="' +
      c +
      '" stroke="' +
      trim +
      '" stroke-width=".6"/>' +
      '<rect x="-1.2" y="-9" width="2.4" height="9" rx=".4" fill="' +
      trim +
      '" opacity=".95"/>' +
      limb(-1, -7, la.x * f, la.y + bob * 0.2, 2.2, trim) +
      limb(1, -7, ra.x * f, ra.y + bob * 0.2, 2.2, trim) +
      '<g transform="translate(' +
      hx +
      " " +
      hy +
      ") rotate(" +
      headRot +
      ')">' +
      '<circle cx="0" cy="0" r="4.2" fill="' +
      skin +
      '" stroke="rgba(0,0,0,.12)" stroke-width=".4"/>' +
      '<circle cx="' +
      (1.6 * f).toFixed(1) +
      '" cy="-0.6" r=".65" fill="#3D2E1A"/>' +
      "</g>";
    return parts;
  }

  function idleAnim(pl, sec, reduce) {
    var t = sec * pl.pace + pl.phase;
    var jogR = pl.role === "ruck" ? 2.2 : pl.role === "back" ? 3.5 : 4.5;
    var jx = reduce ? 0 : Math.sin(t * 1.35) * jogR;
    var jy = reduce ? 0 : Math.cos(t * 1.05) * (jogR * 0.65);
    var bob = reduce ? 0 : Math.sin(t * 2.8) * 1.4;
    var sway = reduce ? 0 : Math.sin(t * 0.75) * 6;
    var step = reduce ? 0 : Math.sin(t * 3.1);
    return {
      face: pl.face,
      bob: bob,
      headX: sway * 0.08,
      headRot: sway,
      armBack: { x: -7 - step * 2, y: -2 + step },
      armFront: { x: 7 + step * 2, y: 0 - step },
      legPlant: { x: -4 - step * 3, y: 16 + Math.abs(step) * 2 },
      legKick: { x: 5 + step * 3, y: 15 - Math.abs(step) * 2 },
      kicking: false,
    };
  }

  function kickAnim(pl, kp, face) {
    var plant = { x: -5 * face, y: 17 };
    var swing;
    if (kp < 0.22) {
      swing = -18 + kp / 0.22 * 8;
    } else if (kp < 0.42) {
      swing = -10 + ((kp - 0.22) / 0.2) * 52;
    } else if (kp < 0.62) {
      swing = 42 + ((kp - 0.42) / 0.2) * 28;
    } else {
      swing = 70 - ((kp - 0.62) / 0.38) * 35;
    }
    var rad = (swing * Math.PI) / 180;
    var bootX = Math.cos(rad) * 14 * face;
    var bootY = 4 + Math.sin(rad) * 12;
    return {
      face: face,
      bob: kp < 0.42 ? -1 + kp * 3 : 0.5,
      headX: -2 * face,
      headRot: -8 * face,
      armBack: { x: -9 * face, y: 2 },
      armFront: { x: 10 * face, y: -6 },
      legPlant: plant,
      legKick: { x: bootX, y: bootY },
      kicking: true,
      bootX: bootX,
      bootY: bootY,
      contact: kp >= 0.42 && kp < 0.55,
    };
  }

  function ballSvg(bx, by) {
    return (
      '<ellipse cx="' +
      bx.toFixed(1) +
      '" cy="' +
      by.toFixed(1) +
      '" rx="4.2" ry="2.7" fill="#C45A1A" stroke="#8B3A12" stroke-width=".7"/>'
    );
  }

  function afl(el, home, away) {
    var d = doc();
    if (!d || !el || el.nodeType !== 1) return;
    root.TBLiveFx.stop();

    var homeC = pairColours(home, ["#002B5C", "#FFFFFF"]);
    var awayC = pairColours(away, ["#E5484D", "#111318"]);
    var awayForm = flipFormation();
    var homePlayers = buildRoster("home", HOME_FORMATION);
    var awayPlayers = buildRoster("away", awayForm);
    var reduce = reduced();
    var hidden = false;
    var rafId = 0;
    var t0 = now();

    el.classList.add(HOST);
    if (!el.style.position || el.style.position === "static") el.style.position = "relative";
    if (!el.style.minHeight) el.style.minHeight = "200px";

    var wrap = d.createElement("div");
    wrap.className = "tblfx-afl";
    wrap.setAttribute("aria-hidden", "true");
    wrap.style.cssText = "position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none;";
    var svg = d.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 400 220");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    var bg = d.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    bg.setAttribute("cx", "200");
    bg.setAttribute("cy", "118");
    bg.setAttribute("rx", "168");
    bg.setAttribute("ry", "88");
    bg.setAttribute("fill", "#2F6B3A");
    bg.setAttribute("stroke", "#E8EDF5");
    bg.setAttribute("stroke-width", "2");
    svg.appendChild(bg);

    var centre = d.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    centre.setAttribute("cx", "200");
    centre.setAttribute("cy", "118");
    centre.setAttribute("rx", "4");
    centre.setAttribute("ry", "4");
    centre.setAttribute("fill", "none");
    centre.setAttribute("stroke", "rgba(255,255,255,.35)");
    centre.setAttribute("stroke-width", "1");
    svg.appendChild(centre);

    var scene = d.createElementNS("http://www.w3.org/2000/svg", "g");
    scene.setAttribute("class", "tblfx-afl-scene");
    svg.appendChild(scene);

    wrap.appendChild(svg);
    el.appendChild(wrap);

    function pickKicker(list, sec) {
      var i;
      var cand = [];
      for (i = 0; i < list.length; i++) {
        if (list[i].kicker) cand.push(list[i]);
      }
      if (!cand.length) return list[0];
      return cand[Math.floor(sec / 5) % cand.length];
    }

    function paint(t) {
      var sec = t / 1000;
      var kickCycle = reduce ? 0.5 : (sec % 5) / 5;
      var homeKick = kickCycle < 0.5;
      var kp = homeKick ? kickCycle * 2 : (kickCycle - 0.5) * 2;
      var kicker = homeKick ? pickKicker(homePlayers, sec) : pickKicker(awayPlayers, sec);
      var kFace = kicker.face;
      var chunks = [];
      var i;
      var pl;
      var anim;
      var scale;
      var px;
      var py;

      for (i = 0; i < homePlayers.length; i++) {
        pl = homePlayers[i];
        anim = pl === kicker && homeKick ? kickAnim(pl, kp, 1) : idleAnim(pl, sec, reduce);
        scale = 0.82 + (pl.by / 220) * 0.22;
        px = pl.bx + (reduce ? 0 : anim.legPlant.x * 0.08 + Math.sin(sec * pl.pace + pl.phase) * 2.5);
        py = pl.by + (reduce ? 0 : anim.bob * 0.35);
        chunks.push(
          '<g transform="translate(' +
            px.toFixed(1) +
            " " +
            py.toFixed(1) +
            ") scale(" +
            scale.toFixed(2) +
            ')">' +
            playerFigure(homeC, anim) +
            "</g>"
        );
      }

      for (i = 0; i < awayPlayers.length; i++) {
        pl = awayPlayers[i];
        anim = pl === kicker && !homeKick ? kickAnim(pl, kp, -1) : idleAnim(pl, sec + 0.4, reduce);
        scale = 0.82 + (pl.by / 220) * 0.22;
        px = pl.bx + (reduce ? 0 : anim.legPlant.x * 0.06 + Math.sin(sec * pl.pace + pl.phase) * 2.5);
        py = pl.by + (reduce ? 0 : anim.bob * 0.35);
        chunks.push(
          '<g transform="translate(' +
            px.toFixed(1) +
            " " +
            py.toFixed(1) +
            ") scale(" +
            scale.toFixed(2) +
            ')">' +
            playerFigure(awayC, anim) +
            "</g>"
        );
      }

      var bx = 200;
      var by = 108;
      if (!reduce && kp > 0.38) {
        var kAnim = kickAnim(kicker, kp, kFace);
        var kx = kicker.bx + kAnim.bootX * 0.15;
        var ky = kicker.by + kAnim.bootY * 0.15 - 4;
        if (kp < 0.48) {
          bx = kx;
          by = ky;
        } else {
          var fly = (kp - 0.48) / 0.52;
          var tx = homeKick ? 320 : 80;
          bx = kx + (tx - kx) * fly;
          by = ky - Math.sin(fly * Math.PI) * 42;
        }
      } else if (reduce) {
        bx = 200;
        by = 100;
      } else {
        bx = 200 + Math.sin(sec * 0.9) * 40;
        by = 95 - Math.sin(sec * 1.1) * 8;
      }

      chunks.push(ballSvg(bx, by));
      scene.innerHTML = chunks.join("");
    }

    function onVis() {
      hidden = !!(d && d.hidden);
      if (!hidden && !reduce && !rafId) loop();
    }

    function loop() {
      rafId = 0;
      if (hidden || reduce) return;
      paint(now() - t0);
      rafId = raf(loop);
    }

    function teardown() {
      if (rafId) caf(rafId);
      rafId = 0;
      if (d && d.removeEventListener) d.removeEventListener("visibilitychange", onVis);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      el.classList.remove(HOST);
    }

    paint(0);
    if (!reduce) {
      rafId = raf(loop);
      if (d && d.addEventListener) d.addEventListener("visibilitychange", onVis);
    }

    root.TBLiveFx._session = { teardown: teardown };
  }

  root.TBLiveFx = root.TBLiveFx || {};
  root.TBLiveFx.afl = afl;

  var API = {
    afl: afl,
    pairColours: pairColours,
    PLAYERS_PER_SIDE: PLAYERS_PER_SIDE,
    homeFormation: HOME_FORMATION,
    flipFormation: flipFormation,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
