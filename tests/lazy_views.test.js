// node --test tests/   Job 03: the Followers view, all-communities rollup, promo chip and My Tips
// (assets/follower-views.js) and Discover (assets/discover.js) are lazy files, like builder.js.
// index.html keeps one placeholder per entry point; the first open paints a skeleton, loads
// the file once, then the real function runs. The fake DOM below is copied from split.test.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const HTML = read("index.html");
const VERSION = "__TD_VERSION__"; // TD.version is a placeholder in source (filled in at publish)
const FILES = {"follower-views": read("assets/follower-views.js"), discover: read("assets/discover.js")};
const ENTRY = {
  "follower-views": [["openFollowerView", "follower"], ["openFollowerAllView", "follower"], ["openMyTips", "mytips"]],
  discover: [["openDiscover", "discover"]],
};
const ENTRY_NAMES = Object.values(ENTRY).flat().map((e) => e[0]);

function topNames(src) {
  const out = [];
  for (const m of src.matchAll(/^ {2}(?:async\s+)?(?:function\s+([\w$]+)|(?:const|let|var)\s+([\w$]+))/gm)) out.push(m[1] || m[2]);
  return out;
}
function inlineScripts(html) { return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]); }
const MAIN = inlineScripts(HTML).find((s) => s.startsWith("\n  const API="));
const ident = (n) => new RegExp("(?<![\\w$.])" + n.replace(/\$/g, "\\$") + "(?![\\w$])");

test("each stub loads the right file and paints the right panel", () => {
  for (const [file, entries] of Object.entries(ENTRY)) {
    for (const [fn, pane] of entries) {
      assert.match(MAIN, new RegExp("function " + fn + "\\(\\)\\{ return lazyView\\(\"" + file + "\", \"" + fn + "\", \"" + pane + "\", this, arguments\\); \\}"), fn);
    }
    assert.doesNotMatch(HTML, new RegExp("<script[^>]+" + file + "\\.js"), "first load must not fetch " + file + ".js");
  }
  // lazyView goes through TD.call, so the file comes from TD.src (./assets/<name>.js?v=VERSION).
  assert.match(MAIN, /return TD\.call\(name, fn, self, args\)/);
});

test("each moved file compiles, declares its entry points and marks itself loaded last", () => {
  for (const [file, src] of Object.entries(FILES)) {
    assert.doesNotThrow(() => new vm.Script(src, {filename: file + ".js"}), file);
    assert.doesNotMatch(src, /^\s*["']use strict["']/, file + " must stay sloppy like index.html");
    assert.match(src, new RegExp("TD\\.loaded\\[\"" + file + "\"\\]=true;\\s*$"), file + " marks itself loaded last");
    const names = topNames(src);
    for (const [fn] of ENTRY[file]) assert.ok(names.includes(fn), file + ".js declares " + fn);
    assert.doesNotMatch(src, /console\.|window\.open|target="_blank"/, file + ": public-repo rules");
  }
});

test("nothing outside the lazy files calls a moved helper that has no stub", () => {
  const main = new Set(topNames(MAIN));
  const others = fs.readdirSync(path.join(ROOT, "assets")).filter((f) => f.endsWith(".js") && !["follower-views.js", "discover.js"].includes(f))
    .map((f) => [f, read("assets/" + f)]);
  for (const [file, src] of Object.entries(FILES)) {
    const helpers = topNames(src).filter((n) => !ENTRY_NAMES.includes(n));
    const clash = helpers.filter((n) => main.has(n));
    assert.deepEqual(clash, [], file + ".js redeclares index.html names");
    for (const h of helpers) {
      assert.doesNotMatch(MAIN, ident(h), "index.html still uses moved helper " + h);
      for (const [of, osrc] of others) assert.doesNotMatch(osrc, ident(h), "assets/" + of + " uses moved helper " + h);
    }
  }
  // Discover's helpers aren't used by the follower views and vice versa (apart from entry points).
  const fv = new Set(topNames(FILES["follower-views"]));
  assert.deepEqual(topNames(FILES.discover).filter((n) => fv.has(n)), [], "the two lazy files overlap");
  // Helpers other screens need stay in index.html.
  for (const kept of ["unmountFollowerPromoChip", "tipTimeMs", "lazyView", "openFollowers", "renderFollowers", "openFollowerGame",
    "openFollowerDemo", "followerFeedRow", "renderCalendar"]) assert.ok(main.has(kept), kept + " stays in index.html");
  for (const moved of ["renderFollowerView", "renderFollowerAllView", "mountFollowerPromoChip", "dcMiniSpark", "pickFeaturedTipster"])
    assert.ok(!main.has(moved), moved + " moved out");
});

test("both files are warmed at idle after load, with a setTimeout fallback for Safari", () => {
  assert.match(MAIN, /const idle=window\.requestIdleCallback\|\|function\(f\)\{return setTimeout\(f,2500\);\};\s*window\.addEventListener\("load",function\(\)\{ idle\(function\(\)\{ TD\.load\("follower-views"\)\.catch\(function\(\)\{\}\); TD\.load\("discover"\)\.catch\(function\(\)\{\}\); \}\); \}\);/);
});

test("the lazy files are in the public build", async () => {
  const { ALLOW, ASSET_DENY } = await import("../scripts/build-public.mjs");
  assert.ok(ALLOW.includes("assets"));
  assert.ok(!ASSET_DENY.has("assets/follower-views.js") && !ASSET_DENY.has("assets/discover.js"));
});

// ── smoke: the real page scripts + lazy files in a fake DOM with a mocked API ──
function fakeDom() {
  const els = new Map();
  const mk = (id) => {
    const style = new Proxy({setProperty() {}, removeProperty() {}}, {get: (t, k) => (k in t ? t[k] : ""), set: () => true});
    const target = {
      id, innerHTML: "", textContent: "", value: "", hidden: false, checked: false, disabled: false, dataset: {}, style,
      children: [], childNodes: [], parentNode: null, offsetHeight: 0, offsetWidth: 0, scrollHeight: 0, clientWidth: 0,
      classList: {add() {}, remove() {}, toggle() {}, contains: () => false},
      appendChild(c) { return c; }, insertBefore(c) { return c; }, removeChild() {}, remove() {}, prepend() {}, append() {},
      addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, removeAttribute() {},
      hasAttribute: () => false, focus() {}, blur() {}, click() { if (typeof this.onclick === "function") return this.onclick({preventDefault() {}}); },
      querySelector: () => mk(), querySelectorAll: () => [], closest: () => null, contains: () => false,
      getBoundingClientRect: () => ({top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0}),
      scrollIntoView() {}, animate() { return {finished: Promise.resolve(), cancel() {}}; }, insertAdjacentHTML() {},
      matches: () => false, cloneNode() { return mk(); },
    };
    return target;
  };
  const byId = (id) => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); };
  const documentElement = mk("html");
  const document = {
    documentElement, body: mk("body"), head: mk("head"), hidden: false, visibilityState: "visible", cookie: "",
    getElementById: byId, querySelector: () => mk(), querySelectorAll: () => [], createElement: (t) => mk(t),
    createTextNode: () => mk(), addEventListener() {}, removeEventListener() {}, createDocumentFragment: () => mk(),
    activeElement: null,
  };
  return {document, els, byId};
}

function mockResponse(body, status = 200) {
  return {ok: status < 400, status, headers: {get: () => "application/json"}, json: async () => JSON.parse(JSON.stringify(body)),
    text: async () => JSON.stringify(body), clone() { return mockResponse(body, status); }};
}

function textResponse(text, status = 200) {
  return {ok: status < 400, status, headers: {get: () => "text/javascript"}, text: async () => text,
    json: async () => { try { return JSON.parse(text); } catch (e) { return {}; } }, clone() { return textResponse(text, status); }};
}

// The program-owner panel is fetched as text and run from a blob-URL <script>
// (index.html ensureExt()), not a <script src="assets/…">. These stubs let
// that path run inside a fake DOM without a real Blob/URL implementation.
const extBlobs = new Map();
let extBlobSeq = 0;
class FakeBlob { constructor(parts) { this._text = Array.isArray(parts) ? parts.join("") : String(parts || ""); } }
class FakeURL extends URL {}
FakeURL.createObjectURL = (blob) => { const id = "blob:node-" + (extBlobSeq++); extBlobs.set(id, (blob && blob._text) || ""); return id; };
FakeURL.revokeObjectURL = (id) => { extBlobs.delete(id); };

function appContext(apiBodies) {
  const {document, els, byId} = fakeDom();
  const store = new Map([["tipbot_auth_epoch", "2"], ["tipbot_token", "t." + Buffer.from('{"exp":4102444800}').toString("base64") + ".x"]]);
  const localStorage = {getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k), key: () => null, length: 0};
  const fetched = [];
  const ctx = {
    document, localStorage, sessionStorage: localStorage, console: {log() {}, info() {}, warn() {}, error() {}, debug() {}},
    location: {href: "http://x/", search: "", hash: "", pathname: "/", origin: "http://x", protocol: "http:", host: "x", reload() {}},
    history: {replaceState() {}, pushState() {}}, navigator: {userAgent: "node", clipboard: {writeText: async () => {}}, onLine: true},
    matchMedia: () => ({matches: false, addEventListener() {}, addListener() {}}), requestAnimationFrame: (f) => setTimeout(f, 0),
    cancelAnimationFrame() {}, getComputedStyle: () => ({getPropertyValue: () => ""}), scrollTo() {}, addEventListener() {},
    removeEventListener() {},
    // Polls use setTimeout for tens of seconds. Keep the short ones (script onload,
    // this test's own waits) and drop the rest so a server page doesn't hold the run open.
    setTimeout: (fn, ms, ...args) => (ms > 500 ? 0 : setTimeout(fn, ms, ...args)),
    clearTimeout, setInterval: () => 0, clearInterval() {}, queueMicrotask,
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
    ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    URLSearchParams, URL: FakeURL, AbortController, Intl, Date, Math, JSON, Promise, Blob: FakeBlob, FormData: class {},
    btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary"),
    Image: class {}, CustomEvent: class {}, Event: class {}, performance: {now: () => Date.now(), getEntriesByType: () => []},
    confirm: () => true, alert() {}, prompt: () => null, crypto: {randomUUID: () => "uuid-" + Math.random()},
    fetched, els, byId,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  ctx.fetch = async (url, opts) => {
    const u = String(url);
    fetched.push(u);
    if (/\/api\/ops\/ext\.js/.test(u)) {
      ctx._lastExtFetchOpts = opts;
      return ctx._extSrc ? textResponse(ctx._extSrc) : mockResponse({error: "not_found"}, 404);
    }
    const api = u.replace("https://afl-tipster-bot.onrender.com", "");
    for (const [prefix, body] of apiBodies) if (api.startsWith(prefix) || u.includes(prefix)) return mockResponse(body);
    return mockResponse({ok: true});
  };
  // <script src="./assets/x.js?v=…"> and the program-owner panel's blob-URL
  // <script>: run the matching source into this context, like a browser would.
  document.head.appendChild = (s) => {
    const src = String(s.src || "");
    fetched.push(src);
    if (src.startsWith("blob:")) {
      setTimeout(() => { try { vm.runInContext(extBlobs.get(src) || "", ctx, {filename: "ext-blob.js"}); s.onload && s.onload(); } catch (e) { ctx.loadError = e; s.onerror && s.onerror(); } }, 1);
      return s;
    }
    const m = src.match(/assets\/([\w-]+)\.js/);
    setTimeout(() => { try { vm.runInContext(read("assets/" + m[1] + ".js"), ctx, {filename: m[1] + ".js"}); s.onload && s.onload(); } catch (e) { ctx.loadError = e; s.onerror && s.onerror(); } }, 1);
    return s;
  };
  vm.createContext(ctx);
  for (const src of [...HTML.matchAll(/<script src="\.\/(assets\/[\w-]+\.js)(?:\?[^"]*)?"><\/script>/g)].map((m) => m[1])) {
    vm.runInContext(read(src), ctx, {filename: src});
  }
  inlineScripts(HTML).forEach((s, i) => vm.runInContext(s, ctx, {filename: "index.html#script" + (i + 1)}));
  return ctx;
}
const GID = "100000000000000001";
const FOLLOW = {guild_id: GID, display_name: "Test Tipster", enabled: 1, subscription_active: 1};
const BODIES = [
  ["/api/servers", {role: "follower", servers: [], follower_servers: [FOLLOW, {...FOLLOW, guild_id: "42", display_name: "Demo Server"}]}],
  ["/api/follower?", {display_name: "Test Tipster", stats: {won: 3, lost: 1, push: 0, pending: 1, profit_units: 2.5, roi: 12, strike_rate: 75, staked_units: 4},
    feed: [], months: [], month: "", cal_month: "2026-10", daily_series: {}}],
  ["/api/my-tips", {ok: true, tips: [], month: "", months: []}],
  ["/api/discover", {ok: true, tipsters: [{guild_id: "7", display_name: "Footy Edge", settled: 40, wins: 24, losses: 16, units_net: 18.4, strike: 60, recent_nets: [1, -1, 2]}]}],
];
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const lazyFetches = (ctx) => ctx.fetched.filter((u) => /assets\/(follower-views|discover)\.js/.test(u));

test("smoke (mocked API): views open from a cold load, each file is fetched once", async () => {
  const ctx = appContext(BODIES);
  await tick(80);
  assert.deepEqual(lazyFetches(ctx), [], "first load fetches neither lazy file");

  const p = vm.runInContext(`openFollowerView("${GID}","Test Tipster")`, ctx);
  assert.equal(ctx.byId("follower").hidden, false, "panel shows straight away");
  assert.match(ctx.byId("follower").innerHTML, /class="nd-sk/, "skeleton paints before the file arrives");
  await p; await tick(60);
  assert.deepEqual(lazyFetches(ctx), ["./assets/follower-views.js?v=" + VERSION]);
  assert.match(ctx.byId("follower").innerHTML, /Your tips/);
  assert.match(ctx.byId("follower").innerHTML, /Test Tipster/);

  await vm.runInContext(`openMyTips("${GID}","Test Tipster")`, ctx);
  await tick(60);
  assert.equal(ctx.byId("mytips").hidden, false);
  assert.match(ctx.byId("mytips").innerHTML, /My Tips/);

  await vm.runInContext(`openFollowerAllView()`, ctx);
  await tick(60);
  assert.match(ctx.byId("follower").innerHTML, /All communities/);
  assert.deepEqual(lazyFetches(ctx), ["./assets/follower-views.js?v=" + VERSION], "follower-views.js fetched once for all three");

  await vm.runInContext(`openDiscover("${GID}","Test Tipster")`, ctx);
  await tick(60);
  assert.equal(ctx.byId("discover").hidden, false);
  assert.match(ctx.byId("discover").innerHTML, /Discover tipsters/);
  assert.deepEqual(lazyFetches(ctx), ["./assets/follower-views.js?v=" + VERSION, "./assets/discover.js?v=" + VERSION]);
  assert.equal(ctx.loadError, undefined);
});

test("a failed load shows the try-again toast and a retry in the panel, never a blank screen", async () => {
  const ctx = appContext(BODIES);
  await tick(80);
  const toasts = [];
  ctx.toast = (m) => toasts.push(m);   // index.html's toast is a global, so this replaces it
  const realAppend = ctx.document.head.appendChild;
  ctx.document.head.appendChild = (s) => {
    if (/discover\.js/.test(String(s.src))) { ctx.fetched.push(String(s.src)); setTimeout(() => s.onerror(), 1); return s; }
    return realAppend(s);
  };
  await vm.runInContext(`openDiscover("${GID}","Test Tipster")`, ctx);
  await tick(20);
  assert.equal(toasts.length, 1);
  assert.match(toasts[0], /Couldn't load the Discover page\. Check your connection and try again\./);
  assert.match(ctx.byId("discover").innerHTML, /Couldn't load this screen/);
  assert.match(ctx.byId("discover").innerHTML, /id="lz-retry"/);
  // Retry once the network is back.
  ctx.document.head.appendChild = realAppend;
  await ctx.byId("lz-retry").onclick();
  await tick(60);
  assert.match(ctx.byId("discover").innerHTML, /Discover tipsters/);
  assert.equal(lazyFetches(ctx).length, 2, "the retry fetches again");
});
