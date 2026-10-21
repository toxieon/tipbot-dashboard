// node --test tests/   Connectors library sheet (owner-only, mirrors TipBot ops_ui).
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets", "connector-library.js"), "utf8");
const shell = fs.readFileSync(path.join(root, "assets", "owner-server.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const L = require(path.join(root, "assets", "connector-library.js"));

const PUSH = { id: "json-push", name: "JSON push feed", push: true, needs: ["tipster_name", "channel_id", "endpoint_url", "api_key"], optional: ["api_key"] };

test("form checks and the create body", () => {
  assert.equal(L.formError(null, {}), "Pick a type.");
  assert.equal(L.formError(PUSH, {}), "Give it a name.");
  assert.match(L.formError(PUSH, { tipster_name: "Example Tips", endpoint_url: "http://x" }), /https:\/\//);
  assert.equal(L.formError(PUSH, { tipster_name: "Example Tips", endpoint_url: "https://x.example/t" }), "");
  assert.deepEqual(L.createBody(PUSH, { tipster_name: " Example Tips ", channel_id: "6", endpoint_url: "https://x.example/t" }),
    { template: "json-push", tipster_name: "Example Tips", channel_id: "6", endpoint_url: "https://x.example/t" });
  assert.equal(L.paths("4 2", "c/1").templates, "/api/connectors/templates?guild_id=4%202");
  assert.equal(L.paths("42", "c/1").dryRun, "/api/connectors/c%2F1/push-dry-run?guild_id=42");
});

test("the sample request is signed like the push route checks it", async () => {
  const sig = await L.sign("secret-1", 1700000000, L.sampleBody());
  const want = crypto.createHmac("sha256", "secret-1").update("1700000000." + L.sampleBody()).digest("hex");
  assert.equal(sig, want);
  const text = L.sampleText("https://bot.example/", "c-1", 1700000000, sig);
  assert.match(text, /POST https:\/\/bot\.example\/api\/connectors\/c-1\/push\?test=1/);
  assert.match(text, new RegExp("X-Tip-Signature: sha256=" + want));
});

test("the secret never goes into markup, and nothing opens a tab", () => {
  const made = L.secretHtml({ id: "c-1", push_secret: "zzz-secret", tipster_name: "<i>X</i>" });
  assert.doesNotMatch(made, /zzz-secret/);
  assert.match(made, /&lt;i&gt;X&lt;\/i&gt;/);
  assert.match(made, /You won't see this again/);
  assert.doesNotMatch(src, /target=|window\.open/);
  assert.match(L.dryHtml({ unavailable: true }), /isn't on this bot yet/);
});

test("the shell mounts the library and the page passes the bot address", () => {
  assert.match(shell, /TD\.load\("connector-library"\)/);
  assert.match(shell, /data-cx-library/);
  assert.match(html, /apiBase:API/);
  assert.doesNotMatch(html, /connector-library|data-cx-library/);
});
