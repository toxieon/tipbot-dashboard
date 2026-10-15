/* Broadcast view of the existing ground model and its sponsor boards.
   Loaded only when a follower opens a game. No studio changes. */
import * as T from "../vendor/three/three.module.js";
import { GLTFLoader } from "../vendor/three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "../vendor/three/addons/libs/meshopt_decoder.module.js";
import { addBoards } from "./boards/boards.js";
import { upgradeStands, upgradeTowers, addGround } from "./v5.js";

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

export async function mount(host, opts) {
  opts = opts || {};
  const night = nightNow(opts);
  const still = reducedMotion();
  const w = host.clientWidth || 390;
  const h = host.clientHeight || 268;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(w, h, false);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = night ? 0.9 : 1.05;
  renderer.shadowMap.enabled = false;
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color(night ? 0x070b14 : 0x9fc3e0);
  scene.add(new T.HemisphereLight(0xdfefff, 0x334433, night ? 0.28 : 1.1));
  const sun = new T.DirectionalLight(night ? 0x9fb4ff : 0xffffff, night ? 0.35 : 1.8);
  sun.position.set(200, 300, 120);
  scene.add(sun);

  const camera = new T.PerspectiveCamera(42, w / h, 0.1, 3000);
  camera.position.set(150, 130, 190);
  camera.lookAt(0, 18, 0);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(new URL("./mcg.glb", import.meta.url).href);
  scene.add(gltf.scene);
  upgradeStands(scene, night);
  upgradeTowers(scene, night);
  addGround(scene);
  const boards = await addBoards(scene, {
    night: night,
    cfgUrl: new URL("./boards/boards.json", import.meta.url).href
  });
  boards.update(0);

  let alive = true;
  let raf = 0;
  let last = 0;
  function draw(now) {
    if (!alive) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    if (!still) boards.update(dt);
    renderer.render(scene, camera);
    if (!still) raf = requestAnimationFrame(draw);
  }
  renderer.render(scene, camera);
  if (!still) raf = requestAnimationFrame(draw);

  function resize() {
    if (!alive) return;
    const nw = host.clientWidth || 1;
    const nh = host.clientHeight || 1;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh, false);
    if (still) renderer.render(scene, camera);
  }
  const watch = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  if (watch) watch.observe(host);

  return {
    stop: function () {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
      if (watch) watch.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}
