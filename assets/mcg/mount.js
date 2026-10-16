/* Broadcast view of the existing ground model and its sponsor boards.
   Loaded only when a follower opens a game. If WebGL or the model cannot
   start (iPhone Safari has failed here before), the fallback photo stays. */
import * as T from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/three/addons/libs/meshopt_decoder.module.js";
import { addBoards } from "./boards/boards.js";
import { upgradeStands, upgradeTowers, addGround } from "./v5.js";

var FALLBACK_URL = new URL("./fallback.png", import.meta.url).href;

function reducedMotion() {
  try {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  } catch (e) {
    return false;
  }
}

function nightNow(opts) {
  if (opts && typeof opts.night === "boolean") return opts.night;
  try {
    const tb = window.TBTime;
    if (tb && typeof tb.isDaytime === "function" && tb.isDaytime()) return false;
  } catch (e) {}
  return true;
}

// The camera looks through the near floodlight. Its mast is a black pole
// down the middle of the ground, so that tower stays off.
function hideTowerOnLens(scene, camera) {
  var nearest = null;
  var nearestD = Infinity;
  scene.traverse(function (o) {
    if (!/^LightTower\d$/.test(o.name)) return;
    var p = new T.Vector3();
    o.getWorldPosition(p);
    var d = p.distanceTo(camera.position);
    if (d < nearestD) {
      nearestD = d;
      nearest = o;
    }
  });
  if (nearest && nearestD < 180) nearest.visible = false;
}

function ensureFallback(host) {
  var img = host.querySelector(".fl-mcg-fallback");
  if (!img) {
    img = document.createElement("img");
    img.className = "fl-mcg-fallback";
    img.alt = "";
    img.decoding = "async";
    host.insertBefore(img, host.firstChild);
  }
  if (!img.getAttribute("src")) img.src = FALLBACK_URL;
  return img;
}

function showFallback(host) {
  host.classList.remove("is-webgl");
}

function hideFallback(host) {
  host.classList.add("is-webgl");
}

function glContext(canvas) {
  var attrs = {
    alpha: false,
    antialias: false,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: true,
    powerPreference: "default",
    failIfMajorPerformanceCaveat: false
  };
  return canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs) || canvas.getContext("experimental-webgl", attrs);
}

function looksLikeGround(gl) {
  if (!gl) return false;
  var w = gl.drawingBufferWidth || 0;
  var h = gl.drawingBufferHeight || 0;
  if (w < 8 || h < 8) return false;
  var pix = new Uint8Array(4);
  var points = [
    [w * 0.5, h * 0.45],
    [w * 0.35, h * 0.55],
    [w * 0.65, h * 0.4],
    [w * 0.5, h * 0.7],
    [w * 0.2, h * 0.3],
    [w * 0.8, h * 0.6]
  ];
  var i;
  for (i = 0; i < points.length; i++) {
    gl.readPixels(points[i][0] | 0, points[i][1] | 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pix);
    var r = pix[0], g = pix[1], b = pix[2];
    if (g > 40 && g > r + 6 && g > b) return true;
    if (r + g + b > 80 && (Math.abs(r - 7) > 12 || Math.abs(g - 9) > 12 || Math.abs(b - 15) > 12)) return true;
  }
  return false;
}

export async function mount(host, opts) {
  opts = opts || {};
  ensureFallback(host);
  showFallback(host);
  if (!host || typeof host.appendChild !== "function") {
    return {stop: function () {}, fallback: true};
  }

  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "fl-mcg-canvas";
  host.appendChild(canvas);

  var gl = glContext(canvas);
  if (!gl) {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    return {stop: function () {}, fallback: true};
  }

  var alive = true;
  var renderer = null;
  var raf = 0;
  var watch = null;

  function fail() {
    showFallback(host);
    alive = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (watch) {
      try { watch.disconnect(); } catch (e) {}
      watch = null;
    }
    if (renderer) {
      try { renderer.dispose(); } catch (e2) {}
      renderer = null;
    }
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  canvas.addEventListener("webglcontextlost", function (ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    fail();
  }, false);

  try {
    if (MeshoptDecoder && MeshoptDecoder.ready && typeof MeshoptDecoder.ready.then === "function") {
      await MeshoptDecoder.ready;
    }
    if (!MeshoptDecoder || MeshoptDecoder.supported === false) throw new Error("meshopt");
    if (!alive) return {stop: function () {}, fallback: true};

    var night = nightNow(opts);
    var still = reducedMotion();
    renderer = new T.WebGLRenderer({
      canvas: canvas,
      context: gl,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = night ? 0.95 : 1.05;
    renderer.shadowMap.enabled = false;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    function viewCap() {
      var vv = window.visualViewport;
      var nums = [];
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
    var box = size();
    renderer.setSize(box.w, box.h, false);

    var scene = new T.Scene();
    scene.background = new T.Color(night ? 0x070b14 : 0x9fc3e0);
    scene.add(new T.HemisphereLight(0xdfefff, 0x334433, night ? 0.55 : 1.1));
    var sun = new T.DirectionalLight(night ? 0xfff4e0 : 0xffffff, night ? 0.85 : 1.8);
    sun.position.set(200, 300, 120);
    scene.add(sun);
    var fill = new T.DirectionalLight(0x9fb4ff, night ? 0.35 : 0.4);
    fill.position.set(-80, 40, -60);
    scene.add(fill);

    var camera = new T.PerspectiveCamera((opts.fov || 36), box.w / box.h, 0.1, 3000);
    var cam = opts.cam || [0, 110, 200];
    var look = opts.look || [0, 0, 0];
    camera.position.set(cam[0], cam[1], cam[2]);
    camera.lookAt(look[0], look[1], look[2]);

    var loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    var gltf = await loader.loadAsync(new URL("./mcg.glb", import.meta.url).href);
    if (!alive) {
      fail();
      return {stop: function () {}, fallback: true};
    }
    scene.add(gltf.scene);
    var logoGroup = new T.Group();
    scene.add(logoGroup);
    var litLights = [];
    function clearLogos() {
      while (logoGroup.children.length) {
        var ch = logoGroup.children.pop();
        if (ch.geometry) ch.geometry.dispose();
        if (ch.material) {
          if (ch.material.map) ch.material.map.dispose();
          ch.material.dispose();
        }
      }
      litLights.forEach(function (light) { scene.remove(light); });
      litLights = [];
    }
    function setLogos(logos) {
      clearLogos();
      (logos || []).forEach(function (logo) {
        var url = logo && (logo.url || logo.src || logo.image);
        if (!url) return;
        var w = Number(logo.w || logo.width_m || 14);
        var d = Number(logo.d || logo.depth_m || logo.h || 4.7);
        if (!(w > 0)) w = 14;
        if (!(d > 0)) d = 4.7;
        var x = Number(logo.x) || 0;
        var z = Number(logo.z) || 0;
        var lit = !!(logo.lit || logo.winning);
        var tex = new T.TextureLoader().load(url, function () {
          if (alive && still && renderer) renderer.render(scene, camera);
        });
        if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
        var mat = new T.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false});
        if (lit) mat.color = new T.Color(0xfff6c8);
        var mesh = new T.Mesh(new T.PlaneGeometry(w, d), mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, lit ? 0.55 : 0.4, z);
        logoGroup.add(mesh);
        if (lit) {
          var glow = new T.Mesh(
            new T.PlaneGeometry(w * 1.2, d * 1.45),
            new T.MeshBasicMaterial({color: 0xf4e04d, transparent: true, opacity: 0.5, depthWrite: false})
          );
          glow.rotation.x = -Math.PI / 2;
          glow.position.set(x, 0.32, z);
          logoGroup.add(glow);
          var light = new T.PointLight(0xf4e04d, 1.6, 48);
          light.position.set(x, 8, z);
          scene.add(light);
          litLights.push(light);
        }
      });
      if (alive && renderer) renderer.render(scene, camera);
    }
    try { upgradeStands(scene, night); } catch (e1) {}
    try { upgradeTowers(scene, night); } catch (e2) {}
    try { hideTowerOnLens(scene, camera); } catch (eTower) {}
    try { addGround(scene); } catch (e3) {}
    var boards = null;
    try {
      boards = await addBoards(scene, {
        night: night,
        cfgUrl: new URL("./boards/boards.json", import.meta.url).href
      });
      boards.update(0);
    } catch (e4) {
      boards = null;
    }

    var last = 0;
    function draw(now) {
      if (!alive || !renderer) return;
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      if (!still && boards) boards.update(dt);
      renderer.render(scene, camera);
      if (!still) raf = requestAnimationFrame(draw);
    }
    renderer.render(scene, camera);
    var shown = false;
    try { shown = looksLikeGround(gl); } catch (e5) { shown = true; }
    if (!shown) {
      try { host.dataset.mcgError = "pixels"; } catch (e6) {}
      fail();
      return {stop: function () {}, fallback: true};
    }
    try { host.dataset.mcg = "webgl"; } catch (e7) {}
    hideFallback(host);
    if (!still) raf = requestAnimationFrame(draw);

    function resize() {
      if (!alive || !renderer) return;
      var next = size();
      camera.aspect = next.w / next.h;
      camera.updateProjectionMatrix();
      renderer.setSize(next.w, next.h, false);
      if (still) renderer.render(scene, camera);
    }
    watch = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    if (watch) watch.observe(host);

    return {
      fallback: false,
      resize: resize,
      setLogos: setLogos,
      stop: function () {
        alive = false;
        if (raf) cancelAnimationFrame(raf);
        if (watch) watch.disconnect();
        if (renderer) {
          try { renderer.dispose(); } catch (e6) {}
        }
        renderer = null;
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        showFallback(host);
      }
    };
  } catch (err) {
    try { host.dataset.mcgError = String(err && (err.message || err) || "mount").slice(0, 240); } catch (e8) {}
    fail();
    return {stop: function () {}, fallback: true};
  }
}
