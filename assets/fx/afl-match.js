/* Cartoon stick-figure AFL loop on an oval. TBLiveFx.afl */
(function (root) {
  "use strict";

  var HOST = "tblfx-afl-host";

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

  function stick(team, x, y, scale, pose) {
    var c = team[0];
    var trim = team[1];
    var arm = pose === "mark" ? -28 : pose === "kick" ? 22 : 8;
    var leg = pose === "run" ? 10 : 4;
    return (
      '<g transform="translate(' +
      x +
      " " +
      y +
      ") scale(" +
      scale +
      ')">' +
      '<circle cx="0" cy="-18" r="5" fill="' +
      trim +
      '" stroke="' +
      c +
      '" stroke-width="1.2"/>' +
      '<line x1="0" y1="-13" x2="0" y2="4" stroke="' +
      c +
      '" stroke-width="3.2" stroke-linecap="round"/>' +
      '<line x1="0" y1="-8" x2="' +
      arm +
      '" y2="-2" stroke="' +
      c +
      '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<line x1="0" y1="-8" x2="' +
      (-arm * 0.6).toFixed(0) +
      '" y2="0" stroke="' +
      c +
      '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<line x1="0" y1="4" x2="-6" y2="' +
      (14 + leg) +
      '" stroke="' +
      trim +
      '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<line x1="0" y1="4" x2="7" y2="' +
      (14 - leg) +
      '" stroke="' +
      trim +
      '" stroke-width="2.6" stroke-linecap="round"/>' +
      "</g>"
    );
  }

  function afl(el, home, away) {
    var d = doc();
    if (!d || !el || el.nodeType !== 1) return;
    root.TBLiveFx.stop();

    var homeC = pairColours(home, ["#002B5C", "#FFFFFF"]);
    var awayC = pairColours(away, ["#E5484D", "#111318"]);
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

    var phase = reduce ? 0.35 : 0;
    var homeX = 120;
    var awayX = 280;

    function poseFor(side, t) {
      var cycle = t % 1;
      if (cycle < 0.25) return side === "home" ? "run" : "run";
      if (cycle < 0.45) return "mark";
      if (cycle < 0.7) return "kick";
      return "run";
    }

    function paint(t) {
      var sec = t / 1000;
      phase = reduce ? 0.35 : (sec * 0.08) % 1;
      var swing = reduce ? 0 : Math.sin(sec * 3.2);
      homeX = 95 + swing * 22 + Math.sin(sec * 1.1) * 8;
      awayX = 305 - swing * 22 - Math.sin(sec * 1.3 + 1) * 8;
      var ballT = reduce ? 0.4 : (sec * 0.11) % 1;
      var bx = 200 + Math.sin(ballT * Math.PI) * 95;
      var by = 95 - Math.sin(ballT * Math.PI) * 55;
      var homePose = poseFor("home", phase);
      var awayPose = poseFor("away", phase + 0.48);
      scene.innerHTML =
        stick(homeC, homeX, 128, 1, homePose) +
        stick(awayC, awayX, 128, 1, awayPose) +
        '<ellipse cx="' +
        bx.toFixed(1) +
        '" cy="' +
        by.toFixed(1) +
        '" rx="5" ry="3.2" fill="#C45A1A" stroke="#8B3A12" stroke-width=".8"/>';
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

  var API = { afl: afl, pairColours: pairColours };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
