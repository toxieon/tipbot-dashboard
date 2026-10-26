// Ground logos placed per ground (studio pose) and their tilt on non-AFL grounds.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("a logo without a pose keeps the scaled AFL layout", async () => {
  const K = await import("../assets/venues/kit.js");
  const court = { w: 28, d: 15 };
  const k = K.logoScale(court);
  const at = K.logoPlacement({ x: 40, z: -20, w: 20, d: 7, rot: 10, angle: 30 }, court);
  assert.ok(Math.abs(at.x - 40 * k) < 1e-9);
  assert.ok(Math.abs(at.z + 20 * k) < 1e-9);
  assert.ok(Math.abs(at.w - 20 * k) < 1e-9);
  assert.ok(Math.abs(at.d - 7 * k) < 1e-9);
  assert.equal(at.rot, 10);
  assert.equal(at.angle, 30);
});

test("a logo placed on this ground is drawn as is, offset by the field centre", async () => {
  const K = await import("../assets/venues/kit.js");
  const court = { w: 28, d: 15 };
  assert.deepEqual(K.logoPlacement({ x: -8, z: 3, w: 6, d: 2, rot: -170, angle: 20, pose: true }, court),
    { x: -8, z: 3, w: 6, d: 2, rot: -170, angle: 20 });
  const outfield = { w: 70, d: 70, x: 52, z: 52 };
  const at = K.logoPlacement({ x: 5, z: -5, w: 10, d: 4, rot: 0, pose: true }, outfield);
  assert.deepEqual([at.x, at.z, at.w, at.d, at.angle], [57, 47, 10, 4, 0]);
  // Angle is clamped like every other renderer.
  assert.equal(K.logoPlacement({ angle: 200, pose: true }, court).angle, 80);
  assert.equal(K.logoPlacement({ angle: "up", pose: true }, court).angle, 0);
});

test("the tilt raises the far edge and keeps the near edge on the floor", async () => {
  const K = await import("../assets/venues/kit.js");
  const T = K.T;
  const cam = [0, 13.5, 17.5];                       // the arena's broadcast camera
  const at = { x: 0, z: 0, w: 6, d: 2, rot: 0, angle: 40 };
  const mesh = new T.Mesh(new T.PlaneGeometry(at.w, at.d));
  mesh.rotation.set(-Math.PI / 2, 0, 0);
  mesh.position.set(at.x, 0.03, at.z);
  const axis = K.logoTiltAxis(at, cam);
  mesh.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(axis[0], axis[1], axis[2]), at.angle * Math.PI / 180));
  mesh.updateMatrixWorld(true);
  const pos = mesh.geometry.attributes.position;
  const pts = [];
  for (let i = 0; i < pos.count; i++) pts.push(new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  const far = pts.filter((p) => p.z < 0), near = pts.filter((p) => p.z > 0);
  assert.equal(far.length, 2);
  const lowNear = Math.min(...near.map((p) => p.y)), highFar = Math.min(...far.map((p) => p.y));
  assert.ok(highFar > lowNear + 1, "far edge (away from the camera) is the raised one");
  assert.deepEqual(K.logoTiltAxis({ x: 0, z: 0 }, [0, 10, 20]), [1, 0, -0]);
});

test("every ground's setLogos applies the tilt, the game view keeps the pose flag", () => {
  const kit = fs.readFileSync(path.join(root, "assets/venues/kit.js"), "utf8");
  assert.match(kit, /var axis = logoTiltAxis\(at, first\.pos\);/);
  assert.match(kit, /mesh\.position\.y \+= 0\.03 - minY;/);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  // Scene logos pass through whole (Object.assign), so pose and angle reach setLogos.
  assert.match(html, /return Object\.assign\(\{\}, g, \{url:await fliveBlob\(g\.url\)\}\);/);
});
