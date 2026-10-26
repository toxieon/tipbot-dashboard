// Sponsor banner frame (scale, rotation, pan) on the AFL boards and the venue ribbons.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

function recorder() {
  const calls = [];
  const ctx = {};
  for (const name of ["drawImage", "save", "restore", "translate", "rotate", "scale"]) {
    ctx[name] = (...args) => calls.push([name, ...args]);
  }
  return { ctx, calls };
}
const pic = { naturalWidth: 1920, naturalHeight: 223 };

test("scale 1, rotation 0 and no pan is the old drawImage call", async () => {
  const B = await import("../assets/mcg/boards/boards.js");
  const { ctx, calls } = recorder();
  B.slideImage(ctx, pic, { fill: true }, 1024, 119);
  // Old code: h = 119, w = h * 1920 / 223 = 1024.5 > 1024 -> w = 1024, h = 1024 * 223 / 1920.
  const h = 1024 * 223 / 1920;
  assert.deepEqual(calls, [["drawImage", pic, 0, (119 - h) / 2, 1024, h]]);
  const again = recorder();
  B.slideImage(again.ctx, pic, B.sponsorSlide({ image: "x" }), 1024, 119);
  assert.deepEqual(again.calls, calls);
  // House slides (no fill) keep their 80% height.
  const house = recorder();
  B.slideImage(house.ctx, { naturalWidth: 400, naturalHeight: 100 }, {}, 1024, 119);
  assert.deepEqual(house.calls, [["drawImage", { naturalWidth: 400, naturalHeight: 100 }, (1024 - 380.8) / 2, (119 - 95.2) / 2, 380.8, 95.2]]);
});

test("a framed banner is panned, turned and scaled about the frame centre", async () => {
  const B = await import("../assets/mcg/boards/boards.js");
  const { ctx, calls } = recorder();
  const slide = B.sponsorSlide({ image: "x", scale: 2, rot: 90, pan_x: 0.5, pan_y: -1 });
  B.slideImage(ctx, pic, slide, 1024, 119);
  const h = 1024 * 223 / 1920;
  assert.deepEqual(calls, [
    ["save"],
    ["translate", 512 + 256, 59.5 - 59.5],
    ["rotate", Math.PI / 2],
    ["scale", 2, 2],
    ["drawImage", pic, -512, -h / 2, 1024, h],
    ["restore"]
  ]);
  assert.equal(calls[2][1], Math.PI / 2);   // 90 degree steps stay exact
});

test("sponsor slides keep the frame and the old defaults", async () => {
  const B = await import("../assets/mcg/boards/boards.js");
  assert.deepEqual(B.sponsorSlide({ image: "a.png", duration: 5 }), {
    image: "a.png", duration: 5, scroll: 0, bg: "#000", fill: true, scale: 1, rot: 0, pan_x: 0, pan_y: 0
  });
  assert.deepEqual(B.sponsorSlide({ image: "a.png", scale: 0.5, rot: -90, pan_x: 0.1, pan_y: 0.2 }).scale, 0.5);
  assert.equal(B.sponsorSlide({ image: "a.png", duration: 1 }).duration, 2);
});

test("both slide copies and the game view use the frame", () => {
  const boards = fs.readFileSync(path.join(root, "assets/mcg/boards/boards.js"), "utf8");
  const kit = fs.readFileSync(path.join(root, "assets/venues/kit.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(boards, /if\(im\)slideImage\(x,im,s,cv\.width,cv\.height\);/);
  assert.match(boards, /cfg\.slides=want\.map\(sponsorSlide\);/);
  assert.match(kit, /import \{ ledTwoSided, slideImage, sponsorSlide \} from "\.\.\/mcg\/boards\/boards\.js";/);
  assert.match(kit, /if \(im\) slideImage\(x, im, s, cv\.width, cv\.height\);/);
  assert.match(kit, /slides = want\.map\(sponsorSlide\);/);
  assert.match(html, /duration:b\.seconds, scale:b\.scale, rot:b\.rot, pan_x:b\.pan_x, pan_y:b\.pan_y\}/);
});
