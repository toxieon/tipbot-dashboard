// node --test tests/   Push secret row: status, rotate confirm, one-time secret.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets", "connector-push.js"), "utf8");
const shell = fs.readFileSync(path.join(root, "assets", "owner-server.js"), "utf8");
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
  assert.match(unset, /Connector ID/);
  assert.match(unset, /class="ps-id">c1</);
  assert.match(unset, /data-ps-copy-id>Copy</);
  const set = P.rowHtml({ id: "c2" }, { set: true, created_at: "2026-10-16T00:00:00Z" }, function () { return "16 Oct 2026"; });
  assert.match(set, /Set on 16 Oct 2026/);
  assert.match(set, />Rotate</);
  assert.doesNotMatch(set, /Generate push secret/);
  const modal = P.modalHtml();
  assert.match(modal, /You won't see this again/);
  assert.match(modal, /Connector ID/);
  assert.match(modal, /Push secret/);
  assert.match(modal, /data-ps-copy-id>Copy</);
  assert.match(modal, /data-ps-copy-secret>Copy</);
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
  assert.doesNotMatch(src, /forward|mirror|master|consensus/i);
  assert.doesNotMatch(shell, /forward|mirror|master|consensus/i);
  assert.match(P.modalHtml(), /You won't see this again/);
  assert.match(src, /data-ps-secret/);
  assert.match(src, /input\.value = ""/);
});

test("owner source has no private scan terms", async () => {
  const raw = process.env.TIPDASH_SCAN_TERMS;
  if (!raw) return;
  const { parseTerms, findHits } = await import("../scripts/ci-public-guard.mjs");
  const files = ["assets/connector-push.js", "assets/owner-server.js", "index.html", "PUBLIC_CHANGELOG.md"].map((rel) => path.join(root, rel));
  assert.deepEqual(findHits(files, parseTerms(raw)), []);
});

test("the row is mounted only from the owner connectors shell", () => {
  const start = shell.indexOf("function renderConnectors");
  const block = shell.slice(start, start + 1800);
  assert.ok(block.indexOf("return;") < block.indexOf("ensureExt()"));
  assert.match(block, /data-cx-push/);
  assert.match(shell, /mountPushSecrets\(push, ctx\)/);
  assert.match(shell, /TD\.load\("connector-push"\)/);
  assert.match(shell, /ctx\.owner !== true/);
  assert.match(html, /TD\.load\("owner-server"\)/);
  assert.match(html, /STATE\.ops===true && !STATE\.viewAs/);
  assert.doesNotMatch(html, /connector|Connectors|data-cx-|push-secret|Push secret|connector-push/i);
  assert.doesNotMatch(html, /<script[^>]+connector-push\.js/);
  assert.doesNotMatch(html, /<script[^>]+owner-server\.js/);
  assert.doesNotMatch(html, /assets\/connectors\.js/);
  assert.doesNotMatch(html, /loadConnectorPanel|connector-panel/);
});

test("dry run: path, pasted JSON check, and the result is escaped text with no links", async () => {
  assert.equal(P.dryRunPath("id/2", "guild 1"), "/api/connectors/id%2F2/push-dry-run?guild_id=guild%201");
  assert.equal(P.paths("c", "9").dryRun, "/api/connectors/c/push-dry-run?guild_id=9");
  assert.equal(P.parsePayload("").error, "Paste a push body first.");
  assert.equal(P.parsePayload("{nope").error, "That isn't valid JSON.");
  assert.equal(P.parsePayload("3").error, "The body must be a JSON object or list.");
  assert.deepEqual(P.parsePayload(' {"tips":[]} ').payload, { tips: [] });
  const body = {
    ok: true, test: true, count: 2, accepted: 1, paused: true,
    tips: [
      { index: 0, id: "t-1", accepted: true, reasons: [], market: "EW", odds: 5, units: 2, would_be_late: true,
        resolved: { status: "matched", legs: [
          { event_id: "e", meeting_name: "Flemington", race_number: 4, runner_number: 7, runner_name: "Fast Fleet", bet_type: "win" },
          { event_id: "e", meeting_name: "Flemington", race_number: 4, runner_number: 7, runner_name: "Fast Fleet", bet_type: "place" }] },
        each_way: { stake_each_part: 1, place_odds: 2, place_odds_source: "terms fraction of the win odds",
          place_terms: { fraction: 0.25, places: 3 }, place_terms_source: "sent" },
        preview: { text: "<b>R4</b> [App Store →](https://apps.apple.com/x)" } },
      { index: 1, id: "t-2", accepted: false, reasons: ["odds must be > 1"], resolved: { status: "not_checked" } }
    ]
  };
  const html = P.resultHtml(body);
  assert.match(html, /1 of 2 would post\. Nothing was posted or saved\. The connector is paused\./);
  assert.match(html, /Would post/);
  assert.match(html, /Would not post/);
  assert.match(html, /odds must be &gt; 1/);
  assert.match(html, /Flemington R4 · #7 Fast Fleet · place/);
  assert.match(html, /Late: posted after the start/);
  assert.match(html, /&lt;b&gt;R4&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<a\b|target=|window\.open/);
  assert.match(P.resultHtml({ ok: false, message: "bad body" }), /bad body/);
  const sheet = P.dryRunHtml("Feed <x>");
  assert.match(sheet, /Feed &lt;x&gt;/);
  assert.match(sheet, /data-pd-input/);
  assert.match(sheet, /data-pd-run/);
  assert.doesNotMatch(src, /target=["']?_blank|window\.open/);

  const sent = [];
  const ctx = { gid: "9", api: async function (p, opts) { sent.push({ p: p, opts: opts }); return { ok: true, status: 200, json: async function () { return body; } }; } };
  const out = await P.runDryRun(ctx, "c1", '{"tips":[{"id":"t-1"}]}');
  assert.equal(out.accepted, 1);
  assert.equal(sent[0].p, "/api/connectors/c1/push-dry-run?guild_id=9");
  assert.equal(sent[0].opts.method, "POST");
  assert.deepEqual(JSON.parse(sent[0].opts.body), { payload: { tips: [{ id: "t-1" }] } });
  const bad = await P.runDryRun(ctx, "c1", "{oops");
  assert.equal(bad.ok, false);
  assert.equal(sent.length, 1);
});

test("each connector row has a Dry run button", () => {
  const row = P.rowHtml({ id: "c1", tipster_name: "Tips" }, { set: true }, function () { return ""; });
  assert.match(row, /data-ps-dry>Dry run</);
});
