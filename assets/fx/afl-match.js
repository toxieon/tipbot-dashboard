/* Live AFL cartoon stick-figure scene. window.TBLiveFx.afl + shared stop(). */
(function (root, factory) {
  var base = root && root.TBLiveFx ? root.TBLiveFx : {};
  var api = factory(base);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBLiveFx = api;
})(typeof window !== "undefined" ? window : globalThis, function (TBLiveFx) {
  "use strict";

  var hub = TBLiveFx._hub || { active: null };
  TBLiveFx._hub = hub;

  var raf =
    (typeof requestAnimationFrame === "function" && requestAnimationFrame) ||
    function (f) {
      return setTimeout(function () {
        f(Date.now());
      }, 16);
    };
  var caf =
    (typeof cancelAnimationFrame === "function" && cancelAnimationFrame) ||
    (typeof clearTimeout === "function" && clearTimeout) ||
    function () {};

  function nowMs() {
    if (typeof performance !== "undefined" && performance.now) return performance.now();
    return Date.now();
  }

  function reducedMotion() {
    if (TBLiveFx.reducedMotion) return TBLiveFx.reducedMotion();
    try {
      if (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    } catch (e) {}
    return false;
  }

  function pairColours(home, away) {
    function norm(p) {
      if (!p) return ["#0d3b66", "#f4d35e"];
      if (Array.isArray(p)) return p.length >= 2 ? [String(p[0]), String(p[1])] : [String(p[0]), String(p[0])];
      return [String(p.primary || p[0] || "#0d3b66"), String(p.secondary || p[1] || "#f4d35e")];
    }
    return { home: norm(home), away: norm(away) };
  }

  function escNum(n) {
    var x = Number(n);
    if (!Number.isFinite(x)) return "0";
    return String(x);
  }

  function stick(x, y, primary, secondary, pose) {
    var arm = pose === "mark" ? -18 : pose === "kick" ? 14 : 8;
    var leg = pose === "run" ? 10 : pose === "mark" ? -6 : 4;
    return (
      '<g transform="translate(' +
      escNum(x) +
      "," +
      escNum(y) +
      ')">' +
      '<line x1="0" y1="-4" x2="0" y2="22" stroke="' +
      secondary +
      '" stroke-width="3" stroke-linecap="round"/>' +
      '<line x1="0" y1="4" x2="' +
      escNum(arm) +
      '" y2="-6" stroke="' +
      primary +
      '" stroke-width="3" stroke-linecap="round"/>' +
      '<line x1="0" y1="4" x2="' +
      escNum(-arm * 0.6) +
      '" y2="2" stroke="' +
      primary +
      '" stroke-width="3" stroke-linecap="round"/>' +
      '<line x1="0" y1="22" x2="' +
      escNum(leg) +
      '" y2="36" stroke="' +
      secondary +
      '" stroke-width="3" stroke-linecap="round"/>' +
      '<line x1="0" y1="22" x2="' +
      escNum(-leg) +
      '" y2="36" stroke="' +
      secondary +
      '" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="0" cy="-12" r="7" fill="' +
      primary +
      '"/>' +
      "</g>"
    );
  }

  function disposeRun(run) {
    if (!run) return;
    if (run.rafId) caf(run.rafId);
    if (run.vis && typeof document !== "undefined" && document.removeEventListener) {
      document.removeEventListener("visibilitychange", run.vis);
    }
    if (run.root && run.root.parentNode) run.root.parentNode.removeChild(run.root);
  }

  if (!TBLiveFx.stop) {
    TBLiveFx.stop = function () {
      disposeRun(hub.active);
      hub.active = null;
    };
  }

  function afl(el, home, away) {
    TBLiveFx.stop();
    if (!el) return;
    var cols = pairColours(home, away);

    var host = document.createElement("div");
    host.className = "tb-fx-afl";
    host.setAttribute("role", "img");
    host.setAttribute("aria-label", "AFL match animation");
    host.style.cssText =
      "position:relative;width:100%;max-width:640px;margin:0 auto;aspect-ratio:16/10;overflow:hidden;border-radius:12px;background:radial-gradient(ellipse at center,#3f7f46 0%,#2d5f34 70%,#1e4024 100%);";
    el.appendChild(host);

    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 640 400");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.display = "block";
    host.appendChild(svg);

    var scene = document.createElementNS(svgNS, "g");
    scene.innerHTML =
      '<ellipse cx="320" cy="210" rx="250" ry="150" fill="none" stroke="#e8f0e6" stroke-width="3" opacity="0.85"/>' +
      '<ellipse cx="320" cy="210" rx="90" ry="54" fill="none" stroke="#e8f0e6" stroke-width="2" opacity="0.5"/>' +
      '<line x1="320" y1="60" x2="320" y2="360" stroke="#e8f0e6" stroke-width="2" opacity="0.35"/>';
    svg.appendChild(scene);

    var actors = document.createElementNS(svgNS, "g");
    svg.appendChild(actors);

    var ball = document.createElementNS(svgNS, "ellipse");
    ball.setAttribute("rx", "7");
    ball.setAttribute("ry", "5");
    ball.setAttribute("fill", "#c45b1e");
    svg.appendChild(ball);

    var homeSlots = [
      { x: 180, y: 170, pose: "run" },
      { x: 220, y: 230, pose: "mark" },
      { x: 250, y: 150, pose: "kick" },
      { x: 200, y: 280, pose: "run" },
      { x: 260, y: 300, pose: "run" },
    ];
    var awaySlots = [
      { x: 460, y: 180, pose: "run" },
      { x: 420, y: 240, pose: "mark" },
      { x: 390, y: 160, pose: "kick" },
      { x: 440, y: 290, pose: "run" },
      { x: 400, y: 310, pose: "run" },
    ];

    var run = {
      root: host,
      rafId: 0,
      t0: nowMs(),
      paused: false,
      hidden: false,
      actors: actors,
      ball: ball,
    };

    function paintStatic() {
      var bits = [];
      homeSlots.forEach(function (s) {
        bits.push(stick(s.x, s.y, cols.home[0], cols.home[1], s.pose));
      });
      awaySlots.forEach(function (s) {
        bits.push(stick(s.x, s.y, cols.away[0], cols.away[1], s.pose));
      });
      actors.innerHTML = bits.join("");
      ball.setAttribute("cx", "320");
      ball.setAttribute("cy", "200");
    }

    if (reducedMotion()) {
      paintStatic();
      hub.active = run;
      return;
    }

    function frame() {
      if (run.paused || run.hidden) {
        run.rafId = raf(frame);
        return;
      }
      var t = (nowMs() - run.t0) / 1000;
      var cycle = (Math.sin(t * 0.55) + 1) / 2;
      var side = cycle < 0.5 ? "home" : "away";
      var local = cycle < 0.5 ? cycle * 2 : (cycle - 0.5) * 2;
      var bx = 200 + local * 240;
      var by = 190 - Math.sin(local * Math.PI) * 70;
      ball.setAttribute("cx", escNum(bx));
      ball.setAttribute("cy", escNum(by));

      var bits = [];
      homeSlots.forEach(function (s, i) {
        var jog = Math.sin(t * 4 + i) * 5;
        var pose = side === "home" && i === 1 ? "mark" : side === "home" && i === 2 ? "kick" : "run";
        bits.push(stick(s.x + jog, s.y + Math.cos(t * 3 + i) * 3, cols.home[0], cols.home[1], pose));
      });
      awaySlots.forEach(function (s, i) {
        var jog = Math.sin(t * 4.2 + i + 2) * 5;
        var pose = side === "away" && i === 1 ? "mark" : side === "away" && i === 2 ? "kick" : "run";
        bits.push(stick(640 - (s.x + jog), s.y + Math.cos(t * 3.1 + i) * 3, cols.away[0], cols.away[1], pose));
      });
      actors.innerHTML = bits.join("");

      run.rafId = raf(frame);
    }

    run.vis = function () {
      run.hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      run.paused = run.hidden;
    };
    if (typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", run.vis);
      run.vis();
    }

    run.rafId = raf(frame);
    hub.active = run;
  }

  TBLiveFx.afl = afl;
  return TBLiveFx;
});
