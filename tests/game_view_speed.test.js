// node --test tests/   Game view: cached game switching, bounded prefetch, zoom lock.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const FL = require("../assets/follower-live.js");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("game cache: get/set and freshness", () => {
  let t = 1000;
  const c = FL.createGameCache(() => t);
  assert.equal(c.get("a"), null);
  c.set("a", { x: 1 });
  assert.deepEqual(c.get("a"), { x: 1 });
  assert.ok(c.fresh("a"));
  t += FL.CACHE_FRESH_MS + 1;
  assert.ok(!c.fresh("a"), "stale after the default window");
  assert.ok(c.fresh("a", 60000), "custom max age");
  assert.deepEqual(c.get("a"), { x: 1 }, "stale data is still served while it refreshes");
});

test("prefetch order: shown game first, fresh games skipped", () => {
  const c = FL.createGameCache(() => 0);
  const games = [{ key: "a" }, { key: "b" }, { key: "c" }, { key: "" }];
  assert.deepEqual(FL.prefetchOrder(games, "b").map((g) => g.key), ["b", "a", "c"]);
  c.set("c", {});
  assert.deepEqual(FL.prefetchOrder(games, "b", c).map((g) => g.key), ["b", "a"]);
});

test("runPool never has more than the limit in flight and finishes everything", async () => {
  let live = 0, peak = 0;
  const done = [];
  await FL.runPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
    live++; peak = Math.max(peak, live);
    try {
      await new Promise((r) => setTimeout(r, 5));
      if (n === 3) throw new Error("one bad game");
      done.push(n);
    } finally { live--; }
  });
  assert.equal(peak, 2);
  assert.deepEqual(done.sort(), [1, 2, 4, 5, 6]);
  await FL.runPool([], 2, () => { throw new Error("never"); });
});

function fakeDoc() {
  const listeners = {};
  const meta = { content: "width=device-width,initial-scale=1,viewport-fit=cover",
    getAttribute() { return this.content; }, setAttribute(k, v) { this.content = v; } };
  const cls = new Set();
  return {
    meta, listeners, cls,
    documentElement: { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c) } },
    querySelector: (q) => (q === 'meta[name="viewport"]' ? meta : null),
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener(t, f) { listeners[t] = (listeners[t] || []).filter((x) => x !== f); },
  };
}

test("zoom lock: viewport, gesture, pinch and double-tap guards on; all restored on unlock", () => {
  const doc = fakeDoc();
  const z = FL.createZoomLock(doc, {});
  assert.ok(z.lock());
  assert.ok(!z.lock(), "idempotent");
  assert.equal(doc.meta.content, "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover");
  assert.ok(doc.cls.has("gv-zoomlock"));
  for (const t of ["gesturestart", "gesturechange", "gestureend", "touchmove", "touchend"]) assert.equal(doc.listeners[t].length, 1, t);
  let prevented = 0;
  const ev = (extra) => Object.assign({ preventDefault() { prevented++; } }, extra);
  doc.listeners.gesturestart[0](ev());
  doc.listeners.touchmove[0](ev({ touches: [1, 2] }));
  doc.listeners.touchmove[0](ev({ touches: [1] }));
  assert.equal(prevented, 2, "gesture + two-finger move, not a one-finger scroll");
  doc.listeners.touchend[0](ev({}));
  doc.listeners.touchend[0](ev({}));
  assert.equal(prevented, 3, "second quick tap is a double-tap zoom");
  const onButton = { closest: (q) => (/button/.test(q) ? {} : null) };
  doc.listeners.touchend[0](ev({ target: onButton }));
  doc.listeners.touchend[0](ev({ target: onButton }));
  assert.equal(prevented, 3, "rapid taps on a button still click");
  assert.ok(z.unlock());
  assert.equal(doc.meta.content, "width=device-width,initial-scale=1,viewport-fit=cover");
  assert.ok(!doc.cls.has("gv-zoomlock"));
  for (const t of ["gesturestart", "gesturechange", "gestureend", "touchmove", "touchend"]) assert.equal(doc.listeners[t].length, 0, t);
});

test("index.html: switching paints from the cache, opening prefetches, zoom lock tied to Game view", () => {
  assert.match(HTML, /fliveLoadOwn\(true, \{switching:true\}\)/);
  assert.match(HTML, /const hit=cache\.get\(chosen\.key\);\s*if\(hit\)\{ flivePaintOwn\(hit/);
  assert.match(HTML, /FollowerLive\.runPool\(todo, 1,/);
  assert.match(HTML, /fliveLoadOwn\(false, \{opening:true, refreshFeeds:true\}\)/);
  assert.match(HTML, /function fliveUnfit\(\)\{\s*const z=fliveZoom\(\); if\(z\) z\.unlock\(\);/);
  assert.match(HTML, /classList\.add\("flive-lock"\);\s*const z=fliveZoom\(\); if\(z\) z\.lock\(\);/);
  assert.match(HTML, /html\.gv-zoomlock #flive\{touch-action:pan-x pan-y\}/);
  assert.match(HTML, /@media \(hover:none\) and \(pointer:coarse\)\{ input[^}]*font-size:max\(16px,1em\)!important\} \}/);
  // The global page viewport still allows zoom elsewhere (accessibility).
  assert.match(HTML, /<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">/);
});
