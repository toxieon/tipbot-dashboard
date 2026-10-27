// The live connection diagnostic's checks, without any network.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("the diagnostic reads the page's API base and accepts only TipBot", async () => {
  const d = await import("../scripts/live-diagnostic.mjs");
  const base = d.apiBaseFrom(HTML);
  assert.equal(base, "https://afl-tipster-bot.onrender.com");
  assert.equal(d.isTipBotBase(base), true);
  assert.equal(d.isTipBotBase(""), false);
  assert.equal(d.isTipBotBase("https://afl-tipster-bot.onrender.com.evil.example"), false);
  assert.equal(d.isTipBotBase("http://afl-tipster-bot.onrender.com"), false);
  assert.equal(d.isTipBotBase("https://tipdashhq.com"), false);
});

test("the diagnostic flags a servers payload with an image off the Discord CDN", async () => {
  const d = await import("../scripts/live-diagnostic.mjs");
  const ok = { icon_url: "https://cdn.discordapp.com/icons/1/a.png", owner_avatar_url: null };
  assert.deepEqual(d.badImageUrls([ok, {}]), []);
  assert.deepEqual(d.badImageUrls([{ icon_url: "https://evil.example/a.png" }]), ["icon_url"]);
  assert.deepEqual(d.badImageUrls([{ owner_avatar_url: "http://cdn.discordapp.com/a.png" }]), ["owner_avatar_url"]);
});

test("the diagnostic never prints or stores the session token", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "scripts", "live-diagnostic.mjs"), "utf8");
  assert.doesNotMatch(src, /console\.log\([^)]*token/i);
  assert.doesNotMatch(src, /writeFile/);
});
