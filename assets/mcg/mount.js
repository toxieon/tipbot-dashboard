/* Broadcast view of the existing ground model and its sponsor boards.
   Loaded only when a follower opens a game. If WebGL or the model cannot
   start (iPhone Safari has failed here before), the fallback photo stays. */
import * as T from "../vendor/three/three.module.min.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/three/addons/libs/meshopt_decoder.module.js";
import { addBoards } from "./boards/boards.js";
import { upgradeStands, upgradeTowers, addGround } from "./v5.js";

var FALLBACK_URL = new URL("./fallback.png", import.meta.url).href;
// The broadcast camera. The still photo is a render from this same camera.
var CAM = {fov: 36, pos: [0, 110, 200], look: [0, 0, 0]};
var PHOTO = {w: 780, h: 552};

// Where a ground point (metres) lands on the still photo shown with object-fit: cover
// in a host of hostW x hostH pixels. Same camera as the 3D view, so logos line up.
export function projectGround(x, z, hostW, hostH) {
  var cam = new T.PerspectiveCamera(CAM.fov, PHOTO.w / PHOTO.h, 0.1, 3000);
  cam.position.set(CAM.pos[0], CAM.pos[1], CAM.pos[2]);
  cam.lookAt(CAM.look[0], CAM.look[1], CAM.look[2]);
  cam.updateMatrixWorld();
  var v = new T.Vector3(Number(x) || 0, 0.4, Number(z) || 0).project(cam);
  var px = (v.x + 1) / 2 * PHOTO.w, py = (1 - v.y) / 2 * PHOTO.h;
  var scale = Math.max(hostW / PHOTO.w, hostH / PHOTO.h);
  return {
    x: (hostW - PHOTO.w * scale) / 2 + px * scale,
    y: (hostH - PHOTO.h * scale) / 2 + py * scale,
    scale: scale
  };
}

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

    var camera = new T.PerspectiveCamera((opts.fov || CAM.fov), box.w / box.h, 0.1, 3000);
    var cam = opts.cam || CAM.pos;
    var look = opts.look || CAM.look;
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
    var fxGroup = new T.Group();
    scene.add(fxGroup);
    var logoById = {};
    var litLights = [];
    var effects = [];
    function disposeMesh(ch) {
      if (ch.geometry) ch.geometry.dispose();
      if (ch.material) {
        if (ch.material.map) ch.material.map.dispose();
        ch.material.dispose();
      }
    }
    function clearLogos() {
      while (logoGroup.children.length) {
        var ch = logoGroup.children.pop();
        if (ch.material && ch.material.map === glowTex) ch.material.map = null;
        disposeMesh(ch);
      }
      litLights.forEach(function (light) { scene.remove(light); });
      litLights = [];
      logoById = {};
    }
    var glowTex = null;
    // A soft oval of light. Shared by every logo, so it is drawn once.
    function glowTexture() {
      if (glowTex) return glowTex;
      var cv = document.createElement("canvas");
      cv.width = 256; cv.height = 128;
      var g = cv.getContext("2d");
      var grad = g.createRadialGradient(128, 64, 4, 128, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.55, "rgba(255,255,255,0.45)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.setTransform(2, 0, 0, 1, -128, 0);
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 128);
      glowTex = new T.CanvasTexture(cv);
      return glowTex;
    }
    var sparkTex = null;
    function sparkTexture() {
      if (sparkTex) return sparkTex;
      var cv = document.createElement("canvas");
      cv.width = 64; cv.height = 64;
      var g = cv.getContext("2d");
      var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.3, "rgba(255,255,255,0.85)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      sparkTex = new T.CanvasTexture(cv);
      return sparkTex;
    }
    function flat(mesh, yaw) {
      mesh.rotation.order = "YXZ";
      mesh.rotation.y = T.MathUtils.degToRad(-yaw);
      mesh.rotation.x = -Math.PI / 2;
    }
    function setLogos(logos) {
      clearLogos();
      (logos || []).forEach(function (logo, i) {
        var url = logo && (logo.url || logo.src || logo.image);
        if (!url) return;
        var w = Number(logo.w || logo.width_m || 14);
        var d = Number(logo.d || logo.depth_m || logo.h || 4.7);
        if (!(w > 0)) w = 14;
        if (!(d > 0)) d = 4.7;
        var x = Number(logo.x) || 0;
        var z = Number(logo.z) || 0;
        var yaw = Number(logo.rot || logo.rotation || 0);
        if (!isFinite(yaw)) yaw = 0;
        var tex = new T.TextureLoader().load(url, function () {
          if (alive && still && renderer) renderer.render(scene, camera);
        });
        if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
        tex.anisotropy = 8;
        var mat = new T.MeshBasicMaterial({map: tex, transparent: true, depthWrite: false});
        var mesh = new T.Mesh(new T.PlaneGeometry(w, d), mat);
        flat(mesh, yaw);
        mesh.position.set(x, 0.4, z);
        logoGroup.add(mesh);
        var glow = new T.Mesh(
          new T.PlaneGeometry(w * 1.5, d * 2.2),
          new T.MeshBasicMaterial({map: glowTexture(), color: 0xffe27a, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending})
        );
        flat(glow, yaw);
        glow.position.set(x, 0.34, z);
        logoGroup.add(glow);
        var key = String(logo.id || logo.asset_id || i);
        logoById[key] = {x: x, z: z, w: w, d: d, mat: mat, glow: glow};
      });
      if (alive && renderer) renderer.render(scene, camera);
    }

    // ---- celebration: fireworks over the logo and a rising +units hologram
    var PALETTE = [0xffd54a, 0xffffff, 0xff8a3d, 0x7dd3fc, 0xf472b6, 0x86efac];
    function burst(x, y, z, delay) {
      var n = 120;
      var pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = [];
      var base = new T.Color(PALETTE[(Math.random() * PALETTE.length) | 0]);
      var accent = new T.Color(PALETTE[(Math.random() * PALETTE.length) | 0]);
      for (var i = 0; i < n; i++) {
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), sp = 9 + Math.random() * 7;
        vel.push([Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp * 0.8 + 2, Math.sin(ph) * Math.sin(th) * sp]);
        var c = i % 3 ? base : accent;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      var geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(pos, 3));
      geo.setAttribute("color", new T.BufferAttribute(col, 3));
      var mat = new T.PointsMaterial({size: 3.2, map: sparkTexture(), vertexColors: true, transparent: true, opacity: 0,
        depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true});
      var pts = new T.Points(geo, mat);
      fxGroup.add(pts);
      effects.push({kind: "burst", obj: pts, vel: vel, age: -delay, life: 1.9});
    }
    function labelSprite(text) {
      var cv = document.createElement("canvas");
      cv.width = 512; cv.height = 160;
      var g = cv.getContext("2d");
      g.font = "700 104px 'Instrument Sans', Geist, system-ui, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.shadowColor = "rgba(110,220,255,0.95)"; g.shadowBlur = 28;
      g.fillStyle = "#e9fbff";
      g.fillText(text, 256, 84);
      g.shadowBlur = 0;
      var tex = new T.CanvasTexture(cv);
      if (T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
      var sp = new T.Sprite(new T.SpriteMaterial({map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 0}));
      sp.scale.set(26, 8.1, 1);
      return sp;
    }
    function celebrate(id, label) {
      var logo = logoById[String(id)];
      if (!logo || !alive || !renderer) return false;
      var text = String(label || "").slice(0, 12) || "WIN";
      var sprite = labelSprite(text);
      sprite.position.set(logo.x, 8, logo.z);
      fxGroup.add(sprite);
      effects.push({kind: "label", obj: sprite, age: 0, life: 3.2, y0: 8});
      effects.push({kind: "pulse", logo: logo, age: 0, life: 2.6});
      if (still) {
        sprite.material.opacity = 1;
        sprite.position.y = 14;
        logo.glow.material.opacity = 0.35;
        renderer.render(scene, camera);
        setTimeout(function () {
          if (!alive || !renderer) return;
          fxGroup.remove(sprite); disposeMesh(sprite);
          effects = [];
          logo.glow.material.opacity = 0;
          renderer.render(scene, camera);
        }, 3000);
        return true;
      }
      var top = 20 + Math.min(logo.w, 20) * 0.3;
      burst(logo.x, top, logo.z, 0);
      burst(logo.x - logo.w * 0.45, top + 4, logo.z - 3, 0.35);
      burst(logo.x + logo.w * 0.45, top + 2, logo.z + 2, 0.7);
      return true;
    }
    function stepEffects(dt) {
      if (!effects.length) return;
      effects = effects.filter(function (e) {
        e.age += dt;
        var t = e.age / e.life;
        if (e.kind === "burst") {
          if (e.age < 0) return true;
          var arr = e.obj.geometry.attributes.position.array;
          for (var i = 0; i < e.vel.length; i++) {
            var v = e.vel[i];
            v[1] -= 9 * dt;
            v[0] *= 0.985; v[2] *= 0.985;
            arr[i * 3] += v[0] * dt; arr[i * 3 + 1] += v[1] * dt; arr[i * 3 + 2] += v[2] * dt;
          }
          e.obj.geometry.attributes.position.needsUpdate = true;
          e.obj.material.opacity = t < 0.08 ? 1 : Math.max(0, 1 - (t - 0.08) / 0.92);
        } else if (e.kind === "label") {
          e.obj.position.y = e.y0 + Math.min(1, t) * 16;
          e.obj.material.opacity = t < 0.12 ? t / 0.12 : Math.max(0, 1 - Math.max(0, t - 0.65) / 0.35);
        } else if (e.kind === "pulse") {
          e.logo.glow.material.opacity = 0.75 * Math.abs(Math.sin(e.age * 5)) * (1 - t);
        }
        if (t >= 1) {
          if (e.obj) {
            fxGroup.remove(e.obj);
            if (e.obj.material && e.obj.material.map === sparkTex) e.obj.material.map = null;
            disposeMesh(e.obj);
          }
          if (e.kind === "pulse") e.logo.glow.material.opacity = 0;
          return false;
        }
        return true;
      });
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
      if (!still) stepEffects(dt);
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
      celebrate: celebrate,
      setBoards: function (slides) {
        if (!boards || !boards.setSlides) return Promise.resolve();
        return boards.setSlides(slides).then(function () { if (alive && renderer) renderer.render(scene, camera); });
      },
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
