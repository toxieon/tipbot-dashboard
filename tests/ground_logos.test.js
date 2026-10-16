const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mount = fs.readFileSync(path.join(root, "assets/mcg/mount.js"), "utf8");
const Live = require("../assets/follower-live.js");

test("a logo lights only when an assigned server has a win on this game", () => {
  const logo = {servers: ["100", "200"], lit: true};
  const win = [{status: "win"}];
  const pending = [{status: "pending"}];
  assert.equal(Live.logoLit(logo, "100", win), true);
  assert.equal(Live.logoLit(logo, "200", win), true);
  assert.equal(Live.logoLit(logo, "300", win), false);
  assert.equal(Live.logoLit(logo, "100", pending), false);
  assert.equal(Live.logoLit({lit: true}, "100", pending), true);
  assert.equal(Live.logoLit({servers: "100,200"}, "200", [{status: "won"}]), true);
});

test("game view asks for ground logos and paints a lit mark", () => {
  assert.match(html, /\/api\/ground\/logos\?guild_id=/);
  assert.match(html, /function fliveLogos/);
  assert.match(html, /function fliveLogoLayer/);
  assert.match(html, /function fliveMarkLit/);
  assert.match(html, /FollowerLive\.logoLit/);
  assert.match(html, /logo\.lit\|\|logo\.winning/);
  assert.match(html, /fliveLogos\(handle\)/);
  assert.match(html, /if\(won\.length\) fliveLogos\(\)/);
  assert.match(html, /fl-logo-pulse/);
  assert.match(html, /scale\(1\.1\)/);
  assert.match(html, /className="fl-logo"/);
  assert.match(html, /w\*2\*fit/);
  assert.equal(html.includes("layer.hidden=webgl"), false);
  assert.equal(html.includes("Math.max(36"), false);
});

test("the ground mount places, rotates, and lights a logo", () => {
  assert.match(mount, /function setLogos/);
  assert.match(mount, /setLogos: setLogos/);
  assert.match(mount, /logo\.rot \|\| logo\.rotation/);
  assert.match(mount, /logo\.lit \|\| logo\.winning/);
  assert.match(mount, /0xf4e04d/);
  assert.match(mount, /rotation\.y = T\.MathUtils\.degToRad\(-yaw\)/);
});
