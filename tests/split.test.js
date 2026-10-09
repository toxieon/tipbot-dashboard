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
const ENTRY = {builder: ["openBuilder", "openCustom", "openRacingBuilder", "openSportsBuilder"], admin: ["pasteSheetPreview", "pasteSheetConfirm", "pasteSheetTemplate"]};

// Stand-in for the program-owner panel TipBot serves at GET /api/ops/ext.js
// (program-owner-only; this repo never ships that file). Just enough of the
// window.TBOwner contract renderDetail() expects, so these tests can exercise
// the fetch -> blob -> <script> wiring without a real session or the bot.
const EXT_FIXTURE = `
window.TBOwner = {
  adminHtml: function(s, sw) {
    return '<div class="panel" id="adminpanel"><div class="switches">' + sw + '</div>'
      + '<button id="godtoggle" aria-label="God mode"></button>'
      + '<textarea id="paste-sheet-ta"></textarea></div>';
  },
  bindAdmin: function(){},
  ensureSettingsMarkup: function(){},
  paintSignup: function(){},
  wireSignup: function(){},
  paintOps: function(){},
  clearOps: function(){},
  closeFollowerMap: function(){},
  openFollowerMap: function(){},
};
`;

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
  ["/api/racing/next", {ok: true, races: [
    {id: "evt-t-open", race_number: 8, name: "Kensington Stakes", start_time: "2099-01-01T03:00:00Z", distance: 1200, track_condition: "Good 4", status: "Open", category: "T", meeting: {name: "Randwick", category: "T"}},
    {id: "evt-h-open", race_number: 3, name: "Pace", start_time: "2099-01-01T02:00:00Z", distance: 1609, track_condition: "Fast", status: "Open", category: "H", meeting: {name: "Menangle", category: "H"}},
    {id: "evt-g", race_number: 1, name: "Greys", start_time: "2099-01-01T01:00:00Z", distance: 380, category: "G", meeting: {name: "Townsville", category: "G"}},
  ]}],
  ["/api/racing/meetings?category=T", {ok: true, category: "T", meetings: [
    {id: "mtg-t", name: "Randwick", category: "T", races: [{id: "evt-t-open", race_number: 8, name: "Kensington Stakes"}]},
  ]}],
  ["/api/racing/meetings?category=H", {ok: true, category: "H", meetings: [
    {id: "mtg-h", name: "Menangle", category: "H", races: [{id: "evt-h-open", race_number: 3, name: "Pace"}]},
  ]}],
  ["/api/racing/meetings", {data: {meetings: [
    {meeting: "mtg-t", id: "mtg-t", name: "Randwick", category: "T", races: [{id: "evt-t-open", race_number: 8, name: "Kensington Stakes"}]},
    {meeting: "mtg-h", id: "mtg-h", name: "Menangle", category: "H", races: [{id: "evt-h-open", race_number: 3, name: "Pace"}]},
    {meeting: "mtg-g", id: "mtg-g", name: "Townsville", category: "G", races: []},
  ]}}],
  ["/api/racing/meeting/mtg-t", {data: {meeting: {meeting: "mtg-t", id: "mtg-t", name: "Randwick", category: "T", races: [
    {id: "evt-t-open", race_number: 8, name: "Kensington Stakes", distance: 1200},
    {id: "evt-t-final", race_number: 4, name: "Handicap", distance: 1400},
  ]}}}],
  ["/api/racing/event/evt-t-open", {ok: true, event: {id: "evt-t-open", race_number: 8, name: "Kensington Stakes", start_time: "2099-01-01T03:00:00Z", distance: 1200, track_condition: "Good 4", status: "Open", category: "T", runners: [
    {id: "r1", number: 1, name: "Absconding", jockey_or_driver: "J. McDonald", barrier: 5, fixed: {win: 2.4, place: 1.25}, scratched: false},
  ]}}],
  ["/api/racing/event/evt-h-open", {ok: true, event: {id: "evt-h-open", race_number: 3, name: "Pace", start_time: "2099-01-01T02:00:00Z", distance: 1609, track_condition: "Fast", status: "Open", category: "H", runners: [
    {id: "h1", number: 1, name: "Captain Crunch", jockey_or_driver: "L. McCarthy", barrier: 1, fixed: {win: 3.1, place: 1.45}, scratched: false},
  ]}}],
  ["/api/racing/event/evt-t-final", {ok: true, event: {id: "evt-t-final", race_number: 4, name: "Handicap", status: "Final", category: "T", runners: [
    {id: "r1", number: 1, name: "Absconding", fixed: {win: 2.4, place: 1.25}},
    {id: "r2", number: 2, name: "Second Best", fixed: {win: 5, place: 1.9}},
  ], results: [{runner_id: "r2", position: 1}, {runner_id: "r1", position: 2}],
    dividends: [{type: "win", runner_id: "r2", amount: 4.8}, {type: "place", runner_id: "r2", amount: 1.7}, {type: "place", runner_id: "r1", amount: 1.3}]}}],
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
  assert.match(ctx.byId("builder").innerHTML, /Ready to build/);
  assert.match(ctx.byId("builder").innerHTML, /Sports/);
  assert.match(ctx.byId("builder").innerHTML, /Racing/);
  assert.match(ctx.byId("builder").innerHTML, /Gallops/);
  assert.match(ctx.byId("builder").innerHTML, /Next to go/);
  await tick(40);
  assert.match(ctx.byId("next-to-go-list").innerHTML, /Randwick/);
  assert.match(ctx.byId("next-to-go-list").innerHTML, /Menangle/);
  assert.doesNotMatch(ctx.byId("next-to-go-list").innerHTML, /Townsville|Greys/);

  await vm.runInContext(`openRacingBuilder("${GID}","Toxieon-Tipping")`, ctx);
  await tick(40);
  assert.match(ctx.byId("builder").innerHTML, /Gallops/);
  assert.match(ctx.byId("builder").innerHTML, /Harness/);
  assert.doesNotMatch(ctx.byId("builder").innerHTML, /Greys/);
  assert.match(ctx.byId("racing-meetings-list").innerHTML, /Randwick/);
  assert.match(ctx.byId("racing-meetings-list").innerHTML, /Menangle/);
  assert.doesNotMatch(ctx.byId("racing-meetings-list").innerHTML, /Townsville/);

  await vm.runInContext(`openRaceEvent("evt-t-open","T","Randwick")`, ctx);
  await tick(40);
  assert.match(ctx.byId("builder").innerHTML, /id="race-app"/);
  assert.doesNotMatch(ctx.byId("builder").innerHTML, /no-hero/);
  assert.match(ctx.byId("builder").innerHTML, /class="hero"/);
  assert.match(ctx.byId("race-card-main").innerHTML, /Opening/);
  assert.match(ctx.byId("race-card-main").innerHTML, />Win</);
  assert.match(ctx.byId("race-card-main").innerHTML, /Absconding/);
  assert.match(ctx.byId("race-card-main").innerHTML, /J: J\. McDonald/);
  assert.match(ctx.byId("race-card-main").innerHTML, />2\.40<\/span><span class="odds">1\.25</);
  assert.doesNotMatch(ctx.byId("builder").innerHTML + ctx.byId("race-card-main").innerHTML, /flucs/i);

  await vm.runInContext(`openRaceEvent("evt-h-open","H","Menangle")`, ctx);
  await tick(40);
  assert.match(ctx.byId("builder").innerHTML, /no-hero/);
  assert.doesNotMatch(ctx.byId("builder").innerHTML, /class="hero"/);
  assert.match(ctx.byId("race-card-main").innerHTML, /Captain Crunch/);
  assert.match(ctx.byId("race-card-main").innerHTML, /D: L\. McCarthy/);

  await vm.runInContext(`openRaceEvent("evt-t-final","T","Randwick")`, ctx);
  await tick(40);
  const fin = ctx.byId("race-card-main").innerHTML;
  assert.match(fin, /Placings/);
  assert.ok(fin.indexOf("Second Best") < fin.indexOf("Absconding"), "placings follow results[].position");
  assert.match(fin, />4\.8</);
  assert.match(fin, />1\.3</);

  await vm.runInContext(`openRaceEvent("evt-g","G","Townsville")`, ctx);
  await tick(20);
  assert.match(ctx.byId("builder").innerHTML, /Greyhounds aren't listed/);

  await vm.runInContext(`openSportsBuilder("${GID}","Toxieon-Tipping")`, ctx);
  await tick(40);
  assert.match(ctx.byId("builder").innerHTML, /Build a tip/);
  assert.match(ctx.byId("builder").innerHTML, /🏉 AFL/);
  assert.match(ctx.byId("builder").innerHTML, /🏈 NFL/);
  assert.match(ctx.byId("builder").innerHTML, /🏀 NBA/);
  assert.match(ctx.byId("builder").innerHTML, /🏀 WNBA/);
  assert.match(ctx.byId("builder").innerHTML, /⚽ Soccer/);
  assert.match(ctx.byId("builder").innerHTML, /🏉 NRL/);
  assert.match(ctx.byId("builder").innerHTML, /➕ Other/);

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

test("a server owner without the platform session does not get platform tools", async () => {
  const ctx = appContext(BODIES);
  await tick(80);
  vm.runInContext(`loadDetail("${GID}")`, ctx);
  await tick(80);
  const html = ctx.byId("detail").innerHTML;
  assert.match(html, /Build a tip/);
  assert.doesNotMatch(html, /adminpanel|godtoggle|paste-sheet-ta|Debug menu/);
  assert.equal(ctx.fetched.some((u) => /ext\.js/.test(u)), false);
});

test("the platform session loads platform tools onto the server page", async () => {
  const bodies = BODIES.map((pair) => pair.slice());
  bodies[0][1] = Object.assign({}, bodies[0][1], {ops: true});
  const ctx = appContext(bodies);
  ctx._extSrc = EXT_FIXTURE; // stand-in for what GET /api/ops/ext.js would return
  await tick(80);
  vm.runInContext(`loadDetail("${GID}")`, ctx);
  await tick(150);
  assert.equal(ctx.loadError, undefined);
  assert.match(ctx.byId("detail").innerHTML, /godtoggle/);
  assert.match(ctx.byId("detail").innerHTML, /paste-sheet-ta/);
  assert.ok(ctx.fetched.some((u) => u.includes("/api/ops/ext.js")));
  assert.ok(ctx.fetched.some((u) => /^blob:/.test(u)), "panel script runs from a blob URL, not a public asset");
  assert.equal(ctx._lastExtFetchOpts && ctx._lastExtFetchOpts.credentials, "include");
  assert.match((ctx._lastExtFetchOpts && ctx._lastExtFetchOpts.headers && ctx._lastExtFetchOpts.headers.Authorization) || "", /^Bearer /);
});

test("a 404 fetching the owner panel fails silently: no console output, no visible error", async () => {
  const bodies = BODIES.map((pair) => pair.slice());
  bodies[0][1] = Object.assign({}, bodies[0][1], {ops: true});
  const ctx = appContext(bodies);
  // ctx._extSrc stays unset: GET /api/ops/ext.js behaves like the 404 everyone
  // but the program owner gets.
  const consoleCalls = [];
  for (const k of ["log", "info", "warn", "error", "debug"]) ctx.console[k] = (...args) => consoleCalls.push([k, ...args]);
  await tick(80);
  vm.runInContext(`loadDetail("${GID}")`, ctx);
  await tick(150);
  assert.equal(ctx.loadError, undefined);
  assert.ok(ctx.fetched.some((u) => u.includes("/api/ops/ext.js")));
  assert.doesNotMatch(ctx.byId("detail").innerHTML, /godtoggle|paste-sheet-ta/);
  assert.deepEqual(consoleCalls, []);
});
