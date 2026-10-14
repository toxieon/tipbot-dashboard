// node --test tests/pwa.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const version = read("VERSION").trim();
const policy = require("../assets/pwa-cache.js");
const html = read("index.html");
const sw = read("sw.js");
const pwa = read("assets/pwa.js");
const offline = read("offline.html");

const ORIGIN = "https://tipdashhq.com";

function decide(url, extra) {
  return policy.decide(Object.assign({ url, origin: ORIGIN, method: "GET", mode: "cors" }, extra || {}));
}

test("manifest names the app, uses the existing icons, and installs standalone", () => {
  const man = JSON.parse(read("manifest.webmanifest"));
  assert.equal(man.name, "TipBot Dashboard");
  assert.equal(man.short_name, "TipBot");
  assert.equal(man.display, "standalone");
  assert.equal(man.theme_color, "#0F1420");
  assert.equal(man.background_color, "#0F1420");
  assert.equal(man.start_url, "/");
  assert.equal(man.scope, "/");
  assert.ok(man.icons.some((i) => i.sizes === "192x192" && i.src === "assets/icon-192.png" && i.purpose === "any"));
  assert.ok(man.icons.some((i) => i.sizes === "512x512" && i.src === "assets/icon-512.png" && i.purpose === "any"));
  assert.ok(man.icons.some((i) => i.purpose === "maskable" && i.sizes === "512x512"));
  for (const ic of man.icons) assert.ok(fs.existsSync(path.join(root, ic.src)), ic.src);
});

test("service worker version matches VERSION and the shell files exist", () => {
  assert.equal(policy.VERSION, version);
  assert.equal(policy.CACHE, "tipdash-shell-" + version);
  assert.match(sw, new RegExp("tipdash sw " + version.replace(/\./g, "\\.")));
  assert.match(html, new RegExp('<script src="\\./assets/pwa\\.js\\?v=' + version.replace(/\./g, "\\.") + '"></script>'));
  assert.match(html, new RegExp('href="\\./assets/pwa\\.css\\?v=' + version.replace(/\./g, "\\.")));
  for (const rel of policy.SHELL) {
    const file = (rel === "/" ? "/index.html" : rel).split("?")[0].replace(/^\//, "");
    assert.ok(fs.existsSync(path.join(root, file)), rel);
  }
});

test("API, auth, and session-bearing requests are network-only", () => {
  assert.equal(decide(ORIGIN + "/api/servers"), "network-only");
  assert.equal(decide(ORIGIN + "/api/terms/accept", { method: "POST" }), "network-only");
  assert.equal(decide(ORIGIN + "/API/me"), "network-only");
  assert.equal(decide(ORIGIN + "/auth/login"), "network-only");
  assert.equal(decide("https://afl-tipster-bot.onrender.com/api/servers", {
    headers: { Authorization: "Bearer t" },
  }), "network-only");
  assert.equal(decide("https://afl-tipster-bot.onrender.com/auth/login", { mode: "navigate" }), "ignore");
  assert.equal(decide(ORIGIN + "/assets/logo.svg", { headers: { Authorization: "Bearer t" } }), "network-only");
  assert.equal(decide(ORIGIN + "/assets/app.js", { headers: { Range: "bytes=0-10" } }), "network-only");
  assert.equal(decide(ORIGIN + "/sw.js"), "network-only");
  assert.equal(decide("data:text/plain,hi"), "ignore");
  assert.equal(decide(ORIGIN + "/apiculture"), "network-only");
  assert.equal(decide(ORIGIN + "/apiculture", { mode: "navigate" }), "navigation");
});

test("shell navigations and static assets are the only cacheable kinds", () => {
  assert.equal(decide(ORIGIN + "/", { mode: "navigate", accept: "text/html" }), "navigation");
  assert.equal(decide(ORIGIN + "/index.html", { mode: "navigate" }), "navigation");
  assert.equal(decide(ORIGIN + "/offline.html", { mode: "navigate" }), "navigation");
  assert.equal(decide(ORIGIN + "/assets/tbtime.js?v=" + version), "static");
  assert.equal(decide(ORIGIN + "/bookies.json"), "static");
  assert.equal(decide(ORIGIN + "/manifest.webmanifest?v=" + version), "static");
  assert.equal(decide(ORIGIN + "/assets/icon-512.png"), "static");
});

test("private and non-basic responses are not stored", () => {
  const ok = { status: 200, type: "basic", headers: {} };
  assert.equal(policy.canStore(ok), true);
  assert.equal(policy.canStore({ status: 200, type: "basic", headers: { "cache-control": "no-store" } }), false);
  assert.equal(policy.canStore({ status: 200, type: "basic", headers: { "cache-control": "private, max-age=0" } }), false);
  assert.equal(policy.canStore({ status: 200, type: "basic", headers: { "set-cookie": "sid=1" } }), false);
  assert.equal(policy.canStore({ status: 200, type: "basic", headers: { vary: "Authorization" } }), false);
  assert.equal(policy.canStore({ status: 200, type: "opaque", headers: {} }), false);
  assert.equal(policy.canStore({ status: 401, type: "basic", headers: {} }), false);
  assert.equal(policy.canStore(null), false);
});

test("the network-only path never opens a cache", () => {
  const fn = sw.slice(sw.indexOf("function fromNetwork"), sw.indexOf("function putIfAllowed"));
  assert.match(fn, /cache: "no-store"/);
  assert.match(fn, /return fetch\(req\)/);
  assert.doesNotMatch(fn, /caches/);
  assert.match(sw, /if \(choice === "network-only"\) \{\s*\/\/ Cross-origin calls are the bot API and sign-in\.[\s\S]*?if \(new URL\(req\.url\)\.origin !== self\.location\.origin\) return;\s*event\.respondWith\(fromNetwork\(req\)\);/);
  assert.match(sw, /cache\.match\("\/offline\.html"\)/);
  assert.match(sw, /data\.type === "skip-waiting"/);
  assert.equal(sw.split("skipWaiting").length - 1, 1);
});

test("iOS hint is once and dismissible; an update offers a reload", () => {
  assert.match(pwa, /tipdash_a2hs_dismissed/);
  assert.match(pwa, /Add TipBot to your Home Screen/);
  assert.match(pwa, /button\("pwa-ios-dismiss"/);
  assert.match(pwa, /A new version of tipdash is ready\./);
  assert.match(pwa, /button\("pwa-update-go"/);
  assert.match(pwa, /reg\.waiting && navigator\.serviceWorker\.controller/);
  assert.match(pwa, /worker\.state === "installed" && navigator\.serviceWorker\.controller/);
  assert.match(pwa, /type: "skip-waiting"/);
  assert.match(pwa, /tg-locked/);
  assert.doesNotMatch(pwa, /nav-ops|dd-owner-settings|STATE\.ops/);
});

test("offline fallback page is a real screen", () => {
  assert.match(offline, /id="offline-title">You're offline</);
  assert.match(offline, /id="offline-retry"/);
  assert.match(offline, /href="\/"/);
  assert.match(offline, /name="viewport"/);
  assert.match(offline, /alt="TipBot"/);
});

test("shipped PWA files pass the public scanner", async () => {
  const { scanText } = await import("../scripts/build-public.mjs");
  for (const rel of ["sw.js", "offline.html", "assets/pwa.js", "assets/pwa.css", "assets/pwa-cache.js", "manifest.webmanifest"]) {
    assert.deepEqual(scanText(rel, read(rel)), [], rel);
  }
});
