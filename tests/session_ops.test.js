// A busy /api/servers on first load must not skip the session check.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const HTML = read("index.html");

// Stand-in for the owner script TipBot serves at GET /api/ops/ext.js.
// Enough for the gear menu to mount the global flags section.
const EXT_SRC = `
window.TBOwner = { clearOps: function(){}, paintOps: function(){}, mountChrome: function(){} };
if (window.TBGlobalFlags) {
  window.TBGlobalFlags.mountSettings = function(box) {
    box.innerHTML = '<div id="os-global">Global flags</div>';
    return { destroy: function(){ box.innerHTML = ""; } };
  };
}
`;

function inlineScripts(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function fakeDom() {
  const els = new Map();
  const mk = (id) => {
    const bag = {};
    if (id === "dd-viewas") bag.display = "none";
    const style = new Proxy(bag, {
      get(t, k) {
        if (k === "setProperty") return (prop, value) => { t[prop] = String(value); };
        if (k === "removeProperty") return (prop) => { delete t[prop]; };
        return k in t ? t[k] : "";
      },
      set(t, k, v) { t[k] = String(v); return true; },
    });
    const el = {
      id, textContent: id === "dd-viewas" ? "View as…" : "", value: "", hidden: id === "dd-global",
      checked: false, disabled: false, dataset: {}, style,
      children: [], childNodes: [], parentNode: null, offsetHeight: 0, offsetWidth: 0, scrollHeight: 0, clientWidth: 0,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      insertBefore(c) { return this.appendChild(c); }, removeChild() {}, remove() {}, prepend() {}, append() {},
      addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, removeAttribute() {},
      hasAttribute: () => false, focus() {}, blur() {}, click() {},
      querySelector: () => mk(), querySelectorAll: () => [], closest: () => null, contains: () => false,
      getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 }),
      scrollIntoView() {}, animate() { return { finished: Promise.resolve(), cancel() {} }; }, insertAdjacentHTML() {},
      matches: () => false, cloneNode() { return mk(); },
    };
    el.appendChild = (c) => { el.children.push(c); if (c) c.parentNode = el; return c; };
    let html = "";
    Object.defineProperty(el, "innerHTML", {
      configurable: true,
      get() { return html; },
      set(v) { html = String(v == null ? "" : v); if (html === "") el.children.length = 0; },
    });
    return el;
  };
  const byId = (id) => { if (!els.has(id)) els.set(id, mk(id)); return els.get(id); };
  const document = {
    documentElement: mk("html"), body: mk("body"), head: mk("head"), hidden: false, visibilityState: "visible", cookie: "",
    getElementById: byId, querySelector: () => mk(), querySelectorAll: () => [], createElement: (t) => mk(t),
    createTextNode: () => mk(), addEventListener() {}, removeEventListener() {}, createDocumentFragment: () => mk(),
    activeElement: null,
  };
  return { document, byId };
}

function mockResponse(body, status = 200) {
  const payload = JSON.parse(JSON.stringify(body));
  return {
    ok: status < 400, status, headers: { get: () => null },
    json: async () => JSON.parse(JSON.stringify(payload)),
    text: async () => JSON.stringify(payload),
    clone() { return mockResponse(payload, status); },
  };
}

function textResponse(text, status = 200) {
  return {
    ok: status < 400, status, headers: { get: () => null },
    text: async () => text,
    json: async () => { throw new Error("not json"); },
    clone() { return textResponse(text, status); },
  };
}

const extBlobs = new Map();
let extBlobSeq = 0;
class FakeBlob { constructor(parts) { this._text = Array.isArray(parts) ? parts.join("") : String(parts || ""); } }
class FakeURL extends URL {}
FakeURL.createObjectURL = (blob) => {
  const id = "blob:node-" + (extBlobSeq++);
  extBlobs.set(id, (blob && blob._text) || "");
  return id;
};
FakeURL.revokeObjectURL = (id) => { extBlobs.delete(id); };

function bootPage(fetchImpl, seed) {
  const { document, byId } = fakeDom();
  const store = new Map([
    ["tipbot_auth_epoch", "2"],
    ["tipbot_token", "t." + Buffer.from('{"exp":4102444800}').toString("base64") + ".x"],
  ]);
  if (seed) for (const [k, v] of Object.entries(seed)) store.set(k, v);
  const ctx = {
    document,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    location: { href: "http://x/", search: "", hash: "", pathname: "/", origin: "http://x", protocol: "http:", host: "x", reload() {} },
    history: { replaceState() {}, pushState() {}, back() {} },
    navigator: { userAgent: "node", clipboard: { writeText: async () => {} }, onLine: true },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: (f) => setTimeout(f, 0),
    cancelAnimationFrame() {}, getComputedStyle: () => ({ getPropertyValue: () => "" }), scrollTo() {},
    addEventListener() {}, removeEventListener() {},
    // The 60s hard timer must not stay open. Retry waits still run, immediately.
    setTimeout: (fn, ms, ...args) => {
      const delay = Number(ms) || 0;
      if (delay >= 10000) return 0;
      return setTimeout(fn, delay > 15 ? 0 : delay, ...args);
    },
    clearTimeout, setInterval: () => 0, clearInterval() {}, queueMicrotask,
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
    ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    URLSearchParams, URL: FakeURL, AbortController, Intl, Date, Math, JSON, Promise, Blob: FakeBlob, FormData: class {},
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    Image: class {}, CustomEvent: class {}, Event: class {},
    performance: { now: () => Date.now(), getEntriesByType: () => [] },
    confirm: () => true, alert() {}, prompt: () => null,
    crypto: { randomUUID: () => "uuid-1" },
    fetch: fetchImpl,
    byId, store,
  };
  ctx.sessionStorage = ctx.localStorage;
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  document.head.appendChild = (s) => {
    const src = String(s.src || "");
    if (src.startsWith("blob:")) {
      setTimeout(() => {
        try { vm.runInContext(extBlobs.get(src) || "", ctx, { filename: "ext-blob.js" }); s.onload && s.onload(); }
        catch (e) { ctx.loadError = e; s.onerror && s.onerror(); }
      }, 1);
      return s;
    }
    const m = src.match(/assets\/([\w-]+)\.js/);
    if (!m) { setTimeout(() => s.onload && s.onload(), 1); return s; }
    setTimeout(() => {
      try { vm.runInContext(read("assets/" + m[1] + ".js"), ctx, { filename: m[1] + ".js" }); s.onload && s.onload(); }
      catch (e) { ctx.loadError = e; s.onerror && s.onerror(); }
    }, 1);
    return s;
  };
  vm.createContext(ctx);
  for (const src of [...HTML.matchAll(/<script src="\.\/(assets\/[\w-]+\.js)(?:\?[^"]*)?"><\/script>/g)].map((m) => m[1])) {
    vm.runInContext(read(src), ctx, { filename: src });
  }
  inlineScripts(HTML).forEach((s, i) => vm.runInContext(s, ctx, { filename: "index.html#script" + (i + 1) }));
  return ctx;
}

function savedScreen() {
  return JSON.stringify({
    role: "mod",
    servers: [{ guild_id: "100000000000000001", display_name: "Home", enabled: 1, listed: true, queued: 1, won: 2, lost: 0, profit_units: 1, roi: 4 }],
    follower_servers: [],
    saved_at: Date.now(),
  });
}

function busyFetch(counts) {
  return async (url) => {
    const u = String(url);
    counts.urls.push(u);
    if (u.includes("/api/servers")) {
      counts.servers += 1;
      return mockResponse({ error: "db_busy" }, 503);
    }
    if (u.includes("/api/me")) {
      counts.me += 1;
      return mockResponse({ ops: true });
    }
    if (/\/api\/ops\/ext\.js/.test(u)) return textResponse(EXT_SRC);
    return mockResponse({ ok: true });
  };
}

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

async function until(fn, label) {
  const start = Date.now();
  let last = fn();
  while (!last.ok && Date.now() - start < 2000) {
    await tick(15);
    last = fn();
  }
  assert.equal(last.ok, true, label + " " + JSON.stringify(last));
  return last;
}

function ownerChrome(ctx) {
  const view = ctx.byId("dd-viewas");
  const global = ctx.byId("dd-global");
  return {
    ops: vm.runInContext("STATE.ops", ctx),
    viewShown: view.style.display !== "none",
    viewText: view.textContent,
    globalHidden: global.hidden,
    globalHtml: global.innerHTML,
  };
}

function assertOwnerChrome(ctx, counts) {
  const ui = ownerChrome(ctx);
  assert.ok(counts.me >= 1, "GET /api/me was not called: " + counts.urls.join("\n"));
  assert.equal(counts.servers, 3, "server attempts: " + counts.urls.filter((u) => u.includes("/api/servers")).join("\n"));
  assert.equal(ui.ops, true);
  assert.equal(ui.viewShown, true);
  assert.match(ui.viewText, /View as/);
  assert.equal(ui.globalHidden, false);
  assert.match(ui.globalHtml, /id="os-global"/);
  assert.match(ui.globalHtml, /Global flags/);
  for (const [key, value] of ctx.store) {
    assert.equal(typeof value === "string" && /"ops"\s*:/.test(value), false, key + " stored the session role");
  }
  assert.equal(ctx.loadError, undefined);
}

async function bootBusy(seed) {
  const counts = { me: 0, servers: 0, urls: [] };
  const ctx = bootPage(busyFetch(counts), seed);
  await until(() => {
    const ui = ownerChrome(ctx);
    const ok = counts.me >= 1 && counts.servers >= 3 && ui.ops === true && ui.viewShown && ui.globalHidden === false && /os-global/.test(ui.globalHtml);
    return { ok, me: counts.me, servers: counts.servers, ops: ui.ops, viewShown: ui.viewShown, globalHidden: ui.globalHidden, globalHtml: ui.globalHtml, err: ctx.loadError && String(ctx.loadError) };
  }, "owner chrome after a busy server list");
  return { ctx, counts };
}

test("a saved screen still loads the session when /api/servers is busy", async () => {
  const { ctx, counts } = await bootBusy({ tipdash_boot_v1: savedScreen() });
  assertOwnerChrome(ctx, counts);
  assert.equal(ctx.byId("app").hidden, false, "the saved screen stays up");
  assert.equal(ctx.byId("login").hidden, true);
});

test("no saved screen still loads the session when /api/servers is busy", async () => {
  const { ctx, counts } = await bootBusy();
  assertOwnerChrome(ctx, counts);
  assert.equal(ctx.store.has("tipdash_boot_v1"), false);
});

test("the saved screen does not store the session role", () => {
  const write = HTML.slice(HTML.indexOf("function writeBootCache"), HTML.indexOf("const SERVER_STAT_KEYS"));
  assert.doesNotMatch(write, /\bops\b/);
  const read = HTML.slice(HTML.indexOf("function readBootCache"), HTML.indexOf("function writeBootCache"));
  assert.match(read, /delete j\.ops/);
});
