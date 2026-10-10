/* race-running.js — ambient "race in progress" canvas loop (generic horses, no results).
 * TBLiveFx.race(el, runners)  runners: [{ number, colours: { primary, secondary } | [p,s] }]
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

  function pairColours(c) {
    if (!c) return ["#6b4e2a", "#f5e6c8"];
    if (Array.isArray(c)) return [c[0] || "#6b4e2a", c[1] || "#f5e6c8"];
    return [c.primary || "#6b4e2a", c.secondary || c.accent || "#f5e6c8"];
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
    var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: el.clientWidth || 320, height: el.clientHeight || 180 };
    var dpr = (w.devicePixelRatio && w.devicePixelRatio > 1) ? Math.min(2, w.devicePixelRatio) : 1;
    var W = Math.max(120, Math.floor(rect.width || 320));
    var H = Math.max(80, Math.floor(rect.height || 180));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    var ctx = canvas.getContext("2d");
    if (ctx && dpr !== 1) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, W: W, H: H };
  }

  function trackGeom(W, H) {
    var pad = 8;
    var topY = pad + H * 0.12;
    var botY = H - pad;
    var skew = W * 0.08;
    return {
      pad: pad,
      topY: topY,
      botY: botY,
      leftTop: pad + skew,
      rightTop: W - pad - skew,
      leftBot: pad,
      rightBot: W - pad,
      laneY: function (t) { return topY + (botY - topY) * t; },
      laneX: function (u, t) {
        var lt = pad + skew * (1 - t);
        var rt = W - pad - skew * (1 - t);
        return lt + (rt - lt) * u;
      },
    };
  }

  function drawTrack(ctx, g, W, railPhase) {
    ctx.save();
    var grd = ctx.createLinearGradient(0, g.topY, 0, g.botY);
    grd.addColorStop(0, "#3d6b35");
    grd.addColorStop(1, "#2a4d24");
    ctx.beginPath();
    ctx.moveTo(g.leftTop, g.topY);
    ctx.lineTo(g.rightTop, g.topY);
    ctx.lineTo(g.rightBot, g.botY);
    ctx.lineTo(g.leftBot, g.botY);
    ctx.closePath();
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    for (var lane = 1; lane < 5; lane++) {
      var t = lane / 5;
      ctx.beginPath();
      ctx.moveTo(g.laneX(0, t), g.laneY(t));
      ctx.lineTo(g.laneX(1, t), g.laneY(t));
      ctx.stroke();
    }
    ctx.strokeStyle = "#e8e0d0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.leftTop - 2, g.topY - 4);
    ctx.lineTo(g.leftBot - 2, g.botY + 2);
    ctx.stroke();
    var posts = 14;
    for (var i = 0; i < posts; i++) {
      var u = ((i / posts) + railPhase) % 1;
      var y = g.laneY(0.02) - 6 + (g.botY - g.topY) * 0.02;
      var x = g.laneX(u, 0.02) - 3;
      ctx.fillStyle = i % 2 ? "#fff" : "#c41e3a";
      ctx.fillRect(x, y, 5, 10);
    }
    ctx.restore();
  }

  function drawHorse(ctx, x, y, scale, num, cols, bob) {
    var s = scale;
    var by = bob * 3;
    ctx.save();
    ctx.translate(x, y + by);
    ctx.scale(s, s);
    ctx.fillStyle = cols[0];
    ctx.strokeStyle = "#1a1208";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.quadraticCurveTo(18, -8, 22, -6);
    ctx.lineTo(24, -2);
    ctx.quadraticCurveTo(20, 2, 12, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1a1208";
    ctx.beginPath();
    ctx.arc(22, -5, 1.8, 0, Math.PI * 2);
    ctx.fill();
    var legPhase = bob * 8;
    ctx.strokeStyle = "#1a1208";
    ctx.lineWidth = 2;
    function leg(lx, phase) {
      ctx.beginPath();
      ctx.moveTo(lx, 6);
      ctx.lineTo(lx + Math.sin(phase) * 4, 14 + Math.cos(phase) * 2);
      ctx.stroke();
    }
    leg(-6, legPhase);
    leg(2, legPhase + 1.2);
    leg(6, legPhase + 2.4);
    leg(10, legPhase + 3.6);
    ctx.fillStyle = cols[1];
    ctx.fillRect(-4, -6, 12, 8);
    ctx.strokeStyle = "#1a1208";
    ctx.strokeRect(-4, -6, 12, 8);
    ctx.fillStyle = "#111";
    ctx.font = "bold 7px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(num), 2, -2);
    ctx.fillStyle = cols[0];
    ctx.beginPath();
    ctx.arc(-2, -14, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4c9a0";
    ctx.beginPath();
    ctx.arc(-2, -16, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function makeHorses(runners) {
    var list = [];
    var n = Math.max(1, Math.min(12, runners && runners.length ? runners.length : 6));
    for (var i = 0; i < n; i++) {
      var r = runners && runners[i] ? runners[i] : { number: i + 1, colours: null };
      var cols = pairColours(r.colours);
      list.push({
        num: r.number != null ? r.number : i + 1,
        cols: cols,
        prog: (i / n) * 0.35 + 0.08,
        speed: 0.018 + (i % 5) * 0.003,
        wobble: Math.random() * Math.PI * 2,
        bob: Math.random() * Math.PI * 2,
        lane: (i % 4) / 4,
      });
    }
    return list;
  }

  function tickHorses(horses, dt) {
    for (var i = 0; i < horses.length; i++) {
      var h = horses[i];
      h.prog += h.speed * dt * (0.85 + 0.3 * Math.sin(h.wobble + dt * 2));
      h.wobble += dt * (1.2 + (i % 3) * 0.2);
      h.bob += dt * 9;
      if (h.prog > 0.92) h.prog = 0.12 + Math.random() * 0.08;
      if (h.prog < 0.05) h.prog = 0.55 + Math.random() * 0.15;
      h.lane += Math.sin(h.wobble * 0.7) * 0.0008 * dt;
      if (h.lane < 0.05) h.lane = 0.05;
      if (h.lane > 0.95) h.lane = 0.95;
    }
  }

  function drawFrame(ctx, W, H, horses, t, railPhase) {
    ctx.clearRect(0, 0, W, H);
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#87b8e8");
    sky.addColorStop(0.45, "#b8d4f0");
    sky.addColorStop(1, "#e8f0e0");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    var g = trackGeom(W, H);
    drawTrack(ctx, g, W, railPhase);
    var order = horses.slice().sort(function (a, b) { return a.prog - b.prog; });
    for (var j = 0; j < order.length; j++) {
      var h = order[j];
      var laneT = 0.15 + h.lane * 0.7;
      var u = 0.08 + h.prog * 0.84;
      var x = g.laneX(u, laneT);
      var y = g.laneY(laneT);
      var scale = 0.75 + laneT * 0.35;
      var bob = Math.sin(h.bob);
      drawHorse(ctx, x, y, scale, h.num, h.cols, bob);
    }
  }

  function race(el, runners) {
    if (!el || !el.appendChild) return null;
    stopRun();
    clearHost(el);
    el.setAttribute("data-tb-live-fx", "race");
    var canvas = w.document ? w.document.createElement("canvas") : null;
    if (!canvas) return null;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Horse race animation");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    el.appendChild(canvas);
    var sized = sizeCanvas(canvas, el);
    var ctx = sized.ctx;
    var W = sized.W;
    var H = sized.H;
    if (!ctx) return null;
    var horses = makeHorses(runners);
    var railPhase = 0;
    var last = (w.performance && w.performance.now) ? w.performance.now() : Date.now();
    var reduced = mqReduce();

    function paintStatic() {
      drawFrame(ctx, W, H, horses, 0, 0.2);
    }

    if (reduced) {
      paintStatic();
      fx._run = { kind: "race", el: el, canvas: canvas, static: true };
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
      railPhase = (railPhase + dt * 0.012) % 1;
      tickHorses(horses, dt);
      drawFrame(ctx, W, H, horses, now * 0.001, railPhase);
      run.rafId = raf(loop);
    }
    function onResize() {
      sized = sizeCanvas(canvas, el);
      ctx = sized.ctx;
      W = sized.W;
      H = sized.H;
    }
    var run = { kind: "race", el: el, canvas: canvas, rafId: 0, onVis: onVis, onResize: onResize };
    fx._run = run;
    if (w.document) w.document.addEventListener("visibilitychange", onVis);
    if (w.addEventListener) w.addEventListener("resize", onResize);
    loop();
    return run;
  }

  fx.race = race;
  fx.stop = stopRun;
  if (typeof module === "object" && module.exports) {
    module.exports = { race: race, stop: stopRun, pairColours: pairColours, drawFrame: drawFrame, makeHorses: makeHorses, trackGeom: trackGeom };
  }
})(typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : this);
