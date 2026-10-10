import * as THREE from "../../assets/stadiums/vendor/three.module.min.js";
import { OrbitControls } from "../../assets/stadiums/vendor/OrbitControls.js";

const params = new URLSearchParams(location.search);
const venueId = params.get("venue") || "mcg";

const canvas = document.getElementById("canvas");
const label = document.getElementById("venue-label");
const status = document.getElementById("status");

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement("script");
    s.src = src;
    s.onload = function () {
      resolve();
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadSpec(id) {
  if (!globalThis.StadiumBuild) {
    await loadScript("../../assets/stadiums/stadium-build.js");
  }
  if (!globalThis.StadiumSpecs || !globalThis.StadiumSpecs[id]) {
    await loadScript("../../assets/stadiums/" + id + ".js");
  }
  return globalThis.StadiumSpecs && globalThis.StadiumSpecs[id];
}

function fitCamera(camera, controls, object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.35;
  camera.position.set(center.x + dist * 0.65, center.y + dist * 0.42, center.z + dist * 0.65);
  controls.target.copy(center);
  controls.update();
}

async function main() {
  const spec = await loadSpec(venueId);
  if (!spec) {
    status.textContent = "Unknown venue: " + venueId;
    return;
  }
  label.textContent = spec.id.toUpperCase();

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0a1218, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a1218, 4, 14);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 1.8;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.autoRotate = !reducedMotion();
  controls.autoRotateSpeed = 0.35;

  scene.add(new THREE.HemisphereLight(0xb8c8e0, 0x1a2838, 0.55));
  scene.add(new THREE.AmbientLight(0x8aa0b8, 0.35));
  const sun = new THREE.DirectionalLight(0xf0f6ff, 1.05);
  sun.position.set(3.5, 6, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x6a88aa, 0.35);
  rim.position.set(-2, 3, -4);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(6, 48),
    new THREE.MeshStandardMaterial({ color: 0x14202c, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  const stadium = StadiumBuild.build(THREE, spec);
  scene.add(stadium);

  fitCamera(camera, controls, stadium);
  status.textContent = "";

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  function tick() {
    requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  }
  tick();
}

main().catch(function () {
  status.textContent = "Could not start viewer.";
});
