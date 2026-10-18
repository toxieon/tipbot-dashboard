// A renamed server's name and icon replace the cached copy.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const HTML = read("index.html");
const GP = require("../assets/guild-profile.js");

const GID = "1547413800012226692";
const OLD_ICON = "https://cdn.discordapp.com/icons/" + GID + "/old.png";
const LIST_ICON = "https://cdn.discordapp.com/icons/" + GID + "/list.png";
const NEW_ICON = "https://cdn.discordapp.com/icons/" + GID + "/new.png";
const FOCUS_ICON = "https://cdn.discordapp.com/icons/" + GID + "/focus.png";
const HASH_ICON = "https://cdn.discordapp.com/icons/" + encodeURIComponent(GID) + "/srvhash.png";

test("name and icon come from the fresh row, and a missing icon stays put", () => {
  const prev = { guild_id: GID, display_name: "Old Name", icon_url: OLD_ICON, queued: 4 };
  const fresh = { guild_id: GID, display_name: "New Name", icon_url: NEW_ICON };
  assert.equal(GP.applyIdentity(prev, fresh), true);
  assert.equal(prev.display_name, "New Name");
  assert.equal(GP.guildIconUrl(prev), NEW_ICON);

  const kept = { guild_id: GID, display_name: "Old Name", icon_url: OLD_ICON };
  const statsOnly = { guild_id: GID, display_name: "New Name", queued: 1 };
  GP.keepMissingIdentity(statsOnly, kept);
  assert.equal(statsOnly.display_name, "New Name");
  assert.equal(statsOnly.icon_url, OLD_ICON);

  const hashed = { guild_id: GID, display_name: "New Name", icon: "srvhash" };
  assert.equal(GP.guildIconUrl(hashed), HASH_ICON);
  const animated = { guild_id: GID, icon: "a_live" };
  assert.equal(GP.guildIconUrl(animated), "https://cdn.discordapp.com/icons/" + encodeURIComponent(GID) + "/a_live.gif");

  const dst = { guild_id: GID, display_name: "Old Name", icon_url: OLD_ICON, icon: "oldhash" };
  GP.applyIdentity(dst, { display_name: "New Name", icon: "srvhash" });
  assert.equal(dst.display_name, "New Name");
  assert.equal(dst.icon, "srvhash");
  assert.equal(Object.prototype.hasOwnProperty.call(dst, "icon_url"), false);
  assert.equal(GP.guildIconUrl(dst), HASH_ICON);

  assert.equal(GP.stale(Date.now() - 59 * 1000, Date.now(), GP.STALE_MS), false);
  assert.equal(GP.stale(Date.now() - 60 * 1000, Date.now(), GP.STALE_MS), true);
  assert.equal(GP.stale(0, Date.now(), GP.STALE_MS), true);
  assert.equal(GP.STALE_MS, 60 * 1000);
  assert.equal(GP.findRow({ servers: [{ guild_id: "9", display_name: "No" }], follower_servers: [{ guild_id: GID, display_name: "Yes", icon_url: NEW_ICON }] }, GID).display_name, "Yes");
});

function inlineScripts(html) {
  return [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

function fakeDom() {
  const els = new Map();
  const mk = (id) => {
    const style = new Proxy({ setProperty() {}, removeProperty() {} }, { get: (t, k) => (k in t ? t[k] : ""), set: () => true });
    const el = {
      id, textContent: "", value: "", hidden: false, checked: false, disabled: false, dataset: {}, style,
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
  return { document, els, byId };
}

function mockResponse(body, status = 200) {
  const payload = JSON.parse(JSON.stringify(body));
  return {
    ok: status < 400, status, headers: { get: () => "application/json" },
    json: async () => JSON.parse(JSON.stringify(payload)),
    text: async () => JSON.stringify(payload),
    clone() { return mockResponse(payload, status); },
  };
}

function row(name, icon) {
  const out = { guild_id: GID, display_name: name, enabled: 1, subscription_active: 1, unit_size: 20, queued: 2, won: 3, lost: 1, profit_units: 4, roi: 12 };
  if (icon && String(icon).indexOf("http") === 0) out.icon_url = icon;
  else if (icon) out.icon = icon;
  return out;
}

function detailBody(name, icon) {
  return {
    settings: row(name, icon),
    stats: { won: 1, lost: 1, push: 0, queued: 0, strike_rate: 50, profit_units: 0.5, roi: 5, followers: 0 },
    tips: { settled: [], pending: [], queued: [] },
    months: [], month: "",
  };
}

function listBody(name, icon) {
  return { role: "mod", servers: [row(name, icon)], follower_servers: [] };
}

function walk(el, out) {
  if (!el) return out;
  if (el.innerHTML) out.push(el.innerHTML);
  for (const child of el.children || []) walk(child, out);
  return out;
}

function bootPage(fetchImpl, seed) {
  const { document, byId } = fakeDom();
  const store = new Map([
    ["tipbot_auth_epoch", "2"],
    ["tipbot_token", "t." + Buffer.from('{"exp":4102444800}').toString("base64") + ".x"],
  ]);
  if (seed) for (const [k, v] of Object.entries(seed)) store.set(k, v);
  const docListeners = [];
  const winListeners = [];
  document.addEventListener = (type, fn) => { docListeners.push([type, fn]); };
  const ctx = {
    document, localStorage: {
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
    addEventListener(type, fn) { winListeners.push([type, fn]); },
    removeEventListener() {},
    setTimeout: (fn, ms, ...args) => (ms > 500 ? 0 : setTimeout(fn, ms, ...args)),
    clearTimeout, setInterval: () => 0, clearInterval() {}, queueMicrotask,
    IntersectionObserver: class { observe() {} disconnect() {} unobserve() {} },
    ResizeObserver: class { observe() {} disconnect() {} unobserve() {} },
    MutationObserver: class { observe() {} disconnect() {} },
    URLSearchParams, URL, AbortController, Intl, Date, Math, JSON, Promise, Blob: class {}, FormData: class {},
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    Image: class {}, CustomEvent: class {}, Event: class {},
    performance: { now: () => Date.now(), getEntriesByType: () => [] },
    confirm: () => true, alert() {}, prompt: () => null,
    crypto: { randomUUID: () => "uuid-1" },
    fetch: fetchImpl,
    byId, store, docListeners, winListeners,
  };
  ctx.sessionStorage = ctx.localStorage;
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  document.head.appendChild = (s) => {
    const src = String(s.src || "");
    if (src.startsWith("blob:")) { setTimeout(() => s.onload && s.onload(), 1); return s; }
    const m = src.match(/assets\/([\w-]+)\.js/);
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

function bootCache(name, icon, savedAt) {
  return JSON.stringify({
    role: "mod",
    servers: [row(name, icon)],
    follower_servers: [],
    saved_at: savedAt == null ? Date.now() : savedAt,
  });
}

function detailCache(name, icon, savedAt) {
  return JSON.stringify({
    [GID + "|"]: { data: detailBody(name, icon), saved_at: savedAt == null ? Date.now() : savedAt },
  });
}

function fire(ctx, type) {
  for (const [name, fn] of ctx.docListeners) if (name === type) fn.call(ctx.document);
}

const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));

test("the page wires a fresh name and icon over both caches, and refetches after a minute away", async () => {
  let lite1Hits = 0;
  let detailHits = 0;
  let releaseLite0;
  let releaseServer;
  const lite0Gate = new Promise((r) => { releaseLite0 = r; });
  const serverGate = new Promise((r) => { releaseServer = r; });
  const ctx = bootPage(async (url) => {
    const u = String(url);
    if (u.includes("/api/servers")) {
      if (u.includes("lite=0")) {
        await lite0Gate;
        return mockResponse(listBody("Renamed", NEW_ICON));
      }
      lite1Hits += 1;
      return mockResponse(listBody(lite1Hits === 1 ? "Listed" : "Focus Listed", lite1Hits === 1 ? LIST_ICON : FOCUS_ICON));
    }
    if (u.includes("/api/server")) {
      detailHits += 1;
      if (detailHits === 1) await serverGate;
      return mockResponse(detailBody(detailHits === 1 ? "From Server" : "Focus Server", detailHits === 1 ? "srvhash" : FOCUS_ICON));
    }
    return mockResponse({ ok: true });
  }, {
    tipdash_boot_v1: bootCache("Cached Name", OLD_ICON, Date.now() - 5000),
    tipdash_detail_v1: detailCache("Cached Name", OLD_ICON, Date.now() - 5000),
  });
  assert.equal(ctx.loadError, undefined);
  const firstPaint = walk(ctx.byId("overview"), []).join("\n");
  assert.match(firstPaint, /Cached Name/);
  assert.match(firstPaint, /old\.png/);

  await tick(80);
  const listed = walk(ctx.byId("overview"), []).join("\n");
  assert.match(listed, /Listed/);
  assert.match(listed, /list\.png/);
  assert.doesNotMatch(listed, /Cached Name/);
  assert.doesNotMatch(listed, /old\.png/);
  const afterList = JSON.parse(ctx.store.get("tipdash_boot_v1"));
  assert.equal(afterList.servers[0].display_name, "Listed");
  assert.equal(afterList.servers[0].icon_url, LIST_ICON);

  vm.runInContext(`loadDetail("${GID}")`, ctx);
  const cachedHeader = ctx.byId("detail").innerHTML;
  assert.match(cachedHeader, /Cached Name/);
  assert.match(cachedHeader, /old\.png/);
  assert.match(cachedHeader, /id="server-title"/);

  releaseServer();
  await tick(80);
  const fromServer = ctx.byId("detail").innerHTML;
  assert.match(fromServer, /From Server/);
  assert.match(fromServer, /srvhash\.png/);
  assert.doesNotMatch(fromServer, /Cached Name/);
  assert.doesNotMatch(fromServer, /old\.png/);
  const detailSaved = JSON.parse(ctx.store.get("tipdash_detail_v1"));
  assert.equal(detailSaved[GID + "|"].data.settings.display_name, "From Server");
  assert.equal(detailSaved[GID + "|"].data.settings.icon, "srvhash");
  const bootAfterDetail = JSON.parse(ctx.store.get("tipdash_boot_v1"));
  assert.equal(bootAfterDetail.servers[0].display_name, "From Server");

  const hitsBeforeFocus = { lite: lite1Hits, detail: detailHits };
  fire(ctx, "visibilitychange");
  await tick(40);
  assert.equal(lite1Hits, hitsBeforeFocus.lite, "a fresh list cache is not fetched again");
  assert.equal(detailHits, hitsBeforeFocus.detail, "a fresh server cache is not fetched again");

  releaseLite0();
  await tick(80);
  const renamed = ctx.byId("detail").innerHTML;
  assert.match(renamed, /Renamed/);
  assert.match(renamed, /new\.png/);
  assert.doesNotMatch(renamed, /From Server/);
  assert.doesNotMatch(renamed, /srvhash/);
  const bootRenamed = JSON.parse(ctx.store.get("tipdash_boot_v1"));
  assert.equal(bootRenamed.servers[0].display_name, "Renamed");
  assert.equal(bootRenamed.servers[0].icon_url, NEW_ICON);
  const detailRenamed = JSON.parse(ctx.store.get("tipdash_detail_v1"));
  assert.equal(detailRenamed[GID + "|"].data.settings.display_name, "Renamed");
  assert.equal(detailRenamed[GID + "|"].data.settings.icon_url, NEW_ICON);

  bootRenamed.saved_at = Date.now() - 90 * 1000;
  delete bootRenamed.attempted_at;
  detailRenamed[GID + "|"].saved_at = Date.now() - 90 * 1000;
  ctx.store.set("tipdash_boot_v1", JSON.stringify(bootRenamed));
  ctx.store.set("tipdash_detail_v1", JSON.stringify(detailRenamed));
  fire(ctx, "visibilitychange");
  await tick(80);
  assert.equal(lite1Hits, hitsBeforeFocus.lite + 1);
  assert.equal(detailHits, hitsBeforeFocus.detail, "focus does not refetch the open server");
  const focused = ctx.byId("detail").innerHTML;
  assert.match(focused, /Focus Listed/);
  assert.match(focused, /focus\.png/);
  assert.doesNotMatch(focused, /Renamed/);
  const bootFocus = JSON.parse(ctx.store.get("tipdash_boot_v1"));
  assert.equal(bootFocus.servers[0].display_name, "Focus Listed");
  assert.equal(bootFocus.servers[0].icon_url, FOCUS_ICON);
  const detailFocus = JSON.parse(ctx.store.get("tipdash_detail_v1"));
  assert.equal(detailFocus[GID + "|"].data.settings.display_name, "Focus Listed");
  assert.equal(detailFocus[GID + "|"].data.settings.icon_url, FOCUS_ICON);
});

test("a failed servers response keeps the cached list", async () => {
  const ctx = bootPage(async (url) => {
    const u = String(url);
    if (u.includes("/api/servers")) return mockResponse({ error: "down" }, 500);
    return mockResponse({ ok: true });
  }, {
    tipdash_boot_v1: bootCache("Cached Name", OLD_ICON, Date.now()),
  });
  await tick(60);
  const html = walk(ctx.byId("overview"), []).join("\n");
  assert.match(html, /Cached Name/);
  assert.match(html, /old\.png/);
  assert.equal(ctx.byId("app").hidden, false);
});

test("prop counts stay on an open server when focus refreshes the name", async () => {
  let lite1Hits = 0;
  let detailHits = 0;
  let propHits = 0;
  const propTip = {
    tip_id: "tip-12",
    status: "Settled",
    result: "Win",
    profit_units: 1,
    game_name: "Carlton vs Richmond",
    bet_type: "Prop",
    legs: [{
      player: "Sam",
      stat: "Disposals",
      side: "Over",
      line: 20,
      current: 12,
      emoji: "🔥",
      status: "live",
      description: "🔥 Sam 20+ Disposals",
    }],
  };
  const ctx = bootPage(async (url) => {
    const u = String(url);
    if (u.includes("/api/servers")) {
      if (u.includes("lite=0")) return mockResponse(listBody("Listed", LIST_ICON));
      lite1Hits += 1;
      return mockResponse(listBody(lite1Hits === 1 ? "Listed" : "Focus Listed", lite1Hits === 1 ? LIST_ICON : FOCUS_ICON));
    }
    if (u.includes("/api/server/prop-counts")) {
      propHits += 1;
      return mockResponse({ tips: {} });
    }
    if (u.includes("/api/server")) {
      detailHits += 1;
      const body = detailBody("From Server", "srvhash");
      body.month = "2026-10";
      body.months = ["2026-10"];
      if (detailHits === 1) body.tips.settled = [JSON.parse(JSON.stringify(propTip))];
      return mockResponse(body);
    }
    return mockResponse({ ok: true });
  }, {
    tipdash_boot_v1: bootCache("Cached Name", OLD_ICON, Date.now() - 5000),
    tipdash_detail_v1: detailCache("Cached Name", OLD_ICON, Date.now() - 5000),
  });
  await tick(80);
  vm.runInContext(`loadDetail("${GID}")`, ctx);
  await tick(80);
  const painted = ctx.byId("detail").innerHTML;
  assert.match(painted, /12 \/ 20/);
  assert.match(painted, /🔥/);
  assert.equal(vm.runInContext("window.__tbDetailKey", ctx), GID + "|");
  assert.equal(vm.runInContext("STATE._detailShown.month", ctx), "2026-10");
  assert.equal(vm.runInContext("STATE._detailShown.tips.settled[0].legs[0].status", ctx), "live");
  vm.runInContext("STATE._detailShown._propMark=1", ctx);
  ctx.byId("detail").innerHTML = painted.replace("</h1>", "</h1><!-- prop-hold -->");

  const boot = JSON.parse(ctx.store.get("tipdash_boot_v1"));
  const detail = JSON.parse(ctx.store.get("tipdash_detail_v1"));
  boot.saved_at = Date.now() - 90 * 1000;
  delete boot.attempted_at;
  detail[GID + "|"].saved_at = Date.now() - 90 * 1000;
  ctx.store.set("tipdash_boot_v1", JSON.stringify(boot));
  ctx.store.set("tipdash_detail_v1", JSON.stringify(detail));
  const hits = { lite: lite1Hits, detail: detailHits, prop: propHits };
  fire(ctx, "visibilitychange");
  await tick(80);

  assert.equal(lite1Hits, hits.lite + 1);
  assert.equal(detailHits, hits.detail, "focus does not refetch /api/server");
  assert.equal(propHits, hits.prop, "focus does not reload prop counts");
  const html = ctx.byId("detail").innerHTML;
  assert.match(html, /prop-hold/);
  assert.match(html, /12 \/ 20/);
  assert.match(html, /🔥/);
  assert.match(html, /Focus Listed/);
  assert.match(html, /focus\.png/);
  assert.equal(vm.runInContext("STATE._detailShown._propMark", ctx), 1);
  assert.equal(vm.runInContext("STATE._detailShown.tips.settled[0].legs[0].emoji", ctx), "🔥");
  assert.equal(vm.runInContext("STATE._detailShown.tips.settled[0].legs[0].status", ctx), "live");
  assert.equal(vm.runInContext("STATE._detailShown.tips.settled[0].legs[0].current", ctx), 12);
  const saved = JSON.parse(ctx.store.get("tipdash_detail_v1"));
  assert.equal(saved[GID + "|"].data.tips.settled[0].legs[0].emoji, "🔥");
  assert.equal(saved[GID + "|"].data.tips.settled[0].legs[0].status, "live");
  assert.equal(saved[GID + "|"].data.tips.settled[0].legs[0].current, 12);
  assert.equal(saved[GID + "|"].data.settings.display_name, "Focus Listed");
  assert.equal(Object.keys(saved).some((k) => k === GID + "|2026-10"), false);
});

test("the first focus is gated when the open page was stored under gid| and the payload month differs", async () => {
  let lite1Hits = 0;
  let detailHits = 0;
  const ctx = bootPage(async (url) => {
    const u = String(url);
    if (u.includes("/api/servers")) {
      if (u.includes("lite=0")) return mockResponse(listBody("Listed", LIST_ICON));
      lite1Hits += 1;
      return mockResponse(listBody("Listed", LIST_ICON));
    }
    if (u.includes("/api/server") && !u.includes("prop-counts")) {
      detailHits += 1;
      const body = detailBody("From Server", "srvhash");
      body.month = "2026-10";
      body.months = ["2026-10"];
      return mockResponse(body);
    }
    return mockResponse({ ok: true });
  }, {
    tipdash_boot_v1: bootCache("Cached Name", OLD_ICON, Date.now() - 90 * 1000),
    tipdash_detail_v1: detailCache("Cached Name", OLD_ICON, Date.now() - 90 * 1000),
  });
  await tick(80);
  vm.runInContext(`loadDetail("${GID}")`, ctx);
  await tick(80);
  assert.equal(vm.runInContext("window.__tbDetailKey", ctx), GID + "|");
  assert.equal(vm.runInContext("STATE._detailShown.month", ctx), "2026-10");
  const boot = JSON.parse(ctx.store.get("tipdash_boot_v1"));
  boot.saved_at = Date.now() - 90 * 1000;
  delete boot.attempted_at;
  ctx.store.set("tipdash_boot_v1", JSON.stringify(boot));
  const store = JSON.parse(ctx.store.get("tipdash_detail_v1"));
  assert.ok(store[GID + "|"]);
  assert.equal(store[GID + "|2026-10"], undefined);
  const hits = { lite: lite1Hits, detail: detailHits };
  fire(ctx, "visibilitychange");
  await tick(40);
  assert.equal(lite1Hits, hits.lite, "a fresh gid| copy gates the first focus");
  assert.equal(detailHits, hits.detail, "the first focus does not refetch the server");
});

test("a failed focus fetch waits 60s before trying again", async () => {
  let lite1Hits = 0;
  let releaseLite0;
  const lite0Gate = new Promise((r) => { releaseLite0 = r; });
  const ctx = bootPage(async (url) => {
    const u = String(url);
    if (u.includes("/api/servers")) {
      if (u.includes("lite=0")) {
        await lite0Gate;
        return mockResponse(listBody("Full", LIST_ICON));
      }
      lite1Hits += 1;
      if (lite1Hits === 1) return mockResponse(listBody("Listed", LIST_ICON));
      return mockResponse({ error: "down" }, 503);
    }
    return mockResponse({ ok: true });
  }, {
    tipdash_boot_v1: bootCache("Cached Name", OLD_ICON, Date.now() - 90 * 1000),
  });
  await tick(80);
  const afterLoad = lite1Hits;
  const boot = JSON.parse(ctx.store.get("tipdash_boot_v1"));
  boot.saved_at = Date.now() - 90 * 1000;
  delete boot.attempted_at;
  ctx.store.set("tipdash_boot_v1", JSON.stringify(boot));
  fire(ctx, "visibilitychange");
  await tick(40);
  assert.equal(lite1Hits, afterLoad + 1);
  const attempted = JSON.parse(ctx.store.get("tipdash_boot_v1"));
  assert.equal(typeof attempted.attempted_at, "number");
  assert.ok(Date.now() - attempted.attempted_at < 5000);
  assert.equal(attempted.servers[0].display_name, "Listed");
  fire(ctx, "visibilitychange");
  await tick(40);
  assert.equal(lite1Hits, afterLoad + 1, "a 503 does not start another request inside the minute");
  const again = JSON.parse(ctx.store.get("tipdash_boot_v1"));
  again.saved_at = Date.now() - 90 * 1000;
  again.attempted_at = Date.now() - 90 * 1000;
  ctx.store.set("tipdash_boot_v1", JSON.stringify(again));
  fire(ctx, "visibilitychange");
  await tick(40);
  assert.equal(lite1Hits, afterLoad + 2);
  releaseLite0();
});

test("index.html refreshes the name and icon in place when the tab returns", () => {
  assert.match(HTML, /<script src="\.\/assets\/guild-profile\.js\?v=/);
  assert.match(HTML, /const IDENTITY_STALE_MS=60\*1000/);
  assert.match(HTML, /absorbFreshServers\(data\)/);
  assert.match(HTML, /absorbFreshServers\(full\)/);
  assert.match(HTML, /absorbFreshDetail\(data\)/);
  assert.match(HTML, /refreshGuildIdentity\(\)/);
  assert.match(HTML, /window\.__tbDetailKey=key/);
  assert.match(HTML, /window\.addEventListener\("focus", function\(\)\{\s*if\(document\.hidden \|\| !getToken\(\)\) return;\s*refreshGuildIdentity\(\);\s*\}\)/);
  const refresh = HTML.slice(HTML.indexOf("function refreshGuildIdentity"), HTML.indexOf('$("loginbtn")'));
  assert.match(refresh, /\/api\/servers\?lite=1/);
  assert.match(refresh, /absorbFreshServers\(data\)/);
  assert.match(refresh, /touchIdentityAttempt\(\)/);
  assert.match(HTML.slice(HTML.indexOf("function touchIdentityAttempt"), HTML.indexOf("function refreshGuildIdentity")), /attempted_at/);
  assert.doesNotMatch(refresh, /\/api\/server\?/);
  assert.doesNotMatch(refresh, /renderDetail/);
  const absorb = HTML.slice(HTML.indexOf("function absorbFreshServers"), HTML.indexOf("function absorbFreshDetail"));
  assert.match(absorb, /paintOpenServerIdentity/);
  assert.doesNotMatch(absorb, /renderDetail/);
});
