const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets/stadium.js"), "utf8");
const missing = fs.readFileSync(path.join(root, "404.html"), "utf8");
const SECRET = /forward|mirror|master|consensus/i;

test("stadium client points at TipBot and stays public-safe", () => {
  assert.match(src, /https:\/\/afl-tipster-bot\.onrender\.com/);
  assert.match(src, /\/api\/games\//);
  assert.match(src, /\/sponsors/);
  assert.match(src, /\/api\/stadium\.js/);
  assert.match(src, /TipStadium/);
  assert.doesNotMatch(src, SECRET);
  assert.doesNotMatch(src, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  assert.doesNotMatch(src, /MCG|Brandon|274753853516283905/);
});

test("sponsorsUrl builds the public images route", () => {
  const api = {};
  const run = new Function("window", "globalThis", src + "\nreturn window.TipStadium;");
  const client = run({}, {});
  assert.equal(
    client.sponsorsUrl("game 1"),
    "https://afl-tipster-bot.onrender.com/api/games/game%201/sponsors"
  );
  assert.equal(
    client.assetUrl("game 1", "abc"),
    "https://afl-tipster-bot.onrender.com/api/games/game%201/sponsors/abc"
  );
});

test("a long /o/ address is loaded from TipBot and other 404s stay", () => {
  assert.match(missing, /\[A-Za-z0-9_-\]\{32,\}/);
  assert.match(missing, /dataset\.site = "gate"/);
  assert.match(missing, /\/api\/me/);
  assert.match(missing, /afl-tipster-bot\.onrender\.com/);
  assert.match(missing, /That page isn’t here/);
  assert.match(missing, /\/t\//);
  assert.match(missing, /tipsterHandleFromPath/);
  assert.doesNotMatch(missing, SECRET);
  assert.doesNotMatch(missing, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
});
