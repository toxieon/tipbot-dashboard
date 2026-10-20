// Game view camera presets (job 08): the table, the tween maths, the saved choice and the chip row.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const camerasSrc = fs.readFileSync(path.join(root, "assets/mcg/cameras.js"), "utf8");
const mountSrc = fs.readFileSync(path.join(root, "assets/mcg/mount.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const load = () => import("../assets/mcg/cameras.js");

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), map: m };
}

test("presets table: the five cameras, valid shapes, broadcast identical to mount.js CAM", async () => {
  const C = await load();
  assert.deepEqual(C.CAMERAS.map((c) => c.id), ["broadcast", "goals-north", "goals-south", "wing", "blimp"]);
  for (const c of C.CAMERAS) {
    assert.ok(C.validCamera(c), c.id + " is valid");
    assert.equal(typeof c.label, "string");
  }
  const m = mountSrc.match(/var CAM = \{fov: (\d+), pos: \[([^\]]+)\], look: \[([^\]]+)\]\};/);
  assert.ok(m, "mount.js CAM found");
  const b = C.findCamera(C.CAMERAS, "broadcast");
  assert.equal(b.fov, Number(m[1]));
  assert.deepEqual(b.pos, m[2].split(",").map(Number));
  assert.deepEqual(b.look, m[3].split(",").map(Number));
  // The two ends mirror each other.
  const n = C.findCamera(C.CAMERAS, "goals-north"), s = C.findCamera(C.CAMERAS, "goals-south");
  assert.deepEqual(n.pos.map((v, i) => (i === 0 ? -v : v)), s.pos);
  assert.deepEqual(C.CHIPS.map((c) => c.label), ["Broadcast", "Ends", "Wing", "Blimp"]);
});

test("a stadium can supply its own table; anything incomplete falls back to the MCG values", async () => {
  const C = await load();
  const own = [{ id: "broadcast", fov: 34, pos: [0, 90, 180], look: [0, 0, 0] }, { id: "wing", fov: 40, pos: [0, 60, -120], look: [0, 0, 0] }];
  assert.equal(C.camerasFor({ cameras: own }), own);
  assert.equal(C.camerasFor(null), C.CAMERAS);
  assert.equal(C.camerasFor({}), C.CAMERAS);
  assert.equal(C.camerasFor({ cameras: [own[1]] }), C.CAMERAS, "no broadcast camera");
  assert.equal(C.camerasFor({ cameras: [own[0], { id: "x", fov: 40, pos: [0, 1], look: [0, 0, 0] }] }), C.CAMERAS, "bad entry");
  // The chip for a camera the stadium doesn't have does nothing.
  assert.equal(C.nextCameraForChip("ends", "broadcast", own), "broadcast");
  assert.equal(C.nextCameraForChip("wing", "broadcast", own), "wing");
});

test("tween maths: start, middle and end, ease-out, and reduced motion jumps", async () => {
  const C = await load();
  const from = { pos: [0, 110, 200], look: [0, 0, 0], fov: 36 };
  const to = { pos: [-118, 70, 0], look: [10, 0, 0], fov: 40 };
  assert.deepEqual(C.cameraAt(from, to, 0), from);
  assert.deepEqual(C.cameraAt(from, to, 1), to);
  const mid = C.cameraAt(from, to, 0.5);
  assert.equal(C.easeOutCubic(0.5), 0.875);
  assert.ok(Math.abs(mid.pos[0] - -118 * 0.875) < 1e-9);
  assert.ok(Math.abs(mid.pos[1] - (110 - 40 * 0.875)) < 1e-9);
  assert.ok(Math.abs(mid.fov - (36 + 4 * 0.875)) < 1e-9);
  assert.ok(C.easeOutCubic(0.25) > 0.25, "ease-out is ahead of linear early on");
  assert.equal(C.easeOutCubic(-1), 0);
  assert.equal(C.easeOutCubic(2), 1);
  assert.equal(C.TWEEN_MS, 600);
  assert.equal(C.tweenProgress(1000, 1000, 600, false), 0);
  assert.equal(C.tweenProgress(1000, 1300, 600, false), 0.5);
  assert.equal(C.tweenProgress(1000, 1600, 600, false), 1);
  assert.equal(C.tweenProgress(1000, 9999, 600, false), 1, "clamped");
  assert.equal(C.tweenProgress(1000, 1000, 600, true), 1, "reduced motion: straight to the end");
});

test("minAspect widens the fov on narrow hosts and keeps the horizontal coverage", async () => {
  const C = await load();
  const cam = { id: "x", fov: 40, pos: [0, 0, 1], look: [0, 0, 0], minAspect: 1.4 };
  assert.equal(C.effectiveFov(cam, 1.95), 40);
  assert.equal(C.effectiveFov({ ...cam, minAspect: undefined }, 0.5), 40);
  const narrow = C.effectiveFov(cam, 0.7);
  assert.ok(narrow > 40);
  const halfWidth = (fov, aspect) => Math.tan((fov * Math.PI) / 360) * aspect;
  assert.ok(Math.abs(halfWidth(narrow, 0.7) - halfWidth(40, 1.4)) < 1e-9);
});

test("Ends flips between north and south; other chips go to their camera", async () => {
  const C = await load();
  assert.equal(C.nextCameraForChip("ends", "broadcast"), "goals-north");
  assert.equal(C.nextCameraForChip("ends", "goals-north"), "goals-south");
  assert.equal(C.nextCameraForChip("ends", "goals-south"), "goals-north");
  assert.equal(C.nextCameraForChip("wing", "goals-south"), "wing");
  assert.equal(C.nextCameraForChip("blimp", "blimp"), "blimp");
  assert.equal(C.nextCameraForChip("nope", "wing"), "wing");
  assert.equal(C.chipForCamera("goals-south"), "ends");
});

test("localStorage round trip (tipdash_gv_cam), with safe defaults", async () => {
  const C = await load();
  const st = memoryStorage();
  assert.equal(C.STORAGE_KEY, "tipdash_gv_cam");
  assert.equal(C.loadCameraChoice(st), "broadcast", "nothing saved");
  assert.equal(C.saveCameraChoice(st, "wing"), true);
  assert.equal(st.map.get("tipdash_gv_cam"), "wing");
  assert.equal(C.loadCameraChoice(st), "wing");
  st.setItem("tipdash_gv_cam", "drone");
  assert.equal(C.loadCameraChoice(st), "broadcast", "unknown id");
  const own = [{ id: "broadcast", fov: 34, pos: [0, 90, 180], look: [0, 0, 0] }];
  st.setItem("tipdash_gv_cam", "wing");
  assert.equal(C.loadCameraChoice(st, own), "broadcast", "camera not in this stadium's table");
  const broken = { getItem() { throw new Error("private mode"); }, setItem() { throw new Error("quota"); } };
  assert.equal(C.loadCameraChoice(broken), "broadcast");
  assert.equal(C.saveCameraChoice(broken, "wing"), false);
  assert.equal(C.loadCameraChoice(null), "broadcast");
});

test("no chip row in fallback (photo) mode", async () => {
  const C = await load();
  let touched = 0;
  const host = new Proxy({}, { get() { touched++; return () => null; } });
  assert.equal(C.mountCameraChips(host, { fallback: true, stop() {} }), null);
  assert.equal(C.mountCameraChips(host, { stop() {} }), null, "a handle without setCamera");
  assert.equal(C.mountCameraChips(null, { setCamera() {} }), null);
  assert.equal(touched, 0, "the host is never touched");
  // And the CSS hides the row whenever the photo is showing (WebGL off or lost).
  assert.match(camerasSrc, /\.fl-mcg:not\(\.is-webgl\) \.fl-cams\{display:none\}/);
});

test("chip row markup: four 44px buttons, the pressed one follows the camera, Ends names the end", async () => {
  const C = await load();
  const row = C.chipRowHtml("broadcast");
  assert.equal((row.match(/<button type="button" data-cam-chip=/g) || []).length, 4);
  assert.match(row, /data-cam-chip="broadcast" aria-pressed="true"/);
  assert.match(row, /data-cam-chip="ends" aria-pressed="false"[^>]*><span>Ends<\/span>/);
  assert.match(C.chipRowHtml("goals-south"), /data-cam-chip="ends" aria-pressed="true"[^>]*><span>South end<\/span>/);
  assert.match(camerasSrc, /\.fl-cams button\{[^}]*min-width:44px;min-height:44px;height:44px/);
  assert.match(camerasSrc, /env\(safe-area-inset-left/);
});

test("mount.js API: setCamera export, current id on the handle, logo poses stay on the broadcast camera", async () => {
  const mod = await import("../assets/mcg/mount.js");
  assert.equal(typeof mod.setCamera, "function");
  assert.equal(typeof mod.mountCameraChips, "function");
  assert.equal(mod.POSE_FOLLOWS_ACTIVE_CAMERA, false);
  assert.equal(mod.setCamera({ fallback: true, setCamera: () => true }, "wing"), false);
  assert.equal(mod.setCamera(null, "wing"), false);
  let got = null;
  assert.equal(mod.setCamera({ setCamera: (id, o) => { got = [id, o]; return true; } }, "blimp", { animate: false }), true);
  assert.deepEqual(got, ["blimp", { animate: false }]);
  assert.match(mountSrc, /get cameraId\(\) \{ return camId; \}/);
  assert.match(mountSrc, /setCamera: setCam,/);
  // Tilt still faces CAM.pos (the broadcast camera), not the active preset.
  assert.match(mountSrc, /var dx = CAM\.pos\[0\] - cx, dz = CAM\.pos\[2\] - cz;/);
  // Tweens step inside the existing draw loop; no extra model loads.
  assert.equal((mountSrc.match(/loadAsync\(/g) || []).length, 1);
  assert.match(mountSrc, /stepCam\(now\);/);
});

test("index.html mounts the chips after the ground; public-repo rules hold", () => {
  assert.match(html, /FLIVE\.mcgMod\.mountCameraChips\(host, handle\)/);
  for (const src of [camerasSrc]) {
    assert.doesNotMatch(src, /console\./);
    assert.doesNotMatch(src, /window\.open|target="_blank"/);
  }
});
