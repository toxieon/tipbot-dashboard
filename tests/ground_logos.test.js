const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mount = fs.readFileSync(path.join(root, "assets/mcg/mount.js"), "utf8");
const boards = fs.readFileSync(path.join(root, "assets/mcg/boards/boards.js"), "utf8");
const afl = fs.readFileSync(path.join(root, "assets/fx/afl-match.js"), "utf8");

test("game view reads one sponsor scene and polls hits for that game", () => {
  assert.match(html, /\/api\/ground\/scene\?game=/);
  assert.match(html, /\/api\/ground\/hits\?game=/);
  assert.match(html, /function fliveSponsors/);
  assert.match(html, /function fliveHitsPoll/);
  assert.match(html, /function fliveQueueHit/);
  assert.match(html, /setTimeout\(next, 1500\)/);
  assert.match(html, /handle\.setBoards\(FLIVE\.sponsors\.boards\)/);
  assert.match(html, /window\.TBLiveFx\.ballSkin=ball/);
  // hits already settled when the page opens are marked seen, not replayed
  assert.match(html, /\(d\.hits\|\|\[\]\)\.forEach\(function\(h\)\{ FLIVE\.hitSeen\[h\.id\]=1; \}\)/);
});

test("the flat 400 x 220 logo overlay is gone", () => {
  assert.doesNotMatch(html, /fliveLogoLayer|fliveMarkLit|fl-logo-layer|\/api\/ground\/logos/);
  assert.doesNotMatch(html, /x\/84\)\*168/);
  assert.doesNotMatch(html, /translate\(-50%,-50%\) rotate/);
  assert.match(html, /mod\.screenQuad\(g, W, H\)/);
  assert.match(html, /mod\.cssMatrix\(100, 100, quad\)/);
  assert.match(html, /transformOrigin="0 0"/);
});

test("the 3D mount celebrates a logo and takes sponsor banners", () => {
  assert.match(mount, /export function projectGround/);
  assert.match(mount, /export function screenQuad/);
  assert.match(mount, /export function cssMatrix/);
  assert.match(mount, /export function placeLogo/);
  assert.match(mount, /function celebrate\(id, label\)/);
  assert.match(mount, /celebrate: celebrate/);
  assert.match(mount, /setBoards: function/);
  assert.match(mount, /T\.AdditiveBlending/);
  assert.match(mount, /if \(still\)/);
  assert.match(mount, /placeLogo\(mesh, logo, 0\.4\)/);
  assert.match(mount, /glow\.quaternion\.copy\(mesh\.quaternion\)/);
  assert.match(mount, /glow\.position\.y -= 0\.06/);
  assert.doesNotMatch(mount, /rotation\.y = T\.MathUtils\.degToRad\(-yaw\)/);
  assert.match(boards, /async function setSlides/);
  assert.match(afl, /TBLiveFx\.ballSkin/);
});

test("sponsor files stay cached and the scene revalidates", () => {
  assert.match(html, /rel="preload" as="image" href="\.\/assets\/mcg\/fallback\.png"/);
  assert.match(html, /rel="preload" as="fetch" href="\.\/assets\/mcg\/mcg\.glb" crossorigin/);
  assert.match(html, /function warmGround\(/);
  assert.match(html, /groundFetch\("\/api\/ground\/scene\?game=&venue=mcg", "no-cache"\)/);
  assert.match(html, /function keep\(url\)/);
  assert.match(html, /groundFetch\(url, "force-cache"\)/);
  assert.match(html, /rememberGroundScene\(d, "mcg"\)/);
  assert.match(html, /rememberGroundScene\(d, FLIVE\.venue\|\|"mcg"\)/);
  assert.match(html, /"&venue="\+encodeURIComponent\(venue\)/);
  assert.match(html, /cache:cacheMode\|\|"force-cache"/);
  assert.match(html, /performance\.mark\("flive-open"\)/);
  assert.match(html, /performance\.mark\("flive-ground"\)/);
  assert.match(html, /performance\.measure\("flive-ground-paint", "flive-open", "flive-ground"\)/);
  assert.match(html, /\.fl-mcg canvas,\.fl-mcg-canvas\{z-index:1;visibility:hidden/);
  const own = html.slice(html.indexOf("function openGameView"), html.indexOf("async function fliveProbeLive"));
  assert.match(own, /fliveBeginGround\(\)/);
  assert.match(own, /fliveWatchStadium\(\)/);
  assert.match(own, /fliveMount\(\);\n    fliveLoadOwn\(false, \{opening:true, refreshFeeds:true\}\)/);
  const loadOwn = html.slice(html.indexOf("async function fliveLoadOwn"), html.indexOf("function openGameView"));
  assert.doesNotMatch(loadOwn, /fliveMount\(|fliveSponsors\(|fliveBeginGround\(/);
  const blob = html.slice(html.indexOf("function fliveBlob"), html.indexOf("function fliveSponsors"));
  assert.match(blob, /groundFetch\(url, "force-cache"\)/);
  assert.doesNotMatch(blob, /\bapi\(/);
  assert.doesNotMatch(html, /api\("\/api\/ground\/scene/);
  assert.match(html, /api\("\/api\/ground\/hits\?game=/);
  const loadAt = html.indexOf("async function load()");
  const boot = html.slice(loadAt, html.indexOf("function saveThemePrefs", loadAt));
  assert.match(boot, /warmTipBot\(\);\n    warmGround\(\);/);
  const early = html.slice(html.lastIndexOf("if(getToken())"), html.lastIndexOf("if(getToken())") + 80);
  assert.match(early, /warmTipBot\(\); warmGround\(\)/);
  const ping = html.slice(html.indexOf("softPingLifecycle"), html.indexOf("function getToken"));
  assert.match(ping, /warmTipBot\(\)/);
  assert.doesNotMatch(ping, /warmGround/);
});

test("a tilt stands the far edge up and the photo quad is perspective", async () => {
  const mod = await import("../assets/mcg/mount.js");
  const T = await import("../assets/vendor/three/three.module.min.js");
  const flat = mod.screenQuad({x: 0, z: 0, w: 14, d: 10, rot: 0, angle: 0}, 780, 552);
  const missing = mod.screenQuad({x: 0, z: 0, w: 14, d: 10, rot: 0}, 780, 552);
  assert.deepEqual(missing, flat);
  const quad = mod.screenQuad({x: 0, z: 0, w: 14, d: 10, rot: 0, angle: 40}, 780, 552);
  const farW = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
  const nearW = Math.hypot(quad[2].x - quad[3].x, quad[2].y - quad[3].y);
  assert.ok(quad[0].y < quad[3].y);
  assert.ok(farW / nearW < 0.82, "40° far edge is foreshortened, ratio " + (farW / nearW));
  function ratio(angle) {
    const q = mod.screenQuad({x: 0, z: 0, w: 14, d: 10, rot: 0, angle: angle}, 780, 552);
    const fw = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
    const nw = Math.hypot(q[2].x - q[3].x, q[2].y - q[3].y);
    assert.ok(q[0].y < q[3].y);
    return fw / nw;
  }
  const r0 = ratio(0);
  const r45 = ratio(45);
  const r70 = ratio(70);
  const r80 = ratio(80);
  assert.ok(r0 > 0.94 && r0 < 0.98);
  assert.ok(r45 < 0.78, "45° keystone " + r45);
  assert.ok(r70 < r45, "70° is stronger than 45°");
  assert.ok(r80 < r70, "80° is stronger than 70°");
  assert.ok(r80 < 0.6, "80° keystone " + r80);
  const clamped = mod.screenQuad({x: 0, z: 0, w: 14, d: 10, rot: 0, angle: 99}, 780, 552);
  const cap = mod.screenQuad({x: 0, z: 0, w: 14, d: 10, rot: 0, angle: 80}, 780, 552);
  assert.deepEqual(clamped, cap);
  const css = mod.cssMatrix(100, 100, quad);
  assert.match(css, /^matrix3d\(/);
  const nums = css.slice(9, -1).split(",").map(Number);
  assert.ok(Math.abs(nums[3]) + Math.abs(nums[7]) > 1e-6);
  function apply(u, v) {
    const x = nums[0] * u + nums[4] * v + nums[12];
    const y = nums[1] * u + nums[5] * v + nums[13];
    const w = nums[3] * u + nums[7] * v + nums[15];
    return {x: x / w, y: y / w};
  }
  const back = [apply(0, 0), apply(100, 0), apply(100, 100), apply(0, 100)];
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.hypot(back[i].x - quad[i].x, back[i].y - quad[i].y) < 0.02);
  }

  function worldYs(logo) {
    const mesh = new T.Mesh(new T.PlaneGeometry(logo.w, logo.d));
    mod.placeLogo(mesh, logo, 0.4);
    mesh.updateMatrixWorld(true);
    const pos = mesh.geometry.attributes.position;
    const v = new T.Vector3();
    const out = [];
    for (let i = 0; i < pos.count; i++) {
      out.push(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).clone());
    }
    return out;
  }
  const flatPts = worldYs({x: 12, z: -4, w: 14, d: 10, rot: 20});
  for (const p of flatPts) assert.ok(Math.abs(p.y - 0.4) < 1e-6);
  const up = worldYs({x: 0, z: 0, w: 14, d: 10, rot: 0, angle: 40});
  const far = up.filter((p) => p.z < 0);
  const near = up.filter((p) => p.z > 0);
  assert.equal(far.length, 2);
  assert.equal(near.length, 2);
  assert.ok(far.every((p) => p.y > 1));
  assert.ok(near.every((p) => Math.abs(p.y - 0.4) < 1e-4));
});

test("a ball skin only accepts image URLs and escapes them", () => {
  assert.match(afl, /\^\(blob:\|data:image/);
  assert.match(afl, /replace\(\/"\/g, "&quot;"\)/);
});

// 0.66.12: one scene per ground. The studio picks which tipsters' logos show on each.
test("each ground draws only its own logos; an older bot keeps logos on the AFL field", () => {
  const start = html.indexOf("  function sceneLogosFor(d, venue){");
  const c = {};
  require("node:vm").createContext(c);
  require("node:vm").runInContext(html.slice(start, html.indexOf("\n  }\n", start) + 4), c);
  const a = {id: "a"}, b = {id: "b"};
  const L = (d, v) => JSON.parse(JSON.stringify(c.sceneLogosFor(d, v)));   // vm realm -> this realm
  assert.deepEqual(L({venue: "arena", ground: [a]}, "arena"), [a]);
  assert.deepEqual(L({venue: "arena", ground: [a]}, "mcg"), []);
  assert.deepEqual(L({ground: [a, b]}, "mcg"), [a, b]);      // no venue: an older TipBot
  assert.deepEqual(L({ground: [a, b]}, "arena"), []);         // never on the court
  assert.deepEqual(L(null, "mcg"), []);
  assert.match(html, /const ground=await Promise\.all\(sceneLogosFor\(d, FLIVE\.venue\)\.map/);
  assert.match(html, /const GROUND_SCENE_KEY="tipdash_ground_scene_v2";/);
});

test("the court paints studio logos scaled from the oval layout", async () => {
  const A = await import("../assets/venues/arena.js");
  assert.ok(A.COURT_LOGO_SCALE > 0 && A.COURT_LOGO_SCALE < 0.2);
  const edge = A.courtLogoPlacement({x: 84, z: 71.5, w: 14, d: 4.7, rot: 90});
  assert.ok(Math.abs(edge.x) <= A.COURT.w / 2 && Math.abs(edge.z) <= A.COURT.d / 2, "an oval-edge logo stays on the court");
  assert.equal(edge.rot, 90);
  const centre = A.courtLogoPlacement({x: 0, z: 0, w: 20, d: 10});
  assert.equal(centre.w / centre.d, 2, "shape kept");
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "assets", "venues", "arena.js"), "utf8");
  assert.match(src, /setLogos: setLogos,/);
});
