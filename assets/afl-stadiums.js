/* AFL low-poly stadium heroes (Three.js, tipdash). Lazy-loaded with builder. TBAflStadiums + CommonJS. */
(function (root) {
  "use strict";

  var active = null;
  var threePromise = null;

  function prefersStaticOnly() {
    try {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
      if (document.documentElement.dataset.motion === "reduce") return true;
      var dm = navigator.deviceMemory;
      if (dm && dm <= 3) return true;
      var hc = navigator.hardwareConcurrency;
      if (hc && hc <= 4) return true;
      if (navigator.connection && navigator.connection.saveData) return true;
    } catch (e) {}
    return false;
  }

  function loadThree() {
    if (threePromise) return threePromise;
    var base = "./assets/vendor/three.module.js";
    if (typeof window !== "undefined" && window.TD && TD.version) {
      base += "?v=" + encodeURIComponent(TD.version);
    }
    threePromise = import(base);
    return threePromise;
  }

  /** Per-venue silhouette tweaks (original procedural geometry only). */
  var VARIANTS = {
    mcg: { rx: 1.35, rz: 1.05, bowl: 1.15, asym: 0.08, towers: 6, stand: "#3d4a5c", accent: "#5b8cff", turf: "#1a4d32" },
    marvel: { rx: 1.2, rz: 0.82, bowl: 0.95, asym: 0.35, towers: 4, stand: "#2e3644", accent: "#7a8cff", turf: "#1b5238" },
    adelaide: { rx: 1.25, rz: 0.95, bowl: 1.05, asym: 0.22, towers: 4, stand: "#4a5568", accent: "#c4a35a", turf: "#1f5c3a" },
    optus: { rx: 1.28, rz: 1.0, bowl: 1.08, asym: 0.12, towers: 6, stand: "#354052", accent: "#e07a4a", turf: "#1a4a30" },
    gabba: { rx: 1.15, rz: 0.92, bowl: 1.0, asym: 0.18, towers: 4, stand: "#3a4555", accent: "#6fcf97", turf: "#1c5536" },
    scg: { rx: 1.1, rz: 0.88, bowl: 1.02, asym: 0.28, towers: 4, stand: "#434c5e", accent: "#9bb0d3", turf: "#1b4f34" },
    giants: { rx: 1.05, rz: 0.78, bowl: 0.88, asym: 0.2, towers: 4, stand: "#3d3f45", accent: "#f47a20", turf: "#1a4d32" },
    gmhba: { rx: 1.22, rz: 0.9, bowl: 0.92, asym: 0.4, towers: 4, stand: "#3b4654", accent: "#2e6fd4", turf: "#1e5638" },
    people_first: { rx: 1.08, rz: 0.85, bowl: 0.9, asym: 0.15, towers: 4, stand: "#404858", accent: "#d0112b", turf: "#1b5238" },
    utas: { rx: 1.12, rz: 0.9, bowl: 0.85, asym: 0.1, towers: 4, stand: "#3a4452", accent: "#ffd200", turf: "#1a4a30" },
    manuka: { rx: 0.95, rz: 0.82, bowl: 0.78, asym: 0.12, towers: 4, stand: "#3f4856", accent: "#7ec8a8", turf: "#1c5536" },
    blundstone: { rx: 1.0, rz: 0.8, bowl: 0.82, asym: 0.16, towers: 4, stand: "#364152", accent: "#5ad4ff", turf: "#1a4d32" },
  };

  function standHeightAt(angle, v) {
    var base = 0.35 + v.bowl * 0.45;
    var wave = Math.sin(angle * 2) * 0.08 * v.asym;
    var lobe = Math.cos(angle - 0.6) * 0.18 * v.asym;
    var flat = v.asym > 0.3 && Math.cos(angle) > 0.55 ? -0.22 * v.asym : 0;
    return Math.max(0.22, base + wave + lobe + flat);
  }

  function buildStadium(THREE, key) {
    var v = VARIANTS[key] || VARIANTS.mcg;
    var group = new THREE.Group();
    var standMat = new THREE.MeshLambertMaterial({ color: v.stand });
    var accentMat = new THREE.MeshLambertMaterial({ color: v.accent });
    var turfMat = new THREE.MeshLambertMaterial({ color: v.turf });
    var railMat = new THREE.MeshLambertMaterial({ color: "#c8d0dc" });

    var segments = 28;
    var innerRx = 2.8 * v.rx;
    var innerRz = 2.2 * v.rz;

    var field = new THREE.Mesh(new THREE.CircleGeometry(1, 48), turfMat);
    field.rotation.x = -Math.PI / 2;
    field.scale.set(innerRx * 0.92, innerRz * 0.92, 1);
    field.position.y = 0.02;
    group.add(field);

    var track = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), railMat);
    track.rotation.x = -Math.PI / 2;
    track.scale.set(innerRx, innerRz, 1);
    track.position.y = 0.015;
    group.add(track);

    for (var i = 0; i < segments; i++) {
      var a0 = (i / segments) * Math.PI * 2;
      var a1 = ((i + 1) / segments) * Math.PI * 2;
      var am = (a0 + a1) / 2;
      var h = standHeightAt(am, v);
      var depth = 0.55 + h * 0.35;
      var outer = 1.12 + h * 0.15;
      var x0 = Math.cos(a0) * innerRx * outer;
      var z0 = Math.sin(a0) * innerRz * outer;
      var x1 = Math.cos(a1) * innerRx * outer;
      var z1 = Math.sin(a1) * innerRz * outer;
      var xm = Math.cos(am) * innerRx * (outer - depth * 0.35);
      var zm = Math.sin(am) * innerRz * (outer - depth * 0.35);
      var w = Math.hypot(x1 - x0, z1 - z0);
      var seg = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), i % 5 === 0 ? accentMat : standMat);
      seg.position.set(xm, h / 2, zm);
      seg.rotation.y = -am + Math.PI / 2;
      group.add(seg);
    }

    var towerN = v.towers || 4;
    for (var t = 0; t < towerN; t++) {
      var ta = (t / towerN) * Math.PI * 2 + 0.2;
      var tx = Math.cos(ta) * innerRx * 1.55;
      var tz = Math.sin(ta) * innerRz * 1.55;
      var pole = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), standMat);
      pole.position.set(tx, 0.9, tz);
      group.add(pole);
      var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.35), accentMat);
      lamp.position.set(tx, 1.85, tz);
      group.add(lamp);
    }

    return group;
  }

  function disposeMount(m) {
    if (!m) return;
    if (m.raf) cancelAnimationFrame(m.raf);
    if (m.ro) m.ro.disconnect();
    if (m.vis) document.removeEventListener("visibilitychange", m.vis);
    if (m.renderer) {
      m.renderer.dispose();
      if (m.canvas && m.canvas.parentNode) m.canvas.remove();
    }
    if (m.scene) {
      m.scene.traverse(function (obj) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(function (mat) { mat.dispose(); });
          else obj.material.dispose();
        }
      });
    }
  }

  function mount(opts) {
    stop();
    var key = opts && opts.venueKey;
    if (!key || !VARIANTS[key]) return null;
    var posterEl = opts.posterEl;
    var canvasEl = opts.canvasEl;
    var rootEl = opts.rootEl;
    var version = opts.version;
    if (posterEl && root.TBAflVenues) {
      posterEl.src = TBAflVenues.posterPath(key, version);
      posterEl.alt = "";
    }
    var staticOnly = opts.forceStatic || prefersStaticOnly();
    if (staticOnly) {
      if (rootEl) rootEl.classList.add("is-static", "is-in");
      if (canvasEl) canvasEl.hidden = true;
      return { key: key, static: true };
    }
    if (canvasEl) canvasEl.hidden = false;
    if (rootEl) rootEl.classList.remove("is-static");

    var mountJob = {
      key: key,
      canvas: canvasEl,
      rootEl: rootEl,
      alive: true,
      static: false,
    };
    active = mountJob;

    loadThree()
      .then(function (THREE) {
        if (!mountJob.alive || active !== mountJob) return;
        var canvas = mountJob.canvas;
        if (!canvas || !canvas.isConnected) return;
        var w = Math.max(1, canvas.clientWidth || 320);
        var h = Math.max(1, canvas.clientHeight || 200);
        var renderer = new THREE.WebGLRenderer({
          canvas: canvas,
          antialias: false,
          alpha: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(w, h, false);
        var scene = new THREE.Scene();
        scene.background = new THREE.Color(0x07090f);
        scene.fog = new THREE.Fog(0x07090f, 8, 22);
        var camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 60);
        camera.position.set(0, 3.2, 7.5);
        scene.add(new THREE.AmbientLight(0x8a9bb8, 0.55));
        var sun = new THREE.DirectionalLight(0xf0f4ff, 0.85);
        sun.position.set(4, 9, 2);
        scene.add(sun);
        var fill = new THREE.DirectionalLight(0x5b8cff, 0.25);
        fill.position.set(-5, 3, -4);
        scene.add(fill);
        var stadium = buildStadium(THREE, key);
        scene.add(stadium);
        var t0 = performance.now();
        function resize() {
          if (!mountJob.alive) return;
          var cw = Math.max(1, canvas.clientWidth || 320);
          var ch = Math.max(1, canvas.clientHeight || 200);
          renderer.setSize(cw, ch, false);
          camera.aspect = cw / ch;
          camera.updateProjectionMatrix();
        }
        var ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
        if (ro) ro.observe(canvas);
        else window.addEventListener("resize", resize);
        resize();
        function frame(now) {
          if (!mountJob.alive) return;
          if (document.hidden) {
            mountJob.raf = requestAnimationFrame(frame);
            return;
          }
          var elapsed = (now - t0) * 0.00012;
          var orbit = 7.2;
          camera.position.x = Math.sin(elapsed) * orbit;
          camera.position.z = Math.cos(elapsed) * orbit;
          camera.position.y = 3.1 + Math.sin(elapsed * 0.7) * 0.15;
          camera.lookAt(0, 0.35, 0);
          renderer.render(scene, camera);
          mountJob.raf = requestAnimationFrame(frame);
        }
        mountJob.raf = requestAnimationFrame(frame);
        mountJob.renderer = renderer;
        mountJob.scene = scene;
        mountJob.ro = ro;
        mountJob.vis = function () {
          if (!document.hidden && mountJob.alive) resize();
        };
        document.addEventListener("visibilitychange", mountJob.vis);
        if (rootEl) {
          requestAnimationFrame(function () {
            if (mountJob.alive && rootEl) rootEl.classList.add("is-in");
          });
        }
      })
      .catch(function () {
        if (posterEl && rootEl) {
          rootEl.classList.add("is-static", "is-in");
          if (canvasEl) canvasEl.hidden = true;
        }
      });

    return mountJob;
  }

  function stop() {
    if (!active) return;
    active.alive = false;
    disposeMount(active);
    active = null;
  }

  var API = {
    VARIANTS: VARIANTS,
    prefersStaticOnly: prefersStaticOnly,
    mount: mount,
    stop: stop,
    buildStadium: buildStadium,
    loadThree: loadThree,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.TBAflStadiums = API;
  if (typeof window !== "undefined" && window.TD) {
    window.TD.loaded = window.TD.loaded || {};
    window.TD.loaded["afl-stadiums"] = true;
  }
})(typeof window !== "undefined" ? window : globalThis);
