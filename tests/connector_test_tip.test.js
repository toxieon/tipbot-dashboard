// node --test tests/   Send test tip button: path, confirm, outcomes, double-click guard.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets", "connector-push.js"), "utf8");
const P = require(path.join(root, "assets", "connector-push.js"));

test("route and confirm wording", () => {
  assert.equal(P.testTipPath("id/2", "guild 1"), "/api/connectors/id%2F2/test-tip?guild_id=guild%201");
  assert.equal(P.paths("c", "9").testTip, "/api/connectors/c/test-tip?guild_id=9");
  const named = P.testTipConfirm({ id: "c1", channel_name: "premium-tips" });
  assert.equal(named.title, "Send a test tip?");
  assert.match(named.message, /#premium-tips/);
  assert.match(named.message, /isn't saved or graded/);
  assert.equal(named.confirmLabel, "Send test tip");
  assert.match(P.testTipConfirm({ id: "c1" }).message, /this connector's channel/);
});

test("each connector row has the button next to Dry run", () => {
  const html = P.rowHtml({ id: "c1", tipster_name: "Tips" }, { set: true }, function () { return ""; });
  assert.match(html, /data-ps-dry>Dry run</);
  assert.match(html, /data-ps-test>Send test tip</);
});

test("outcomes: posted, older bot, rate limit, no channel, odd answers", () => {
  assert.deepEqual(P.testTipOutcome(200, { ok: true, posted: 1, channel_name: "premium-tips" }), { ok: true, message: "Test tip posted in #premium-tips." });
  assert.equal(P.testTipOutcome(200, { ok: true, posted: 1 }).message, "Test tip posted.");
  const old = P.testTipOutcome(404, { error: "not_found" });
  assert.equal(old.ok, false);
  assert.equal(old.notYet, true);
  assert.match(old.message, /doesn't have Send test tip yet/);
  assert.match(P.testTipOutcome(429, { retry_after: 7 }).message, /Wait 7s/);
  assert.match(P.testTipOutcome(429, {}).message, /Wait a few seconds/);
  assert.equal(P.testTipOutcome(400, { error: "no_channel", message: "This connector has no channel set. Pick a channel first." }).message, "This connector has no channel set. Pick a channel first.");
  assert.equal(P.testTipOutcome(200, { ok: false, error: "forbidden", message: "TipBot can't post in that channel." }).ok, false);
  assert.equal(P.testTipOutcome(500, null).message, "Couldn't send the test tip.");
});

test("runTestTip posts an empty body to the route and reports 401 as sign-out", async () => {
  const calls = [];
  const ctx = {
    gid: "9",
    api: async function (p, o) {
      calls.push({ p: p, method: o && o.method, body: o && o.body });
      return { ok: true, status: 200, json: async function () { return { ok: true, posted: 1, channel_name: "x" }; } };
    }
  };
  const out = await P.runTestTip(ctx, "c1");
  assert.equal(out.ok, true);
  assert.deepEqual(calls, [{ p: "/api/connectors/c1/test-tip?guild_id=9", method: "POST", body: "{}" }]);
  let signedOut = 0;
  const ctx2 = { gid: "9", onUnauth: function () { signedOut += 1; }, api: async function () { return { ok: false, status: 401, json: async function () { return {}; } }; } };
  const res = await P.runTestTip(ctx2, "c1");
  assert.equal(res.unauth, true);
  assert.equal(signedOut, 1);
});

function fakePage(extra) {
  const row = { getAttribute: function () { return "c1"; }, querySelector: function () { return msg; } };
  const msg = { textContent: "", classList: { toggle: function () {} } };
  const btn = { disabled: false, isConnected: true, closest: function () { return row; } };
  const rootEl = { querySelectorAll: function (sel) { return sel === "[data-ps-test]" ? [btn] : []; } };
  const doc = { getElementById: function () { return {}; }, createElement: function () { return {}; } };
  const el = {
    ownerDocument: doc, isConnected: true,
    set innerHTML(v) { this._html = v; },
    get innerHTML() { return this._html; },
    querySelector: function (sel) { return sel === "#ps-root" ? rootEl : null; },
    querySelectorAll: function (sel) { return sel === "[data-ps-id]" ? [row] : []; }
  };
  return Object.assign({ el: el, btn: btn, msg: msg }, extra);
}

async function settle() { for (let i = 0; i < 12; i++) await new Promise(function (r) { setImmediate(r); }); }

test("double tap sends once, asks first, and shows the channel in the toast", async () => {
  const page = fakePage();
  const posts = [];
  const toasts = [];
  let release;
  const gate = new Promise(function (r) { release = r; });
  const asked = [];
  const ctx = {
    gid: "9",
    when: function () { return ""; },
    toast: function (m, kind) { toasts.push([m, kind]); },
    confirm: async function (o) { asked.push(o); await gate; return true; },
    api: async function (p, o) {
      if (/test-tip/.test(p)) {
        posts.push(p);
        return { ok: true, status: 200, json: async function () { return { ok: true, posted: 1, channel_name: "premium-tips" }; } };
      }
      if (/push-secret\/status/.test(p)) return { ok: true, status: 200, json: async function () { return { set: true }; } };
      return { ok: true, status: 200, json: async function () { return { connectors: [{ id: "c1", tipster_name: "Tips", channel_name: "premium-tips" }] }; } };
    }
  };
  P.mount(page.el, ctx);
  await settle();
  assert.equal(typeof page.btn.onclick, "function");
  page.btn.onclick();
  page.btn.onclick();
  await settle();
  assert.equal(asked.length, 1);
  assert.match(asked[0].message, /#premium-tips/);
  assert.equal(posts.length, 0);
  assert.equal(page.btn.disabled, true);
  release();
  await settle();
  assert.equal(posts.length, 1);
  assert.deepEqual(toasts, [["Test tip posted in #premium-tips.", "success"]]);
  assert.equal(page.btn.disabled, false);
  page.btn.onclick();
  await settle();
  assert.equal(posts.length, 2);
});

test("cancel sends nothing; an older bot's 404 is a plain error toast", async () => {
  const page = fakePage();
  const posts = [];
  const toasts = [];
  let answer = false;
  const ctx = {
    gid: "9",
    toast: function (m, kind) { toasts.push([m, kind]); },
    confirm: async function () { return answer; },
    api: async function (p) {
      if (/test-tip/.test(p)) {
        posts.push(p);
        return { ok: false, status: 404, json: async function () { return { ok: false, error: "not_found" }; } };
      }
      if (/push-secret\/status/.test(p)) return { ok: true, status: 200, json: async function () { return { set: false }; } };
      return { ok: true, status: 200, json: async function () { return { connectors: [{ id: "c1" }] }; } };
    }
  };
  P.mount(page.el, ctx);
  await settle();
  page.btn.onclick();
  await settle();
  assert.equal(posts.length, 0);
  assert.equal(toasts.length, 0);
  answer = true;
  page.btn.onclick();
  await settle();
  assert.equal(posts.length, 1);
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0][1], "error");
  assert.match(toasts[0][0], /doesn't have Send test tip yet/);
  assert.equal(page.btn.disabled, false);
});

test("no storage, no logging, no client names in the source", () => {
  assert.doesNotMatch(src, /localStorage|sessionStorage/);
  assert.doesNotMatch(src, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
});
