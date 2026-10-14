// Features list: recap switches live here, and the list paints from memory.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const src = fs.readFileSync(path.join(root, "assets/auto-recaps.js"), "utf8");
const banned = /forward|mirror|master|consensus|OWNER_DISCORD|\/api\/ops|follow-stake/i;

const ctx = { window: {}, console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);
const TB = ctx.TBAutoRecaps;

function rootWith(state) {
  const inputs = {
    daily: { checked: !!state.daily },
    weekly: { checked: !!state.weekly },
    monthly: { checked: !!state.monthly },
  };
  return {
    querySelector(sel) {
      const m = String(sel).match(/data-period="(\w+)"/);
      if (m) return inputs[m[1]] || null;
      if (sel === "#recap-skip") return { checked: !!state.skip };
      return null;
    },
  };
}

test("recap helpers stay free of private terms", () => {
  assert.doesNotMatch(src, banned);
  assert.equal(typeof TB.mount, "undefined");
  assert.deepEqual(JSON.parse(JSON.stringify(TB.PERIODS.map((p) => p.key))), ["daily", "weekly", "monthly"]);
});

test("a fresh guild shows Daily, Weekly and Monthly off, and skip-empty on", () => {
  const fresh = { ok: true, settings: { channel_key: "recaps", skip_empty: true, daily: { enabled: false, hour: 9, minute: 0 }, weekly: { enabled: false, hour: 9, minute: 0, weekday: 0 }, monthly: { enabled: false, hour: 9, minute: 0, day: 1 } } };
  const state = JSON.parse(JSON.stringify(TB.checked(fresh, { "feat.daily_recap": false })));
  assert.deepEqual(state, { daily: false, weekly: false, monthly: false, skip_empty: true });
  const htmlGroup = TB.groupHtml(state);
  assert.match(htmlGroup, /id="recap-group"/);
  assert.equal((htmlGroup.match(/class="recap-cb"/g) || []).length, 3);
  assert.match(htmlGroup, /data-period="daily"/);
  assert.match(htmlGroup, /data-period="weekly"/);
  assert.match(htmlGroup, /data-period="monthly"/);
  assert.doesNotMatch(htmlGroup, /data-period="daily"[^>]*checked/);
  assert.match(htmlGroup, /id="recap-skip" checked/);
  assert.match(htmlGroup, /Preview daily/);
  assert.match(htmlGroup, /Preview weekly/);
  assert.match(htmlGroup, /Preview monthly/);
});

test("legacy daily flag stays on when the recap endpoint has no settings yet", () => {
  const state = TB.checked({ ok: false, status: 404 }, { "feat.daily_recap": true });
  assert.equal(state.daily, true);
  assert.equal(state.weekly, false);
  assert.equal(state.monthly, false);
  assert.equal(state.skip_empty, true);
});

test("saving sends enabled flags and keeps the Sydney schedule fields already stored", () => {
  const saved = { ok: true, settings: { channel_key: "recaps", skip_empty: true, daily: { enabled: false, hour: 18, minute: 30 }, weekly: { enabled: false, hour: 9, minute: 0, weekday: 0 }, monthly: { enabled: false, hour: 9, minute: 0, day: 1 } } };
  const body = TB.payload(rootWith({ daily: true, weekly: true, monthly: false, skip: true }), saved);
  assert.equal(body.daily.enabled, true);
  assert.equal(body.daily.hour, 18);
  assert.equal(body.daily.minute, 30);
  assert.equal(body.weekly.enabled, true);
  assert.equal(body.weekly.weekday, 0);
  assert.equal(body.weekly.hour, 9);
  assert.equal(body.monthly.enabled, false);
  assert.equal(body.monthly.day, 1);
  assert.equal(body.channel_key, "recaps");
  assert.equal(body.skip_empty, true);
  const off = TB.payload(rootWith({ daily: false, weekly: false, monthly: false, skip: false }), { ok: true, settings: {} });
  assert.equal(off.skip_empty, false);
  assert.equal(off.daily.hour, 9);
  assert.equal(off.weekly.weekday, 0);
  assert.equal(off.monthly.day, 1);
});

test("daily, weekly and monthly flag keys are not drawn as generic rows", () => {
  assert.equal(TB.isRecapKey("feat.daily_recap"), true);
  assert.equal(TB.isRecapKey("feat.weekly_recap"), true);
  assert.equal(TB.isRecapKey("feat.monthly_recap"), true);
  assert.equal(TB.isRecapKey("feat.sport_routing"), false);
});

test("Features paints from memory and Settings no longer mounts a recap block", () => {
  assert.match(html, /function prefetchFeatures\(gid\)/);
  assert.match(html, /if\(isAdmin\)\{\s*prefetchFeatures\(s\.guild_id\);/);
  assert.match(html, /STATE\.ops!==true\|\|STATE\.viewAs/);
  assert.match(html, /class="feat-shell"/);
  assert.match(html, /function loadFeatures\(gid\)\{[\s\S]*?paintFeatureShell\(box\);/);
  const load = html.slice(html.indexOf("function loadFeatures(gid)"), html.indexOf("function refreshFeatures(key)"));
  assert.doesNotMatch(load, /await /);
  assert.match(html, /keys\.forEach\(k=>\{/);
  assert.match(html, /isRecapKey\(k\)/);
  assert.match(html, /id="feat-enable-all"/);
  assert.match(html, /id="feat-disable-all"/);
  assert.match(html, /id="feat-save"/);
  assert.match(html, /querySelectorAll\("\.feat-cb, \.recap-cb"\)/);
  assert.match(html, /\/api\/auto-recap"/);
  assert.match(html, /\/api\/auto-recap\/preview"/);
  assert.doesNotMatch(html, /auto-recap-slot/);
  assert.doesNotMatch(html, /TBAutoRecaps\.mount/);
  const slice = html.slice(html.indexOf("function prefetchFeatures"), html.indexOf("var COMMAND_DESC_FALLBACK"));
  assert.doesNotMatch(slice, banned);
  assert.doesNotMatch(src, banned);
});
