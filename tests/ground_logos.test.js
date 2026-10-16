const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mount = fs.readFileSync(path.join(root, "assets/mcg/mount.js"), "utf8");

test("game view asks for ground logos and paints a lit mark", () => {
  assert.match(html, /\/api\/ground\/logos\?guild_id=/);
  assert.match(html, /function fliveLogos/);
  assert.match(html, /fliveLogoLayer/);
  assert.match(html, /logo\.lit\|\|logo\.winning/);
  assert.match(html, /fliveLogos\(handle\)/);
});

test("the ground mount places, rotates, and lights a logo", () => {
  assert.match(mount, /function setLogos/);
  assert.match(mount, /setLogos: setLogos/);
  assert.match(mount, /logo\.rot \|\| logo\.rotation/);
  assert.match(mount, /logo\.lit \|\| logo\.winning/);
  assert.match(mount, /0xf4e04d/);
});
