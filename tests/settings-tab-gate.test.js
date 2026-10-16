// node --test tests/   The connectors settings shell is owner-only and is not in the public page.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("the connectors shell is owner-only and stays out of the public page", async () => {
  const { ASSET_DENY } = await import("../scripts/build-public.mjs");
  const shell = fs.readFileSync(path.join(__dirname, "..", "assets", "owner-server.js"), "utf8");
  assert.equal(ASSET_DENY.has("assets/owner-server.js"), true);
  assert.equal(ASSET_DENY.has("assets/connector-push.js"), true);
  assert.match(shell, /#stab-connectors/);
  assert.match(shell, /btn\.id = "stab-connectors"/);
  assert.match(shell, /Connectors/);
  assert.match(shell, /ctx\.owner !== true/);
  const start = shell.indexOf("function renderConnectors");
  const block = shell.slice(start, start + 1800);
  assert.ok(block.indexOf("return;") < block.indexOf("ensureExt()"));
  assert.match(block, /TBConnectors\.mount/);
  assert.match(block, /TBConnectorPanel\.mount/);
  assert.doesNotMatch(html, /connector|Connectors|data-cx-|push-secret|Push secret|connector-push/i);
  assert.doesNotMatch(html, /assets\/connectors\.js/);
  assert.doesNotMatch(html, /<script[^>]+connector-panel\.js/);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "assets", "connectors.js")), false);
  assert.doesNotMatch(html, /loadConnectorPanel|connector-panel/);
  assert.doesNotMatch(shell, /loadConnectorPanel|connector-panel/);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "assets", "connector-panel.js")), false);
});
