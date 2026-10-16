const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const mount = fs.readFileSync(path.join(root, "assets/mcg/mount.js"), "utf8");
const live = fs.readFileSync(path.join(root, "assets/follower-live.js"), "utf8");
const Live = require("../assets/follower-live.js");

test("game view paints the logos the API returns and uses its lit field", () => {
  assert.equal(Live.logoLit, undefined);
  assert.equal(Live.logoServers, undefined);
  assert.match(html, /\/api\/ground\/logos\?guild_id=/);
  assert.match(html, /function fliveLogos/);
  assert.match(html, /function fliveLogoLayer/);
  assert.match(html, /function fliveMarkLit/);
  assert.match(html, /lit: !!\(logo&&logo\.lit\)/);
  assert.match(html, /logo\.lit\?" is-lit"/);
  assert.doesNotMatch(html, /FollowerLive\.logoLit/);
  assert.doesNotMatch(html, /logo\.servers/);
  assert.doesNotMatch(live, /function logoLit/);
  assert.doesNotMatch(live, /function logoServers/);
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
  assert.match(mount, /logo\.lit/);
  assert.doesNotMatch(mount, /logo\.winning/);
  assert.doesNotMatch(mount, /logo\.servers/);
  assert.match(mount, /0xf4e04d/);
  assert.match(mount, /rotation\.y = T\.MathUtils\.degToRad\(-yaw\)/);
});
