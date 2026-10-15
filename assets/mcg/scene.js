/* Draws the MCG and plays a goal: camera move, ball through the sticks, trail. */
(function (root) {
  "use strict";

  var FIELD = (root && root.TBMcgField) || (typeof require === "function" ? require("./field.js") : null);
  var GOALS = (root && root.TBMcgGoals) || (typeof require === "function" ? require("./goals.js") : null);
  var GL = (root && root.TBMcgGl) || (typeof require === "function" ? require("./gl.js") : null);
  var BUILD = (root && root.TBMcgBuild) || (typeof require === "function" ? require("./build.js") : null);

  var TO_MS = 1000;
  var FLIGHT_MS = 1700;
  var HOLD_MS = 280;
  var BACK_MS = 1100;
  var GRASS = [0.17, 0.45, 0.22];

  function nowMs() {
    return root.performance && root.performance.now ? root.performance.now() : Date.now();
  }

  function prefersReduced() {
    try {
      return !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch (e) {
      return false;
    }
  }

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function ease(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerp3(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  function translation(x, y, z) {
    var m = GL.identity();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  }

  function rotX(a) {
    var c = Math.cos(a);
    var s = Math.sin(a);
    var m = GL.identity();
    m[5] = c;
    m[6] = s;
    m[9] = -s;
    m[10] = c;
    return m;
  }

  function canvasOf(w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function callOpt(v) {
    return typeof v === "function" ? v() : v;
  }

  function loadImage(url, token) {
    return new Promise(function (resolve) {
      if (!url || typeof document === "undefined") return resolve(null);
      var auth = String(url).indexOf("/api/") >= 0;
      if (auth && typeof fetch === "function") {
        var headers = {};
        var tok = callOpt(token);
        if (tok) headers.Authorization = "Bearer " + tok;
        fetch(url, { headers: headers }).then(function (r) {
          if (!r.ok) throw new Error("miss");
          return r.blob();
        }).then(function (blob) {
          var img = new Image();
          var obj = URL.createObjectURL(blob);
          img.onload = function () {
            URL.revokeObjectURL(obj);
            resolve(img);
          };
          img.onerror = function () {
            URL.revokeObjectURL(obj);
            resolve(null);
          };
          img.src = obj;
        }).catch(function () { resolve(null); });
        return;
      }
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  function coverDraw(ctx, img, w, h) {
    var ir = img.width / Math.max(1, img.height);
    var cr = w / Math.max(1, h);
    var dw, dh, dx, dy;
    if (ir > cr) {
      dh = h;
      dw = h * ir;
      dx = (w - dw) / 2;
      dy = 0;
    } else {
      dw = w;
      dh = w / ir;
      dx = 0;
      dy = (h - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function tintGrass(ctx, w, h) {
    var img;
    try { img = ctx.getImageData(0, 0, w, h); } catch (e) { return; }
    var d = img.data;
    var gr = 0.82 + 0.18 * GRASS[0];
    var gg = 0.82 + 0.18 * GRASS[1];
    var gb = 0.82 + 0.18 * GRASS[2];
    var i;
    for (i = 0; i < d.length; i += 4) {
      d[i] = d[i] * gr;
      d[i + 1] = d[i + 1] * gg;
      d[i + 2] = d[i + 2] * gb;
    }
    ctx.putImageData(img, 0, 0);
  }

  function paintGrass(ctx) {
    var w = ctx.canvas.width;
    var h = ctx.canvas.height;
    var bands = 42;
    var i, y0, y1;
    for (i = 0; i < bands; i++) {
      y0 = Math.floor(i * h / bands);
      y1 = Math.floor((i + 1) * h / bands);
      ctx.fillStyle = i % 2 === 0 ? "#1c6a32" : "#2f8f45";
      ctx.fillRect(0, y0, w, y1 - y0);
    }
  }

  function worldX(x, w) {
    return ((x + FIELD.RX) / (2 * FIELD.RX)) * w;
  }

  function worldY(z, h) {
    return ((z + FIELD.RZ) / (2 * FIELD.RZ)) * h;
  }

  function paintMarks(ctx) {
    var w = ctx.canvas.width;
    var h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, (FIELD.BOUNDARY_X / FIELD.RX) * w / 2, (FIELD.BOUNDARY_Z / FIELD.RZ) * h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeRect(worldX(-25, w), worldY(-25, h), worldX(25, w) - worldX(-25, w), worldY(25, h) - worldY(-25, h));
    function circle(r) {
      ctx.beginPath();
      ctx.ellipse(worldX(0, w), worldY(0, h), (r / FIELD.RX) * w / 2, (r / FIELD.RZ) * h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    circle(5);
    circle(1.5);
    ctx.beginPath();
    ctx.moveTo(worldX(-8, w), worldY(0, h));
    ctx.lineTo(worldX(8, w), worldY(0, h));
    ctx.stroke();
    var ends = [-1, 1];
    var e, a0, a1;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, (FIELD.BOUNDARY_X / FIELD.RX) * w / 2, (FIELD.BOUNDARY_Z / FIELD.RZ) * h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    for (e = 0; e < ends.length; e++) {
      var gx = ends[e] * FIELD.GOAL_X;
      var cx = worldX(gx, w);
      var cy = worldY(0, h);
      var rx = (FIELD.ARC_R / FIELD.RX) * w / 2;
      var ry = (FIELD.ARC_R / FIELD.RZ) * h / 2;
      a0 = ends[e] > 0 ? Math.PI / 2 : -Math.PI / 2;
      a1 = ends[e] > 0 ? Math.PI * 1.5 : Math.PI / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, a0, a1);
      ctx.stroke();
    }
    ctx.restore();
    for (e = 0; e < ends.length; e++) {
      var sign = ends[e];
      var x0 = sign > 0 ? FIELD.GOAL_X - 9 : -FIELD.GOAL_X;
      var x1 = sign > 0 ? FIELD.GOAL_X : -FIELD.GOAL_X + 9;
      ctx.strokeRect(worldX(Math.min(x0, x1), w), worldY(-FIELD.POST_HALF, h), Math.abs(worldX(x1, w) - worldX(x0, w)), worldY(FIELD.POST_HALF, h) - worldY(-FIELD.POST_HALF, h));
      ctx.beginPath();
      ctx.moveTo(worldX(sign * FIELD.GOAL_X, w), worldY(-FIELD.BEHIND, h));
      ctx.lineTo(worldX(sign * FIELD.GOAL_X, w), worldY(FIELD.BEHIND, h));
      ctx.stroke();
    }
  }

  function paintCrowd(ctx) {
    var w = ctx.canvas.width;
    var h = ctx.canvas.height;
    ctx.fillStyle = "#243044";
    ctx.fillRect(0, 0, w, h);
    var colours = ["#c23b3b", "#1d4e89", "#e2c14a", "#d8dde6", "#2f6b4f", "#8a5a2a"];
    var x, y, i;
    i = 0;
    for (y = 2; y < h; y += 4) {
      for (x = 1; x < w; x += 3) {
        ctx.fillStyle = colours[(x * 3 + y * 5) % colours.length];
        ctx.fillRect(x, y + (i % 2), 2, 2);
        i++;
      }
    }
  }

  function paintLamps(ctx) {
    var w = ctx.canvas.width;
    var h = ctx.canvas.height;
    ctx.fillStyle = "#1a1c22";
    ctx.fillRect(0, 0, w, h);
    var x, y;
    for (y = 4; y < h; y += 10) {
      for (x = 4; x < w; x += 10) {
        ctx.fillStyle = "#fff6d2";
        ctx.fillRect(x, y, 6, 5);
      }
    }
  }

  function paintBoard(ctx, slide, img) {
    var w = ctx.canvas.width;
    var h = ctx.canvas.height;
    ctx.fillStyle = (slide && slide.bg) || "#10233f";
    ctx.fillRect(0, 0, w, h);
    if (img) coverDraw(ctx, img, w, h);
    else {
      ctx.fillStyle = (slide && slide.fg) || "#f4f7fb";
      ctx.font = "700 28px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((slide && (slide.label || slide.sponsor)) || "tipdash", w / 2, h / 2);
    }
  }

  function paintBall(ctx, img) {
    var w = ctx.canvas.width;
    var h = ctx.canvas.height;
    ctx.fillStyle = "#b4371f";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#f4efe6";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.5);
    ctx.lineTo(w * 0.82, h * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.22);
    ctx.lineTo(w * 0.5, h * 0.78);
    ctx.stroke();
    if (img) {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      roundRect(ctx, w * 0.28, h * 0.3, w * 0.44, h * 0.4, 10);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, w * 0.3, h * 0.32, w * 0.4, h * 0.36, 8);
      ctx.clip();
      coverDraw(ctx, img, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = "#f4f7fb";
      ctx.font = "700 22px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("tipdash", w / 2, h * 0.72);
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function paintDisc(ctx, spec) {
    var w = ctx.canvas.width;
    var h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = spec.primary || "#16351f";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = spec.secondary || "#f4f6fa";
    ctx.lineWidth = w * 0.06;
    ctx.stroke();
    ctx.fillStyle = spec.secondary || "#f4f6fa";
    ctx.font = "700 " + Math.floor(w * 0.28) + "px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(spec.label || "").slice(0, 3), w / 2, h / 2);
  }

  function ribbonGeometry(points) {
    var empty = {
      positions: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
      uvs: [0, 0, 1, 0, 0, 1],
      colors: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      indices: [0, 0, 0]
    };
    var n = points.length;
    if (n < 2) return empty;
    var positions = [];
    var normals = [];
    var uvs = [];
    var colors = [];
    var indices = [];
    var half = 0.32;
    var left = [];
    var right = [];
    var i;
    for (i = 0; i < n; i++) {
      var prev = points[Math.max(0, i - 1)];
      var next = points[Math.min(n - 1, i + 1)];
      var dx = next.x - prev.x;
      var dy = next.y - prev.y;
      var dz = next.z - prev.z;
      var len = Math.hypot(dx, dy, dz) || 1;
      dx /= len;
      dy /= len;
      dz /= len;
      var sx = -dz;
      var sy = 0;
      var sz = dx;
      var sl = Math.hypot(sx, sy, sz) || 1;
      sx = sx / sl * half;
      sy = sy / sl * half;
      sz = sz / sl * half;
      var fade = i / (n - 1);
      var col = [0.35 + 0.65 * fade, 0.28 + 0.62 * fade, 0.16 + 0.5 * fade];
      var p = points[i];
      left.push(positions.length / 3);
      positions.push(p.x - sx, p.y + 0.05, p.z - sz);
      normals.push(0, 1, 0);
      uvs.push(0, fade);
      colors.push(col[0], col[1], col[2]);
      right.push(positions.length / 3);
      positions.push(p.x + sx, p.y + 0.05, p.z + sz);
      normals.push(0, 1, 0);
      uvs.push(1, fade);
      colors.push(col[0], col[1], col[2]);
    }
    for (i = 0; i < n - 1; i++) {
      indices.push(left[i], right[i], right[i + 1], left[i], right[i + 1], left[i + 1]);
    }
    return { positions: positions, normals: normals, uvs: uvs, colors: colors, indices: indices };
  }

  function goalCamera(end) {
    var sign = end === "west" ? -1 : 1;
    return { eye: [sign * 48, 12, 26], target: [sign * 84, 4.5, 0] };
  }

  function slotSpec(preset, row) {
    if (!row) return preset;
    var w = Number(row.w) || preset.w;
    var h = Number(row.h) || preset.h;
    return {
      id: preset.id,
      type: preset.type,
      disc: preset.disc,
      x: row.x != null && row.w ? Number(row.x) : preset.x,
      z: row.z != null && row.h ? Number(row.z) : preset.z,
      w: w,
      h: h,
      rot: row.rot != null ? Number(row.rot) : preset.rot
    };
  }

  function mount(canvas, opts) {
    opts = opts || {};
    var dead = {
      failed: true,
      playGoal: function () { return false; },
      dispose: function () {},
      setBoards: function () {},
      setGround: function () {},
      setEmblem: function () {},
      setBallSponsor: function () {},
      drag: function () {},
      zoom: function () {},
      info: function () { return { failed: true }; }
    };
    if (!canvas || !GL || !BUILD || !FIELD || typeof document === "undefined") return dead;
    var gl = GL.create(canvas, { maxDpr: 1.5 });
    if (!gl) return dead;

    var built = BUILD.stadium();
    var handles = {};
    var byName = {};
    var i;
    for (i = 0; i < built.meshes.length; i++) {
      var handle = gl.mesh(built.meshes[i]);
      if (handle.slotId) handles[handle.slotId] = handle;
      byName[handle.name] = handle;
    }

    var grass = canvasOf(512, 512);
    paintGrass(grass.getContext("2d"));
    var marks = canvasOf(1024, 1024);
    paintMarks(marks.getContext("2d"));
    var crowd = canvasOf(128, 64);
    paintCrowd(crowd.getContext("2d"));
    var lamps = canvasOf(64, 32);
    paintLamps(lamps.getContext("2d"));
    var boardCanvas = canvasOf(512, 64);
    var ballCanvas = canvasOf(256, 128);
    paintBall(ballCanvas.getContext("2d"), null);

    if (byName.Pitch) byName.Pitch.texture = gl.texture(grass, "clamp");
    if (byName.Markings) byName.Markings.texture = gl.texture(marks, "clamp");
    if (byName.Seats) byName.Seats.texture = gl.texture(crowd, "repeat");
    if (byName.Lamps) byName.Lamps.texture = gl.texture(lamps, "clamp");
    var boardTex = gl.texture(boardCanvas, "repeat");
    if (byName.Boards) byName.Boards.texture = boardTex;
    var ballTex = gl.texture(ballCanvas, "clamp");
    if (byName.Ball) {
      byName.Ball.texture = ballTex;
      byName.Ball.visible = false;
    }

    var trail = gl.mesh({
      name: "Trail",
      positions: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
      uvs: [0, 0, 1, 0, 0, 1],
      colors: [1, 1, 1, 1, 1, 1, 1, 1, 1],
      indices: [0, 0, 0],
      transparent: true,
      alpha: 0.9,
      depthWrite: false,
      emissive: 0.35
    });
    trail.visible = false;

    var yaw = 0.18;
    var pitch = 0.48;
    var radius = 188;
    var orbitTarget = [0, 10, 0];
    var eye = [0, 80, 170];
    var look = orbitTarget.slice();
    var slides = [];
    var slideAt = 0;
    var slideT = 0;
    var slideGen = 0;
    var queue = [];
    var shot = null;
    var raf = 0;
    var stopped = false;
    var last = nowMs();
    var ballGen = 0;
    var slotGen = {};

    function nightOn() {
      if (typeof opts.night === "function") return !!opts.night();
      if (opts.night != null) return !!opts.night;
      return !!(root.TBTime && root.TBTime.isDaytime && !root.TBTime.isDaytime());
    }

    function orbitEye() {
      var cp = Math.cos(pitch);
      var sp = Math.sin(pitch);
      return [
        orbitTarget[0] + radius * cp * Math.sin(yaw),
        orbitTarget[1] + radius * sp,
        orbitTarget[2] + radius * cp * Math.cos(yaw)
      ];
    }

    function applyCamera(nextEye, nextTarget) {
      eye = nextEye;
      look = nextTarget;
      gl.setCamera(eye, look, 36);
    }

    function applyOrbit() {
      applyCamera(orbitEye(), orbitTarget.slice());
    }

    function fallbackSlides() {
      return [
        { label: "tipdash", bg: "#10233f", fg: "#f4f7fb", duration: 6, scroll: 0.12 },
        { label: "MCG", bg: "#0e3b24", fg: "#f4f7fb", duration: 6, scroll: 0.12 }
      ];
    }

    function drawSlide(slide, img) {
      paintBoard(boardCanvas.getContext("2d"), slide, img);
      gl.refresh(boardTex, boardCanvas);
    }

    function showSlide(index) {
      var slide = slides[index];
      if (!slide) return;
      var gen = ++slideGen;
      if (!slide.image) {
        drawSlide(slide, null);
        return;
      }
      loadImage(slide.image, opts.token).then(function (img) {
        if (gen !== slideGen || stopped) return;
        drawSlide(slide, img);
      });
    }

    function setBoards(next) {
      slides = next && next.length ? next.slice() : fallbackSlides();
      slideAt = 0;
      slideT = 0;
      if (byName.Boards) byName.Boards.scroll = 0;
      showSlide(0);
    }

    function tickBoards(dt) {
      var slide = slides[slideAt];
      if (!slide || !byName.Boards) return;
      byName.Boards.scroll += (slide.scroll != null ? slide.scroll : 0.15) * dt;
      slideT += dt;
      var dur = slide.duration > 0 ? slide.duration : 8;
      if (slides.length > 1 && slideT >= dur) {
        slideT = 0;
        slideAt = (slideAt + 1) % slides.length;
        showSlide(slideAt);
      }
    }

    function paintSlot(id, draw) {
      var handle = handles[id];
      if (!handle) return;
      var art = canvasOf(256, 256);
      draw(art.getContext("2d"), art);
      if (!handle.texture) handle.texture = gl.texture(art, "clamp");
      else gl.refresh(handle.texture, art);
      handle.alpha = 0.85;
      handle.visible = true;
    }

    function setGround(rows) {
      var list = Array.isArray(rows) ? rows : [];
      var n;
      for (n = 0; n < list.length; n++) {
        (function (row) {
          var preset = FIELD.slotById(row.id);
          if (!preset || !row.url) return;
          var spec = slotSpec(preset, row);
          var handle = handles[preset.id];
          if (handle) {
            var corners = FIELD.slotCorners(spec);
            var flat = [];
            var k;
            for (k = 0; k < corners.length; k++) flat.push(corners[k][0], corners[k][1], corners[k][2]);
            handle.setPositions(flat);
            if (row.opacity != null && isFinite(Number(row.opacity))) handle.alpha = Number(row.opacity);
          }
          var gen = (slotGen[preset.id] || 0) + 1;
          slotGen[preset.id] = gen;
          loadImage(row.url, opts.token).then(function (img) {
            if (slotGen[preset.id] !== gen || stopped || !img) return;
            paintSlot(preset.id, function (ctx, art) {
              ctx.clearRect(0, 0, art.width, art.height);
              coverDraw(ctx, img, art.width, art.height);
              tintGrass(ctx, art.width, art.height);
            });
            if (row.opacity != null && handles[preset.id]) handles[preset.id].alpha = Number(row.opacity);
          });
        })(list[n]);
      }
    }

    function setEmblem(side, spec) {
      spec = spec || {};
      var id = side === "away" ? "emblem-away" : "emblem-home";
      var gen = (slotGen[id] || 0) + 1;
      slotGen[id] = gen;
      function drawDisc() {
        if (slotGen[id] !== gen) return;
        paintSlot(id, function (ctx, art) { paintDisc(ctx, spec); });
      }
      if (spec.url) {
        loadImage(spec.url, opts.token).then(function (img) {
          if (slotGen[id] !== gen || stopped) return;
          if (!img) return drawDisc();
          paintSlot(id, function (ctx, art) {
            ctx.clearRect(0, 0, art.width, art.height);
            coverDraw(ctx, img, art.width, art.height);
            tintGrass(ctx, art.width, art.height);
          });
        });
        return;
      }
      drawDisc();
    }

    function setBallSponsor(url, token) {
      var gen = ++ballGen;
      if (!url) {
        paintBall(ballCanvas.getContext("2d"), null);
        gl.refresh(ballTex, ballCanvas);
        return;
      }
      loadImage(url, token || opts.token).then(function (img) {
        if (gen !== ballGen || stopped) return;
        paintBall(ballCanvas.getContext("2d"), img);
        gl.refresh(ballTex, ballCanvas);
      });
    }

    function placeBall(p, spin) {
      if (!byName.Ball) return;
      byName.Ball.visible = true;
      byName.Ball.model = GL.multiply(translation(p.x, p.y, p.z), rotX(spin || 0));
    }

    function hideBall() {
      if (byName.Ball) byName.Ball.visible = false;
      trail.visible = false;
    }

    function pushTrail(p) {
      if (!shot) return;
      var lastP = shot.trail[shot.trail.length - 1];
      if (lastP && Math.hypot(p.x - lastP.x, p.y - lastP.y, p.z - lastP.z) < 0.45) return;
      shot.trail.push({ x: p.x, y: p.y, z: p.z });
      if (shot.trail.length > 24) shot.trail.shift();
      trail.setGeometry(ribbonGeometry(shot.trail));
      trail.visible = shot.trail.length > 1;
    }

    function finishShot() {
      hideBall();
      shot = null;
      if (queue.length) beginShot(queue.shift());
      else applyOrbit();
    }

    function beginShot(job) {
      var end = job.end === "west" ? "west" : "east";
      var goal = goalCamera(end);
      var fromEye = eye.slice();
      var fromTarget = look.slice();
      shot = {
        end: end,
        goalEye: goal.eye,
        goalTarget: goal.target,
        fromEye: fromEye,
        fromTarget: fromTarget,
        phase: "to",
        phaseStart: nowMs(),
        trail: [],
        reduced: prefersReduced()
      };
      if (job.ballSponsorUrl) setBallSponsor(job.ballSponsorUrl, opts.token);
      placeBall(GOALS.sampleFlight(end, 0), 0);
      trail.visible = false;
      if (shot.reduced) {
        applyCamera(goal.eye, goal.target);
        placeBall(GOALS.sampleFlight(end, 0.81), 0);
        shot.phase = "hold";
        shot.phaseStart = nowMs();
      }
    }

    function stepShot() {
      if (!shot) return;
      var elapsed = nowMs() - shot.phaseStart;
      if (shot.phase === "to") {
        var t = ease(Math.min(1, elapsed / TO_MS));
        applyCamera(lerp3(shot.fromEye, shot.goalEye, t), lerp3(shot.fromTarget, shot.goalTarget, t));
        if (elapsed >= TO_MS) {
          shot.phase = "flight";
          shot.phaseStart = nowMs();
          shot.trail = [];
        }
      } else if (shot.phase === "flight") {
        applyCamera(shot.goalEye, shot.goalTarget);
        var u = Math.min(1, elapsed / FLIGHT_MS);
        var p = GOALS.sampleFlight(shot.end, u);
        placeBall(p, u * 11);
        if (!shot.reduced) pushTrail(p);
        if (elapsed >= FLIGHT_MS) {
          shot.phase = "hold";
          shot.phaseStart = nowMs();
        }
      } else if (shot.phase === "hold") {
        var hold = shot.reduced ? 400 : HOLD_MS;
        if (elapsed >= hold) {
          shot.phase = "back";
          shot.phaseStart = nowMs();
          shot.backEye = orbitEye();
          shot.backTarget = orbitTarget.slice();
          hideBall();
        }
      } else if (shot.phase === "back") {
        var span = shot.reduced ? 1 : BACK_MS;
        var b = shot.reduced ? 1 : ease(Math.min(1, elapsed / span));
        applyCamera(lerp3(shot.goalEye, shot.backEye, b), lerp3(shot.goalTarget, shot.backTarget, b));
        if (elapsed >= span) finishShot();
      }
    }

    function playGoal(job) {
      job = job || {};
      var next = {
        end: job.end === "west" ? "west" : "east",
        team: job.team || "",
        teamName: job.teamName || "",
        ballSponsorUrl: job.ballSponsorUrl || ""
      };
      if (shot) queue.push(next);
      else beginShot(next);
      return true;
    }

    function frame(t) {
      if (stopped) return;
      var dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
      last = t;
      var hidden = false;
      try { hidden = document.hidden; } catch (e) {}
      if (!hidden) {
        var night = nightOn();
        gl.setNight(night);
        if (byName.Boards) byName.Boards.emissive = night ? 1 : 0.55;
        if (byName.Lamps) byName.Lamps.emissive = night ? 1 : 0.3;
        tickBoards(dt);
        if (shot) stepShot();
        else applyOrbit();
        gl.draw();
      }
      raf = root.requestAnimationFrame(frame);
    }

    setBoards(null);
    applyOrbit();
    gl.setNight(nightOn());
    gl.draw();
    raf = root.requestAnimationFrame(frame);

    return {
      failed: false,
      playGoal: playGoal,
      dispose: function () {
        stopped = true;
        if (raf) root.cancelAnimationFrame(raf);
        gl.dispose();
      },
      setBoards: setBoards,
      setGround: setGround,
      setEmblem: setEmblem,
      setBallSponsor: setBallSponsor,
      drag: function (dx, dy) {
        if (shot) return;
        yaw -= dx * 0.005;
        pitch = clamp(pitch + dy * 0.0035, 0.18, 1.2);
      },
      zoom: function (delta) {
        if (shot) return;
        radius = clamp(radius * (delta > 0 ? 1.08 : 0.92), 42, 340);
      },
      info: function () {
        return { triangles: built.triangles, boardLength: built.boardLength, dprCap: gl.dprCap };
      }
    };
  }

  var api = { mount: mount };

  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TBMcgScene = api;
  if (root && root.TD && root.TD.loaded) root.TD.loaded["mcg/scene"] = true;
})(typeof window !== "undefined" ? window : globalThis);
