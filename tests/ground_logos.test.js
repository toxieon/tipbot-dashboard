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
  assert.match(html, /mod\.projectGround\(g\.x, g\.z, W, H\)/);
});

test("the 3D mount celebrates a logo and takes sponsor banners", () => {
  assert.match(mount, /export function projectGround/);
  assert.match(mount, /function celebrate\(id, label\)/);
  assert.match(mount, /celebrate: celebrate/);
  assert.match(mount, /setBoards: function/);
  assert.match(mount, /T\.AdditiveBlending/);
  assert.match(mount, /if \(still\)/);
  assert.match(mount, /rotation\.y = T\.MathUtils\.degToRad\(-yaw\)/);
  assert.match(boards, /async function setSlides/);
  assert.match(afl, /TBLiveFx\.ballSkin/);
});

test("a ball skin only accepts image URLs and escapes them", () => {
  assert.match(afl, /\^\(blob:\|data:image/);
  assert.match(afl, /replace\(\/"\/g, "&quot;"\)/);
});
