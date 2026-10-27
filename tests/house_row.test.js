// TipBot's own banner as one row of the sponsor playing order (scene "house").
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const HOUSE = [
  { image: "/assets/mcg/boards/tipbot-lockup.svg", duration: 6, scroll: 0.35, bg: "#0F1420" },
  { image: "/assets/mcg/boards/tipbot-wordmark.svg", duration: 5, scroll: -0.5, bg: "#0F1420" }
];
const sponsors = [{ image: "a", duration: 8, scroll: 0 }, { image: "b", duration: 10, scroll: 0.35 }];

test("TipBot plays at its place for its seconds, keeping its scroll", async () => {
  const B = await import("../assets/mcg/boards/boards.js");
  const out = B.withHouse(sponsors, ["A", "B"], HOUSE, ["L", "W"], { on: true, seconds: 11, position: 1 });
  assert.deepEqual(out.slides.map((s) => s.image), ["a", HOUSE[0].image, HOUSE[1].image, "b"]);
  assert.deepEqual(out.imgs, ["A", "L", "W", "B"]);
  assert.equal(out.slides[1].duration + out.slides[2].duration, 11);
  assert.equal(out.slides[1].duration, 6);
  assert.deepEqual([out.slides[1].scroll, out.slides[2].scroll], [0.35, -0.5]);
  assert.equal(HOUSE[0].duration, 6, "the house list itself is not changed");
  const first = B.withHouse(sponsors, ["A", "B"], HOUSE, ["L", "W"], { on: true, seconds: 8, position: 0 });
  assert.equal(first.slides[0].image, HOUSE[0].image);
  const last = B.withHouse(sponsors, ["A", "B"], HOUSE, ["L", "W"], { on: true, seconds: 8, position: 99 });
  assert.deepEqual(last.slides.map((s) => s.image).slice(0, 2), ["a", "b"]);
  assert.ok(Math.abs(last.slides[2].duration - 8 * 6 / 11) < 1e-9);
});

test("off, or an older bot without a row, plays sponsors only", async () => {
  const B = await import("../assets/mcg/boards/boards.js");
  for (const row of [null, undefined, { on: false, seconds: 8, position: 0 }]) {
    const out = B.withHouse(sponsors, ["A", "B"], HOUSE, ["L", "W"], row);
    assert.deepEqual(out.slides.map((s) => s.image), ["a", "b"]);
    assert.deepEqual(out.imgs, ["A", "B"]);
  }
});

test("with no sponsor banner TipBot always shows, and both renderers take the row", () => {
  const boards = fs.readFileSync(path.join(root, "assets/mcg/boards/boards.js"), "utf8");
  const kit = fs.readFileSync(path.join(root, "assets/venues/kit.js"), "utf8");
  const mount = fs.readFileSync(path.join(root, "assets/mcg/mount.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  // An empty list restores the house slides before any row is read.
  assert.match(boards, /if\(!want\.length\)\{cfg\.slides=house;/);
  assert.match(kit, /if \(!want\.length\) \{ slides = house\.slice\(\);/);
  assert.match(boards, /withHouse\(want\.map\(sponsorSlide\),loaded,house,houseImgs,row\)/);
  assert.match(kit, /withHouse\(want\.map\(sponsorSlide\), loaded, house, houseImgs, row\)/);
  assert.match(mount, /setBoards: function \(slides, row\)/);
  assert.match(kit, /setBoards: function \(list, row\)/);
  assert.match(html, /house:d\.house\|\|null\}/);
  assert.match(html, /handle\.setBoards\(FLIVE\.sponsors\.boards, FLIVE\.sponsors\.house\)/);
  assert.doesNotMatch(html + kit + boards, /Include TipBot in rotation/);
});
