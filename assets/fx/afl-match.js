/* afl-match.js — ambient AFL oval loop (stick figures, no score).
 * TBLiveFx.afl(el, home, away)  each: { primary, secondary } | [primary, secondary]
 * TBLiveFx.stop()
 */
(function (root) {
  "use strict";
  var w = root || (typeof globalThis !== "undefined" ? globalThis : {});
  var fx = w.TBLiveFx || (w.TBLiveFx = {});

  var raf = (w.requestAnimationFrame && w.requestAnimationFrame.bind(w)) || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
  var caf = (w.cancelAnimationFrame && w.cancelAnimationFrame.bind(w)) || clearTimeout;

  function mqReduce() {
    try { return !!(w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
  }

  function pairColours(c, fallback) {
    var fb = fallback || ["#0a2240", "#ffd100"];
    if (!c) return fb;
    if (Array.isArray(c)) return [c[0] || fb[0], c[1] || fb[1]];
    return [c.primary || fb[0], c.secondary || c.accent || fb[1]];
  }

  function clearHost(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function stopRun() {
    var run = fx._run;
    if (!run) return;
    if (run.rafId) caf(run.rafId);
    run.rafId = 0;
    if (run.onVis && w.document) {
      try { w.document.removeEventListener("visibilitychange", run.onVis); } catch (e) {}
    }
    if (run.onResize && w.removeEventListener) {
      try { w.removeEventListener("resize", run.onResize); } catch (e) {}
    }
    fx._run = null;
  }

  function sizeCanvas(canvas, el) {
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: el.clientWidth || 320, height: el.clientHeight || 200 };
    var dpr = (w.devicePixelRatio && w.devicePixelRatio > 1) ? Math.min(2, w.devicePixelRatio) : 1;
    var W = Math.max(120, Math.floor(rect.width || 320));
    var H = Math.max(100, Math.floor(rect.height || 200));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    if (ctx && dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, W: W, H: H };
  }

  function ovalRect(W, H) {
    var pad = 12;
    return { cx: W * 0.5, cy: H * 0.52, rx: (W - pad * 2) * 0.46, ry: (H - pad * 2) * 0.38 };
  }

  function drawOval(ctx, o) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(o.cx, o.cy, o.rx, o.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.moveTo(o.cx - o.rx * 0.15, o.cy);
    ctx.lineTo(o.cx + o.rx * 0.15, o.cy);
    ctx.stroke();
    ctx.restore();
  }

  function drawStick(ctx, x, y, scale, cols, pose) {
    var s = scale;
    var arm = pose.arm || 0;
    var leg = pose.leg || 0;
    var jump = pose.jump || 0;
    ctx.save();
    ctx.translate(x, y - jump);
    ctx.scale(s, s);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(0, 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(-8 + arm * 6, -4);
    ctx.moveTo(0, -12);
    ctx.lineTo(8 - arm * 6, -4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-6 + leg * 5, 14);
    ctx.moveTo(0, 2);
    ctx.lineTo(6 - leg * 5, 14);
    ctx.stroke();
    ctx.fillStyle = cols[0];
    ctx.fillRect(-7, -10, 14, 12);
    ctx.strokeStyle = cols[1];
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-7, -10, 14, 12);
    ctx.fillStyle = "#f4c9a0";
    ctx.beginPath();
    ctx.arc(0, -18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function makePlayers(homeCols, awayCols) {
    var out = [];
    for (var side = 0; side < 2; side++) {
      var cols = side ? awayCols : homeCols;
      var n = 5;
      for (var i = 0; i < n; i++) {
        out.push({
          side: side,
          cols: cols,
          ang: (side ? Math.PI : 0) + (i - 2) * 0.22,
          dist: 0.55 + (i % 3) * 0.06,
          phase: Math.random() * Math.PI * 2,
          role: i === 2 ? "ruck" : "field",
        });
      }
    }
    return out;
  }

  function playerPos(o, p, t) {
    var wobble = Math.sin(t * 2 + p.phase) * 0.04;
    var ang = p.ang + wobble * (p.side ? -1 : 1);
    var r = p.dist * o.rx;
    var ry = p.dist * o.ry;
    return { x: o.cx + Math.cos(ang) * r, y: o.cy + Math.sin(ang) * ry };
  }

  function drawBall(ctx, bx, by, r) {
    ctx.save();
    ctx.fillStyle = "#c8102e";
    ctx.beginPath();
    ctx.ellipse(bx, by, r, r * 0.92, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawFrame(ctx, W, H, state, t) {
    var grd = ctx.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#4a8f4a");
    grd.addColorStop(1, "#2d6b2d");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
    var o = ovalRect(W, H);
    drawOval(ctx, o);
    var players = state.players;
    var poses = [];
    for (var i = 0; i < players.length; i++) {
      var p = players[i];
      var pos = playerPos(o, p, t + p.phase * 0.1);
      var run = Math.sin(t * 6 + p.phase);
      var mark = state.phase === "mark" && state.markSide === p.side && i === 2;
      poses.push({
        p: p,
        x: pos.x,
        y: pos.y,
        scale: 0.9 + (pos.y - o.cy) / H * 0.3,
        pose: {
          arm: run,
          leg: Math.cos(t * 6 + p.phase),
          jump: mark ? 12 + Math.sin(t * 10) * 2 : (state.kick && i === state.kicker ? 4 : 0),
        },
      });
    }
    poses.sort(function (a, b) { return a.y - b.y; });
    var ball = state.ball;
    if (state.phase !== "ground") {
      drawBall(ctx, ball.x, ball.y, ball.r);
    }
    for (var j = 0; j < poses.length; j++) {
      var ps = poses[j];
      drawStick(ctx, ps.x, ps.y, ps.scale, ps.p.cols, ps.pose);
    }
    if (state.phase === "ground") {
      drawBall(ctx, ball.x, ball.y, ball.r);
    }
  }

  function stepState(state, o, dt, t) {
    var b = state.ball;
    if (state.phase === "arc") {
      b.t += dt * 0.022;
      if (b.t >= 1) {
        b.t = 1;
        state.phase = "mark";
        state.markSide = b.toSide;
        state.markT = 0;
      }
      var u = b.t;
      b.x = b.x0 + (b.x1 - b.x0) * u;
      b.y = b.y0 + (b.y1 - b.y0) * u - Math.sin(u * Math.PI) * b.arc;
    } else if (state.phase === "mark") {
      state.markT += dt;
      b.x = b.x1;
      b.y = b.y1 - 8 - Math.sin(t * 8) * 2;
      if (state.markT > 1.8) {
        state.phase = "kick";
        state.kickT = 0;
        state.kicker = 2;
      }
    } else if (state.phase === "kick") {
      state.kickT += dt;
      b.y = b.y1 - 6 - state.kickT * 4;
      if (state.kickT > 0.35) {
        launchArc(state, o);
      }
    } else {
      b.t += dt * 0.015;
      if (b.t >= 1) launchArc(state, o);
    }
  }

  function launchArc(state, o) {
    var fromSide = state.ball.toSide != null ? state.ball.toSide : 0;
    var toSide = fromSide ? 0 : 1;
    var fromAng = fromSide ? Math.PI * 0.15 : Math.PI * 1.15;
    var toAng = toSide ? Math.PI * 0.12 : Math.PI * 1.12;
    var r0 = 0.35 * o.rx;
    var r1 = 0.42 * o.rx;
    state.ball = {
      x0: o.cx + Math.cos(fromAng) * r0,
      y0: o.cy + Math.sin(fromAng) * r0 * 0.7,
      x1: o.cx + Math.cos(toAng) * r1,
      y1: o.cy + Math.sin(toAng) * r1 * 0.7,
      x: o.cx + Math.cos(fromAng) * r0,
      y: o.cy + Math.sin(fromAng) * r0 * 0.7,
      arc: 28 + Math.random() * 18,
      t: 0,
      toSide: toSide,
      r: 5,
    };
    state.phase = "arc";
    state.kicker = -1;
  }

  function afl(el, home, away) {
    if (!el || !el.appendChild) return null;
    stopRun();
    clearHost(el);
    el.setAttribute("data-tb-live-fx", "afl");
    var canvas = w.document ? w.document.createElement("canvas") : null;
    if (!canvas) return null;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "AFL match animation");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    el.appendChild(canvas);
    var sized = sizeCanvas(canvas, el);
    var ctx = sized.ctx;
    var W = sized.W;
    var H = sized.H;
    if (!ctx) return null;
    var homeCols = pairColours(home, ["#0a2240", "#ffd100"]);
    var awayCols = pairColours(away, ["#cc092f", "#ffffff"]);
    var o = ovalRect(W, H);
    var state = {
      players: makePlayers(homeCols, awayCols),
      phase: "ground",
      ball: { x: o.cx, y: o.cy, r: 5, t: 0 },
      markT: 0,
      kickT: 0,
      kicker: -1,
      markSide: 0,
    };
    launchArc(state, o);
    state.phase = "ground";
    state.ball.t = 0.2;
    var last = (w.performance && w.performance.now) ? w.performance.now() : Date.now();
    var reduced = mqReduce();

    function paintStatic() {
      drawFrame(ctx, W, H, state, 0.5);
    }

    if (reduced) {
      paintStatic();
      fx._run = { kind: "afl", el: el, canvas: canvas, static: true };
      return fx._run;
    }

    var paused = false;
    function onVis() {
      if (!w.document) return;
      paused = w.document.hidden;
      if (!paused && !run.rafId) loop();
    }
    function loop() {
      if (paused) { run.rafId = 0; return; }
      var now = (w.performance && w.performance.now) ? w.performance.now() : Date.now();
      var dt = Math.min(48, now - last) / 16.67;
      last = now;
      var t = now * 0.001;
      stepState(state, ovalRect(W, H), dt, t);
      drawFrame(ctx, W, H, state, t);
      run.rafId = raf(loop);
    }
    function onResize() {
      sized = sizeCanvas(canvas, el);
      ctx = sized.ctx;
      W = sized.W;
      H = sized.H;
    }
    var run = { kind: "afl", el: el, canvas: canvas, rafId: 0, onVis: onVis, onResize: onResize };
    fx._run = run;
    if (w.document) w.document.addEventListener("visibilitychange", onVis);
    if (w.addEventListener) w.addEventListener("resize", onResize);
    loop();
    return run;
  }

  fx.afl = afl;
  fx.stop = stopRun;
  if (typeof module === "object" && module.exports) {
    module.exports = { afl: afl, stop: stopRun, pairColours: pairColours, drawFrame: drawFrame, ovalRect: ovalRect };
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
