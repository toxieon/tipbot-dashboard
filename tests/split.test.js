// node --test tests/   2.2b (0.40.2): the tip builder and Admin Tools' Paste sheet are lazy files.
// assets/builder.js and assets/admin.js are plain scripts that share index.html's global scope;
// index.html keeps a small TD loader and a placeholder for each entry point.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const HTML = read("index.html");
const VERSION = read("VERSION").trim();
const FILES = {builder: read("assets/builder.js"), admin: read("assets/admin.js")};
const ENTRY = {builder: ["openBuilder", "openCustom"], admin: ["pasteSheetPreview", "pasteSheetConfirm"]};

// Top-level declarations: every file here indents its top level by two spaces.
function topNames(src) {
  const out = [];
  for (const m of src.matchAll(/^ {2}(?:async\s+)?(?:function\s+([\w$]+)|(?:const|let|var)\s+([\w$]+))/gm)) out.push(m[1] || m[2]);
  return out;
}
function inlineScripts(html) { return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]); }
const MAIN = inlineScripts(HTML).find((s) => s.startsWith("\n  const API="));

test("the lazy files compile and aren't referenced by any <script src>", () => {
  for (const [name, src] of Object.entries(FILES)) {
    assert.doesNotThrow(() => new vm.Script(src, {filename: name + ".js"}), name);
    assert.doesNotMatch(src, /^\s*["']use strict["']/, name + " must stay sloppy like index.html");
    assert.match(src, new RegExp("TD\\.loaded\\." + name + "=true;\\s*$"), name + " marks itself loaded last");
    assert.doesNotMatch(HTML, new RegExp("<script[^>]+" + name + "\\.js"), "first load must not fetch " + name + ".js");
  }
});

test("TD.version matches VERSION (it cache-busts the lazy files)", () => {
  const m = MAIN.match(/TD\.version="([^"]+)";/);
  assert.ok(m, "TD.version missing");
  assert.equal(m[1], VERSION);
  assert.match(MAIN, /TD\.src=function\(name\)\{ return "\.\/assets\/"\+name\+"\.js\?v="\+encodeURIComponent\(TD\.version\); \};/);
});

test("each entry point is a placeholder in index.html and real in its lazy file; nothing else is shared", () => {
  const main = new Set(topNames(MAIN));
  for (const [name, src] of Object.entries(FILES)) {
    const names = topNames(src);
    for (const fn of ENTRY[name]) {
      assert.ok(names.includes(fn), name + ".js declares " + fn);
      assert.match(MAIN, new RegExp("function " + fn + "\\(\\)\\{ return TD\\.call\\(\"" + name + "\", \"" + fn + "\", this, arguments\\); \\}"));
    }
    const clash = names.filter((n) => main.has(n) && !ENTRY[name].includes(n));
    assert.deepEqual(clash, [], name + ".js redeclares index.html names");
  }
  const b = new Set(topNames(FILES.builder));
  assert.deepEqual(topNames(FILES.admin).filter((n) => b.has(n)), [], "builder.js and admin.js overlap");
  // What index.html keeps from the old builder block (Results + the always-on batch tray).
  for (const kept of ["renderBatchTray", "syncTrayStack", "clearBatch", "teamName", "aflLogoHtml", "fmtGameWhen",
    "applyComparePick", "compareHref", "renderResults"]) assert.ok(main.has(kept), kept + " stays in index.html");
  for (const moved of ["renderGames", "renderGame", "renderPlayers", "renderConfirm", "doSchedule", "doBatchSchedule",
    "renderEspnNflProps", "parseTipSheet", "renderPastePreview"]) assert.ok(!main.has(moved), moved + " moved out");
});

// The loader itself, run for real: a fake <script> element runs the file into the same context.
function loaderContext(files, {fail} = {}) {
  const ctx = {console: {error() {}}, toasts: [], appended: []};
  ctx.window = ctx;
  ctx.toast = (m) => ctx.toasts.push(m);
  ctx.document = {
    createElement: () => ({remove() {}}),
    head: {appendChild(s) {
      ctx.appended.push(s.src);
      setTimeout(() => {
        const name = s.src.match(/assets\/(\w+)\.js/)[1];
        if (fail) return s.onerror();
        vm.runInContext(files[name], ctx, {filename: name + ".js"});
        s.onload();
      }, 1);
    }},
  };
  vm.createContext(ctx);
  const start = MAIN.indexOf("  const TD=(window.TD=window.TD||{});");
  const end = MAIN.indexOf("  // Per-guild unit size", start);
  assert.ok(start > 0 && end > start, "found the TD loader");
  vm.runInContext(MAIN.slice(start, end) + ENTRY.builder.concat(ENTRY.admin).map((fn) =>
    "function " + fn + "(){ return TD.call(\"" + (ENTRY.builder.includes(fn) ? "builder" : "admin") + "\", \"" + fn + "\", this, arguments); }").join("\n"), ctx);
  return ctx;
}

test("a placeholder loads its file once, then the real function replaces it and gets the arguments", async () => {
  const files = {builder: "  var calls=[];\n  function openBuilder(){ calls.push([].slice.call(arguments)); return 'real'; }\n  function openCustom(){}\n  TD.loaded.builder=true;\n"};
  const ctx = loaderContext(files);
  const stub = ctx.openBuilder;
  const [a, b] = await Promise.all([ctx.openBuilder("42", "Tip2"), ctx.openBuilder("43", "X")]);
  assert.deepEqual([a, b], ["real", "real"]);
  assert.equal(ctx.appended.length, 1, "double click = one fetch");
  assert.equal(ctx.appended[0], "./assets/builder.js?v=" + VERSION);
  assert.notEqual(ctx.openBuilder, stub);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.calls)), [["42", "Tip2"], ["43", "X"]]);
  await ctx.openCustom();
  assert.equal(ctx.appended.length, 1, "loaded files aren't fetched again");
});

test("a failed load shows a toast, can be retried, and never loops", async () => {
  const ctx = loaderContext({}, {fail: true});
  await ctx.pasteSheetPreview("42");
  assert.equal(ctx.toasts.length, 1);
  assert.match(ctx.toasts[0], /Couldn't load the admin tools/);
  await ctx.pasteSheetPreview("42");
  assert.equal(ctx.appended.length, 2, "a retry fetches again");
  const broken = loaderContext({builder: "  TD.loaded.builder=true;\n"});   // file lacks the function
  await broken.openBuilder("1");
  assert.match(broken.toasts[0], /Couldn't load the tip builder/);
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
    removeEventListener() {}, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, queueMicrotask,
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
    ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    URLSearchParams, URL, AbortController, Intl, Date, Math, JSON, Promise, Blob: class {}, FormData: class {},
    btoa: (s) => Buffer.from(s, "binary").toString("base64"), atob: (s) => Buffer.from(s, "base64").toString("binary"),
    Image: class {}, CustomEvent: class {}, Event: class {}, performance: {now: () => Date.now(), getEntriesByType: () => []},
    confirm: () => true, alert() {}, prompt: () => null, crypto: {randomUUID: () => "uuid-" + Math.random()},
    fetched, els, byId,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  ctx.fetch = async (url) => {
    const u = String(url);
    fetched.push(u);
    const api = u.replace("https://afl-tipster-bot.onrender.com", "");
    for (const [prefix, body] of apiBodies) if (api.startsWith(prefix) || u.includes(prefix)) return mockResponse(body);
    return mockResponse({ok: true});
  };
  // <script src="./assets/x.js?v=…">: run the file into this context, like a browser would.
  document.head.appendChild = (s) => {
    const m = String(s.src || "").match(/assets\/([\w-]+)\.js/);
    fetched.push(String(s.src));
    setTimeout(() => { try { vm.runInContext(read("assets/" + m[1] + ".js"), ctx, {filename: m[1] + ".js"}); s.onload && s.onload(); } catch (e) { ctx.loadError = e; s.onerror && s.onerror(); } }, 1);
    return s;
  };
  vm.createContext(ctx);
  for (const src of [...HTML.matchAll(/<script src="\.\/(assets\/[\w-]+\.js)"><\/script>/g)].map((m) => m[1])) {
    vm.runInContext(read(src), ctx, {filename: src});
  }
  inlineScripts(HTML).forEach((s, i) => vm.runInContext(s, ctx, {filename: "index.html#script" + (i + 1)}));
  return ctx;
}

const GID = "1547413800012226692";
const SERVER = {guild_id: GID, display_name: "Toxieon-Tipping", enabled: 1, subscription_active: 1, unit_size: 20};
const BODIES = [
  ["/api/servers", {role: "owner", servers: [SERVER, {...SERVER, guild_id: "42", display_name: "Tip2"}], follower_servers: []}],
  ["/api/server?", {settings: SERVER, stats: {won: 1, lost: 1, push: 0, queued: 0, strike_rate: 50, profit_units: 0.5, roi: 5},
    tips: {settled: [], pending: [], queued: []}, months: [], month: ""}],
  ["/api/fixtures", {games: [], players: {}}],
  ["/api/espn/players", {ok: true, league: "nba", teams: [{id: "25", name: "Oklahoma City Thunder", players: [
    {player_id: "4278073", name: "Shai Gilgeous-Alexander", position: "G", number: "2"}]}], players: [], prop_markets: []}],
  ["site.api.espn.com", {leagues: [{calendar: ["2025-06-13T07:00Z"]}], day: {date: "2025-06-13"}, events: [{id: "401766125",
    name: "Oklahoma City Thunder at Indiana Pacers", date: "2025-06-14T00:30Z", status: {type: {state: "post"}},
    competitions: [{competitors: [{homeAway: "home", team: {id: "11", displayName: "Indiana Pacers"}},
      {homeAway: "away", team: {id: "25", displayName: "Oklahoma City Thunder"}}]}]}]}],
  ["/api/owner/import-tips", {ok: true, dry_run: true, tips: [], errors: [], summary: {tips: 0}}],
];
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const lazyFetches = (ctx) => ctx.fetched.filter((u) => /assets\/(builder|admin)\.js/.test(u));

test("smoke (mocked API): home and a server open without the lazy files; each panel then opens", async () => {
  const ctx = appContext(BODIES);
  await tick(80);
  assert.equal(ctx.byId("app").hidden, false, "home painted");
  vm.runInContext(`loadDetail("${GID}")`, ctx);
  await tick(80);
  assert.match(ctx.byId("detail").innerHTML, /Build a tip/);
  assert.deepEqual(lazyFetches(ctx), [], "first load + server page fetch no lazy file");

  await vm.runInContext(`openBuilder("${GID}","Toxieon-Tipping")`, ctx);
  await tick(40);
  assert.deepEqual(lazyFetches(ctx), ["./assets/builder.js?v=" + VERSION]);
  assert.equal(ctx.byId("builder").hidden, false);
  assert.match(ctx.byId("builder").innerHTML, /Build a tip/);

  await vm.runInContext(`openCustom("${GID}","Toxieon-Tipping")`, ctx);
  assert.match(ctx.byId("builder").innerHTML, /Custom tip/);

  await vm.runInContext(`openEspnBuilder("${GID}","Toxieon-Tipping","nba")`, ctx);
  await tick(40);
  assert.match(ctx.byId("builder").innerHTML, /Oklahoma City Thunder/);
  await vm.runInContext(`openEspnEvent(BUILD.espnEvents[0])`, ctx);
  await tick(40);
  assert.match(ctx.byId("builder").innerHTML, /Points \+ Rebounds \+ Assists/);
  assert.match(ctx.byId("players").innerHTML, /Shai Gilgeous-Alexander/);

  ctx.byId("paste-sheet-ta").value = "kind\tgame\tplayer\tstat\tline\tside\todds\tunits\nSINGLE\tCarlton v Hawthorn\tSam Walsh\tDisposals\t24.5\tOver\t1.9\t1";
  await vm.runInContext(`pasteSheetPreview("${GID}")`, ctx);
  await tick(40);
  assert.deepEqual(lazyFetches(ctx), ["./assets/builder.js?v=" + VERSION, "./assets/admin.js?v=" + VERSION]);
  assert.match(ctx.byId("paste-sheet-msg").textContent + ctx.byId("paste-summary").textContent, /1 tip/);
  assert.equal(ctx.loadError, undefined);
});
