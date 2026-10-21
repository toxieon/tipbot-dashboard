const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const FL = require("../assets/follower-live.js");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("refresh button shows when the setting is on for any followed server", () => {
  assert.equal(FL.refreshEnabled([]), false);
  assert.equal(FL.refreshEnabled([{ gv_refresh_button: false }, {}]), false);
  assert.equal(FL.refreshEnabled([{ gv_refresh_button: false }, { gv_refresh_button: true }]), true);
});

test("refresh button markup: labelled, 38px circle, spins and disables while busy", () => {
  const idle = FL.refreshButtonHtml(false);
  assert.match(idle, /aria-label="Refresh game"/);
  assert.doesNotMatch(idle, /disabled/);
  const busy = FL.refreshButtonHtml(true);
  assert.match(busy, /disabled/);
  assert.match(busy, /is-busy/);
  assert.match(FL.REFRESH_CSS, /width:38px;height:38px;border-radius:50%/);
  assert.match(FL.REFRESH_CSS, /safe-area-inset-right/);
  assert.match(FL.REFRESH_CSS, /fl-refresh-spin/);
});

test("Game view wires the flag from the follower payload and re-reads the game on tap", () => {
  assert.match(html, /gv_refresh_button:!!d\.gv_refresh_button/);
  assert.match(html, /FLIVE\.refreshOn=FollowerLive\.refreshEnabled\(packs\)/);
  assert.match(html, /function fliveRefreshNow\(\)[\s\S]*?fliveReadGame\(g\)/);
  assert.match(html, /FLIVE\.refreshOn=false;/);
});
