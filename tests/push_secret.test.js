// node --test tests/   Push secret row: status, rotate confirm, one-time secret.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets", "connector-push.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const P = require(path.join(root, "assets", "connector-push.js"));

test("status reads set and created_at, and the button name follows", () => {
  assert.equal(P.statusText({ set: false, created_at: null }, function () { return "16 Oct 2026"; }), "Not set");
  assert.equal(P.statusText({ set: 0 }, function () { return "16 Oct 2026"; }), "Not set");
  assert.equal(P.statusText(null), "Not set");
  assert.equal(P.statusText({ set: true, created_at: "2026-10-16T07:30:00Z" }, function () { return "16 Oct 2026"; }), "Set on 16 Oct 2026");
  assert.equal(P.statusText({ set: "true", created_at: "2026-10-16T07:30:00Z" }), "Set on 16 Oct 2026");
  assert.equal(P.buttonText(false), "Generate push secret");
  assert.equal(P.buttonText(true), "Rotate");
  assert.match(P.ROTATE_CONFIRM.message, /old secret stops working/);
  assert.equal(P.ROTATE_CONFIRM.confirmLabel, "Rotate");
});

test("routes are the push-secret status and generate endpoints", () => {
  const p = P.paths("id/2", "guild 1");
  assert.equal(p.status, "/api/connectors/id%2F2/push-secret/status?guild_id=guild%201");
  assert.equal(p.generate, "/api/connectors/id%2F2/push-secret/generate?guild_id=guild%201");
  assert.equal(p.list, "/api/connectors?guild_id=guild%201");
});

test("each connector row shows the status and the right button", () => {
  const unset = P.rowHtml({ id: "c1", tipster_name: "Tips" }, { set: false }, function () { return ""; });
  assert.match(unset, /Push secret/);
  assert.match(unset, /Not set/);
  assert.match(unset, /Generate push secret/);
  assert.match(unset, />Tips</);
  const set = P.rowHtml({ id: "c2" }, { set: true, created_at: "2026-10-16T00:00:00Z" }, function () { return "16 Oct 2026"; });
  assert.match(set, /Set on 16 Oct 2026/);
  assert.match(set, />Rotate</);
  assert.doesNotMatch(set, /Generate push secret/);
  const modal = P.modalHtml();
  assert.match(modal, /You won't see this again/);
  assert.match(modal, />Copy</);
  assert.doesNotMatch(modal, /value="[^"]+"/);
});

test("generate asks before replacing a secret, and the secret is not kept on the row", async () => {
  const calls = [];
  const ctx = {
    gid: "9",
    api: async function (path, opts) {
      calls.push({ path: path, method: opts && opts.method });
      return { ok: true, status: 200, json: async function () { return { secret: "once-only-value", created_at: "2026-10-16T01:02:03Z" }; } };
    },
    confirm: async function () { throw new Error("confirm should not run"); }
  };
  const fresh = await P.requestSecret(ctx, "c1", { set: false });
  assert.equal(fresh.secret, "once-only-value");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "POST");
  assert.match(calls[0].path, /\/push-secret\/generate/);

  let asked = 0;
  ctx.confirm = async function (o) { asked += 1; assert.match(o.message, /old secret stops working/); return false; };
  const skipped = await P.requestSecret(ctx, "c1", { set: true, created_at: "2026-10-01T00:00:00Z" });
  assert.equal(skipped.cancelled, true);
  assert.equal(calls.length, 1);
  assert.equal(asked, 1);

  ctx.confirm = async function () { return true; };
  const rotated = await P.requestSecret(ctx, "c1", { set: true });
  assert.equal(rotated.secret, "once-only-value");
  assert.equal(calls.length, 2);
  const kept = P.rememberStatus(rotated.created_at);
  assert.equal(kept.set, true);
  assert.equal(kept.created_at, "2026-10-16T01:02:03Z");
  assert.equal(Object.prototype.hasOwnProperty.call(kept, "secret"), false);
  assert.doesNotMatch(JSON.stringify(kept), /once-only-value/);
});

test("the secret is not stored or logged, and the sheet stays in the page", () => {
  assert.doesNotMatch(src, /localStorage|sessionStorage/);
  assert.doesNotMatch(src, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  assert.doesNotMatch(src, /window\.open|target\s*=\s*["']_blank["']/);
  assert.doesNotMatch(src, /forward|mirror|master|consensus|horsepicks|brandon/i);
  assert.match(P.modalHtml(), /You won't see this again/);
  assert.match(src, /data-ps-secret/);
  assert.match(src, /input\.value = ""/);
});

test("the row is mounted only from the owner connectors tab", () => {
  const start = html.indexOf('if(tab==="connectors")');
  const block = html.slice(start, start + 1800);
  assert.ok(block.indexOf("return;") < block.indexOf("ensureExt()"));
  assert.match(block, /data-cx-push/);
  assert.match(block, /mountPushSecrets\(push, ctx\)/);
  assert.match(html, /function mountPushSecrets\(el, ctx\)\{/);
  assert.match(html, /STATE\.ops===true && !STATE\.viewAs/);
  assert.match(html, /TD\.load\("connector-push"\)/);
  assert.doesNotMatch(html, /<script[^>]+connector-push\.js/);
  assert.doesNotMatch(html, /assets\/connectors\.js/);
  assert.doesNotMatch(html, /loadConnectorPanel|connector-panel/);
});
