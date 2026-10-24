/* Shared kit for the Game view grounds built in code (basketball court, soccer, NFL,
   baseball, NRL, racecourse, tennis). Ported from the 3D models pack
   (procedural-venues/common.js, three.js MIT) to the Game view handle contract of
   assets/mcg/mount.js:
     mount(host, opts) -> {fallback, venue, cameras, chips, storageKey, cameraId,
       setCamera, resize, setBoards, setLogos, celebrate, stop}
   No orbit controls and no player models (player animation is a separate feature).
   If WebGL can't start, the venue's still (a render from its broadcast camera) stays. */
import * as T from "../vendor/three/three.module.min.js";
import { ledTwoSided } from "../mcg/boards/boards.js";
import { camerasFor, findCamera, cameraAt, tweenProgress, effectiveFov, TWEEN_MS, storageKeyFor } from "../mcg/cameras.js";

export { T };
export var BOARDS_URL = new URL("../mcg/boards/boards.json", import.meta.url).href;

function reducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
}

// Small seeded PRNG so the crowd (and so the still) looks the same every load.
export function rng(seed) {
  var s = seed >>> 0;
  return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function mat(color, o) {
  var opts = {color: color, roughness: 0.8};
  if (o) for (var k in o) opts[k] = o[k];
  return new T.MeshStandardMaterial(opts);
}

export function box(scene, w, h, d, color, x, y, z) {
  var m = new T.Mesh(new T.BoxGeometry(w, h, d), typeof color === "object" ? color : mat(color));
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}

export function canvasPlane(scene, w, d, draw, ppm, y) {
  ppm = ppm || 10;
  var c = document.createElement("canvas");
  c.width = Math.round(w * ppm);
  c.height = Math.round(d * ppm);
  draw(c.getContext("2d"), ppm, c.width, c.height);
  var t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  var m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshStandardMaterial({map: t, roughness: 0.55, metalness: 0.0}));
  m.rotation.x = -Math.PI / 2;
  m.position.y = y == null ? 0.02 : y;
  scene.add(m);
  return m;
}

export function rectPath(w, d) {
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
}

export function ellPath(a, b, n) {
  n = n || 96;
  var out = [];
  for (var i = 0; i < n; i++) out.push([Math.cos(i / n * Math.PI * 2) * a, Math.sin(i / n * Math.PI * 2) * b]);
  return out;
}

var crowdTex = null;
function crowd() {
  if (crowdTex) return crowdTex;
  var c = document.createElement("canvas");
  c.width = 512; c.height = 64;
  var x = c.getContext("2d");
  var r = rng(7);
  x.fillStyle = "#22324a";
  x.fillRect(0, 0, 512, 64);
  var pal = ["#d9d9d9", "#1a1a1a", "#c23b3b", "#e2c044", "#5a7bb8", "#7a5236", "#e8b598", "#3c8c5a"];
  for (var i = 0; i < 900; i++) {
    x.fillStyle = pal[(r() * pal.length) | 0];
    x.fillRect(r() * 512, 8 + r() * 44, 3, 7);
  }
  crowdTex = new T.CanvasTexture(c);
  crowdTex.colorSpace = T.SRGBColorSpace;
  crowdTex.wrapS = T.RepeatWrapping;
  return crowdTex;
}
/** Crowd-faced material for curved stands (baseball, racecourse). */
export function crowdMat(repeat) {
  var t = crowd().clone();
  t.repeat.x = repeat || 1;
  t.needsUpdate = true;
  return new T.MeshStandardMaterial({map: t, roughness: 0.9});
}

var facadeTex = null;
/** Concrete facade with window rows (back of the stands). */
export function facadeMat() {
  if (!facadeTex) {
    var c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    var x = c.getContext("2d");
    x.fillStyle = "#b9bcc2"; x.fillRect(0, 0, 256, 256);
    x.fillStyle = "#9a9ea6";
    for (var y = 0; y < 256; y += 64) x.fillRect(0, y, 256, 6);
    x.fillStyle = "#2c3644";
    for (var yy = 20; yy < 256; yy += 64) for (var xx = 8; xx < 256; xx += 32) x.fillRect(xx, yy, 20, 26);
    facadeTex = new T.CanvasTexture(c);
    facadeTex.colorSpace = T.SRGBColorSpace;
    facadeTex.wrapS = facadeTex.wrapT = T.RepeatWrapping;
    facadeTex.repeat.set(12, 1);
  }
  return new T.MeshStandardMaterial({map: facadeTex, roughness: 0.9});
}

// Four straight stands around a w x d rectangle, stepped rows with a crowd face.
export function standRect(scene, o) {
  var w = o.w, d = o.d, gap = o.gap == null ? 4 : o.gap, rows = o.rows || 10;
  var rowH = o.rowH || 0.8, rowD = o.rowD || 1.0, y0 = o.y0 == null ? 0.5 : o.y0;
  var tex = crowd();
  var g = new T.Group();
  var side = mat(0x8b9097);
  var facade = mat(0x5c626b);
  function add(len, ang, off) {
    for (var k = 0; k < rows; k++) {
      var t = tex.clone();
      t.repeat.x = len / 12;
      t.needsUpdate = true;
      var face = new T.MeshStandardMaterial({map: t, roughness: 0.9});
      var m = new T.Mesh(new T.BoxGeometry(len + k * 2 * rowD, rowH, rowD), [side, side, side, side, face, side]);
      var rr = off + gap + k * rowD;
      m.position.set(Math.sin(ang) * rr, y0 + k * rowH, Math.cos(ang) * rr);
      m.rotation.y = ang + Math.PI;
      g.add(m);
    }
    var H = y0 + rows * rowH, R = off + gap + rows * rowD - rowD / 2 + 0.15, L = len + rows * 2 * rowD;
    var f = new T.Mesh(new T.BoxGeometry(L, H, 0.3), facade);
    f.position.set(Math.sin(ang) * R, H / 2, Math.cos(ang) * R);
    f.rotation.y = ang;
    g.add(f);
  }
  add(w, 0, d / 2);
  add(w, Math.PI, d / 2);
  add(d, Math.PI / 2, w / 2);
  add(d, -Math.PI / 2, w / 2);
  var D = rows * rowD, HH = y0 + rows * rowH;
  for (var sx = -1; sx <= 1; sx += 2) {
    for (var sz = -1; sz <= 1; sz += 2) {
      var corner = new T.Mesh(new T.BoxGeometry(D + gap, HH, D + gap), facade);
      corner.position.set(sx * (w / 2 + (gap + D) / 2), HH / 2, sz * (d / 2 + (gap + D) / 2));
      g.add(corner);
    }
  }
  scene.add(g);
  return g;
}

function loadImage(src) {
  return new Promise(function (resolve) {
    if (!src) return resolve(null);
    var i = new Image();
    i.onload = function () { resolve(i); };
    i.onerror = function () { resolve(null); };
    i.src = src;
  });
}

// LED ribbons along paths, one shared slide texture. Slides from the MCG
// boards.json (house slides), replaced by sponsor banners via setSlides.
export async function ledRibbons(scene, paths, night, cfgUrl) {
  var cfg = {tileMeters: 12, height: 1.4, slides: [{bg: "#0F1420", duration: 6, scroll: 0.35}]};
  try {
    var r = await fetch(cfgUrl || BOARDS_URL);
    if (r.ok) cfg = await r.json();
  } catch (e) {}
  var slides = (cfg.slides || []).slice();
  if (!slides.length) slides = [{bg: "#0F1420", duration: 6}];
  var imgs = await Promise.all(slides.map(function (s) { return loadImage(s.image); }));
  var house = slides.slice(), houseImgs = imgs.slice();
  var cv = document.createElement("canvas");
  cv.width = 1024; cv.height = 120;
  var x = cv.getContext("2d");
  var tex = new T.CanvasTexture(cv);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = T.RepeatWrapping;
  var si = 0, tIn = 0;
  function draw() {
    var s = slides[si] || {}, im = imgs[si];
    x.fillStyle = s.bg || "#000";
    x.fillRect(0, 0, cv.width, cv.height);
    if (im) {
      var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      var h = cv.height * (s.fill ? 1 : 0.8), w = h * iw / ih;
      if (w > cv.width) { w = cv.width; h = w * ih / iw; }
      x.drawImage(im, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
    }
    x.fillStyle = "rgba(0,0,0,0.18)";
    for (var y = 0; y < cv.height; y += 3) x.fillRect(0, y, cv.width, 1);
    tex.needsUpdate = true;
  }
  draw();
  var m = new T.MeshStandardMaterial({color: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: night ? 1.6 : 1.1, side: T.DoubleSide});
  ledTwoSided(m);
  var tile = cfg.tileMeters || 12, baseH = cfg.height || 1.4;
  paths.forEach(function (p) {
    var pts = p.closed ? p.pts.concat([p.pts[0]]) : p.pts;
    var pos = [], uv = [], idx = [], len = 0;
    pts.forEach(function (v, i) {
      if (i) len += Math.hypot(v[0] - pts[i - 1][0], v[1] - pts[i - 1][1]);
      var u = len / (tile * (p.h / baseH));
      pos.push(v[0], p.y, v[1], v[0], p.y + p.h, v[1]);
      uv.push(u, 0, u, 1);
      if (i < pts.length - 1) { var b = i * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    });
    var geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    var mesh = new T.Mesh(geo, m);
    mesh.name = "VenueLED";
    scene.add(mesh);
  });
  async function setSlides(list) {
    var want = (list || []).filter(function (s) { return s && s.image; });
    if (!want.length) { slides = house.slice(); imgs = houseImgs.slice(); si = 0; tIn = 0; draw(); return; }
    var loaded = await Promise.all(want.map(function (s) { return loadImage(s.image); }));
    slides = want.map(function (s) { return {image: s.image, duration: Math.max(2, Number(s.duration) || 8), scroll: Number(s.scroll) || 0, bg: s.bg || "#000", fill: true}; });
    imgs = loaded; si = 0; tIn = 0; tex.offset.x = 0; draw();
  }
  return {
    setSlides: setSlides,
    update: function (dt) {
      tIn += dt;
      var s = slides[si] || {};
      tex.offset.x -= (s.scroll || 0) * dt;
      if (tIn >= (s.duration || 6)) { tIn = 0; si = (si + 1) % slides.length; draw(); }
    }
  };
}

// ── Sponsor floor logos ────────────────────────────────────────────────────────
// Studio logos are laid out on the AFL oval (boundary 84 x 71.5 m). On another
// ground the same layout is scaled down evenly into its playing area, so every
// logo keeps its shape and stays on the field.
var OVAL = {x: 84, z: 71.5};
export function logoScale(field) {
  return Math.min((field.w / 2) / OVAL.x, (field.d / 2) / OVAL.z);
}
/** Field position and size (metres) for one studio logo: {x, z, w, d, rot}. */
export function logoPlacement(logo, field) {
  var k = logoScale(field);
  var w = Number(logo && (logo.w || logo.width_m)) || 14;
  var d = Number(logo && (logo.d || logo.depth_m || logo.h)) || 4.7;
  return {
    x: (field.x || 0) + (Number(logo && logo.x) || 0) * k,
    z: (field.z || 0) + (Number(logo && logo.z) || 0) * k,
    w: Math.max(0.2, w * k),
    d: Math.max(0.2, d * k),
    rot: Number(logo && (logo.rot || logo.rotation)) || 0
  };
}

function glContext(canvas) {
  var attrs = {alpha: false, antialias: false, depth: true, stencil: false, preserveDrawingBuffer: true,
    powerPreference: "default", failIfMajorPerformanceCaveat: false};
  return canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
}

// A blank (all background) frame means the scene didn't draw: keep the still.
function looksDrawn(gl, background) {
  if (!gl) return false;
  var w = gl.drawingBufferWidth || 0, h = gl.drawingBufferHeight || 0;
  if (w < 8 || h < 8) return false;
  var bg = new T.Color(background), br = Math.round(bg.r * 255), bgG = Math.round(bg.g * 255), bb = Math.round(bg.b * 255);
  var pix = new Uint8Array(4);
  var pts = [[0.5, 0.45], [0.35, 0.5], [0.65, 0.5], [0.5, 0.6], [0.2, 0.4], [0.8, 0.4]];
  for (var i = 0; i < pts.length; i++) {
    gl.readPixels((w * pts[i][0]) | 0, (h * pts[i][1]) | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    if (Math.abs(pix[0] - br) + Math.abs(pix[1] - bgG) + Math.abs(pix[2] - bb) > 40) return true;
  }
  return false;
}

function ensureFallback(host, url) {
  var img = host.querySelector(".fl-mcg-fallback");
  if (!img) {
    img = document.createElement("img");
    img.className = "fl-mcg-fallback";
    img.alt = "";
    img.decoding = "async";
    host.insertBefore(img, host.firstChild);
  }
  if (img.getAttribute("src") !== url) img.src = url;
  return img;
}

function noop() {}

/** The handle for a ground that stays on its still. */
export function fallbackHandle(def) {
  return {fallback: true, venue: def.venue, cameras: def.cameras, chips: def.chips, storageKey: storageKeyFor(def.venue),
    cameraId: "broadcast", setCamera: function () { return false; }, resize: noop,
    setLogos: noop, celebrate: function () { return false; },
    setBoards: function () { return Promise.resolve(); }, stop: noop};
}

/**
 * Mount one ground. ``def``: {venue, fallbackUrl, cameras, chips, field: {w, d, x?, z?},
 * outdoor, far, build(scene, opts) -> Promise<{led, update?}>}.
 */
export async function mountVenue(host, opts, def) {
  opts = opts || {};
  if (!host || typeof host.appendChild !== "function") return fallbackHandle(def);
  ensureFallback(host, def.fallbackUrl);
  host.classList.remove("is-webgl");
  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "fl-mcg-canvas";
  host.appendChild(canvas);
  var gl = glContext(canvas);
  if (!gl) {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    return fallbackHandle(def);
  }
  var alive = true, renderer = null, raf = 0, watch = null;
  function fail() {
    host.classList.remove("is-webgl");
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (watch) { try { watch.disconnect(); } catch (e) {} watch = null; }
    if (renderer) { try { renderer.dispose(); } catch (e2) {} renderer = null; }
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }
  canvas.addEventListener("webglcontextlost", function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    fail();
  }, false);
  try {
    var still = reducedMotion();
    renderer = new T.WebGLRenderer({canvas: canvas, context: gl, antialias: false, alpha: false, preserveDrawingBuffer: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = false;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    function viewCap() {
      var vv = window.visualViewport, nums = [];
      if (vv && vv.width) nums.push(vv.width);
      if (window.innerWidth) nums.push(window.innerWidth);
      if (document.documentElement && document.documentElement.clientWidth) nums.push(document.documentElement.clientWidth);
      var vw = nums.length ? Math.min.apply(null, nums) : 390;
      return vw > 0 ? vw : 390;
    }
    function size() {
      var cap = viewCap();
      var nw = host.clientWidth || host.offsetWidth || cap;
      var nh = host.clientHeight || host.offsetHeight || 320;
      if (nw > cap) nw = cap;
      if (nw < 2) nw = Math.min(390, cap);
      if (nh < 2) nh = 320;
      return {w: nw, h: nh};
    }
    var bx = size();
    renderer.setSize(bx.w, bx.h, false);
    var scene = new T.Scene();
    // Outdoor grounds play in daylight (the pack's default); indoor ones under lights.
    var background = def.outdoor ? 0x9fc3e0 : 0x0d1117;
    scene.background = new T.Color(background);
    scene.add(new T.HemisphereLight(0xdfefff, 0x334433, def.outdoor ? 1.1 : 0.5));
    var sun = new T.DirectionalLight(0xffffff, def.outdoor ? 2.2 : 1.6);
    sun.position.set(80, 160, 60);
    scene.add(sun);

    var cams = camerasFor({cameras: def.cameras});
    var first = findCamera(cams, "broadcast");
    var camera = new T.PerspectiveCamera(first.fov, bx.w / bx.h, 0.1, def.far || 400);
    var camId = "broadcast";
    var camNow = null, camTween = null;
    function applyCam(st) {
      camNow = st;
      camera.position.set(st.pos[0], st.pos[1], st.pos[2]);
      camera.fov = st.fov;
      camera.updateProjectionMatrix();
      camera.lookAt(st.look[0], st.look[1], st.look[2]);
    }
    function camTarget(preset) {
      return {pos: preset.pos.slice(), look: preset.look.slice(), fov: effectiveFov(preset, camera.aspect)};
    }
    applyCam(camTarget(first));
    function setCam(id, o) {
      var preset = findCamera(cams, id);
      if (!preset || !alive || !renderer) return false;
      camId = id;
      var to = camTarget(preset);
      if (still || (o && o.animate === false)) {
        camTween = null;
        applyCam(to);
        renderer.render(scene, camera);
        return true;
      }
      camTween = {from: camNow, to: to, start: performance.now()};
      return true;
    }
    function stepCam(now) {
      if (!camTween) return;
      var t = tweenProgress(camTween.start, now, TWEEN_MS, false);
      applyCam(cameraAt(camTween.from, camTween.to, t));
      if (t >= 1) camTween = null;
    }

    var built = (await def.build(scene, {boardsUrl: opts.boardsUrl})) || {};
    if (!alive) { fail(); return fallbackHandle(def); }
    var led = built.led || null;
    var logoGroup = new T.Group();
    scene.add(logoGroup);
    function clearLogos() {
      while (logoGroup.children.length) {
        var m = logoGroup.children.pop();
        try { if (m.material.map) m.material.map.dispose(); m.material.dispose(); m.geometry.dispose(); } catch (eD) {}
      }
    }
    // Sponsor logos painted on the field (the studio's Grounds tab picks which tipsters show here).
    function setLogos(logos) {
      clearLogos();
      if (!def.field) return;
      (logos || []).forEach(function (logo) {
        var url = logo && (logo.url || logo.src || logo.image);
        if (!url) return;
        var at = logoPlacement(logo, def.field);
        var LF = globalThis.LogoFrame;
        var view = {zoom: logo.zoom, pan_x: logo.pan_x, pan_y: logo.pan_y, shape: logo.shape};
        var tex;
        if (!LF || (at.w === at.d && LF.plain(view))) {
          tex = new T.TextureLoader().load(url, function () { if (alive && still && renderer) renderer.render(scene, camera); });
        } else {
          var cv = document.createElement("canvas");
          var cw = 512, ch = Math.max(1, Math.round(512 * at.d / at.w));
          if (ch > 512) { ch = 512; cw = Math.max(1, Math.round(512 * at.w / at.d)); }
          cv.width = cw; cv.height = ch;
          tex = new T.CanvasTexture(cv);
          var im = new Image();
          im.crossOrigin = "anonymous";
          im.onload = function () {
            try { LF.paint(cv.getContext("2d"), im, cw, ch, view); } catch (eP) {}
            tex.needsUpdate = true;
            if (alive && renderer) renderer.render(scene, camera);
          };
          im.src = url;
        }
        if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
        tex.anisotropy = 8;
        var mesh = new T.Mesh(new T.PlaneGeometry(at.w, at.d),
          new T.MeshBasicMaterial({map: tex, transparent: true, opacity: 0.9, depthWrite: false}));
        mesh.rotation.set(-Math.PI / 2, 0, -at.rot * Math.PI / 180);
        mesh.position.set(at.x, 0.03, at.z);   // just above the field plane (y 0.01)
        logoGroup.add(mesh);
      });
      if (alive && renderer) renderer.render(scene, camera);
    }
    var last = 0;
    function draw(now) {
      if (!alive || !renderer) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!still) {
        if (led) led.update(dt);
        if (built.update) built.update(dt);
      }
      stepCam(now);
      renderer.render(scene, camera);
      if (!still) raf = requestAnimationFrame(draw);
    }
    renderer.render(scene, camera);
    var shown = false;
    try { shown = looksDrawn(gl, background); } catch (e5) { shown = true; }
    if (!shown) {
      try { host.dataset.mcgError = "pixels"; } catch (e6) {}
      fail();
      return fallbackHandle(def);
    }
    try { host.dataset.mcg = "webgl"; } catch (e7) {}
    host.classList.add("is-webgl");
    if (!still) raf = requestAnimationFrame(draw);
    function resize() {
      if (!alive || !renderer) return;
      var next = size();
      camera.aspect = next.w / next.h;
      var preset = camTween ? null : findCamera(cams, camId);
      if (preset) applyCam(camTarget(preset));
      camera.updateProjectionMatrix();
      renderer.setSize(next.w, next.h, false);
      if (still) renderer.render(scene, camera);
    }
    watch = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    if (watch) watch.observe(host);
    return {
      fallback: false,
      venue: def.venue,
      cameras: cams,
      chips: def.chips,
      storageKey: storageKeyFor(def.venue),
      get cameraId() { return camId; },
      setCamera: setCam,
      resize: resize,
      setLogos: setLogos,
      celebrate: function () { return false; },
      setBoards: function (list) {
        if (!led || !led.setSlides) return Promise.resolve();
        return led.setSlides(list).then(function () { if (alive && renderer) renderer.render(scene, camera); });
      },
      stop: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        if (watch) watch.disconnect();
        clearLogos();
        if (renderer) { try { renderer.dispose(); } catch (e8) {} }
        renderer = null;
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        host.classList.remove("is-webgl");
      }
    };
  } catch (err) {
    try { host.dataset.mcgError = String(err && (err.message || err) || "mount").slice(0, 240); } catch (e9) {}
    fail();
    return fallbackHandle(def);
  }
}
