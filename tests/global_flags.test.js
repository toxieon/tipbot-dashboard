// node --test tests/   Global switches: Marketplace and Build your own tips.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const GF = require("../assets/global-flags.js");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const apex = fs.readFileSync(path.join(root, "assets", "theme-apex.js"), "utf8");
const src = fs.readFileSync(path.join(root, "assets", "global-flags.js"), "utf8");

test("missing flags stay on, and an explicit false is kept", () => {
  GF.reset();
  assert.deepEqual(GF.readFlags({ ok: true }), {});
  assert.equal(GF.enabled("marketplace_enabled"), true);
  assert.equal(GF.enabled("build_tips_enabled"), true);
  GF.ingest({ marketplace_enabled: false });
  GF.ingest({ ok: true, name: "later" });
  assert.equal(GF.enabled("marketplace_enabled"), false);
  assert.equal(GF.enabled("build_tips_enabled"), true);
  assert.deepEqual(GF.payload(), { marketplace_enabled: false, build_tips_enabled: true });
});

test("config and me payloads are read from the top level or a nested bag", () => {
  GF.reset();
  assert.equal(GF.readFlags({ config: { build_tips_enabled: false } }).build_tips_enabled, false);
  assert.equal(GF.readFlags({ flags: { marketplace_enabled: 0 } }).marketplace_enabled, false);
  assert.equal(GF.readFlags({ marketplace_enabled: "true" }).marketplace_enabled, true);
  GF.ingest({ flags: { marketplace_enabled: false, build_tips_enabled: false } });
  assert.equal(GF.enabled("marketplace_enabled"), false);
  GF.ingest({ config: { marketplace_enabled: true } });
  assert.equal(GF.enabled("marketplace_enabled"), true);
  assert.equal(GF.enabled("build_tips_enabled"), false);
});

test("a flag that is off stays visible for the owner, with the badge", () => {
  GF.reset();
  GF.ingest({ marketplace_enabled: false, build_tips_enabled: false });
  assert.equal(GF.shown("marketplace_enabled"), false);
  assert.equal(GF.shown("build_tips_enabled"), false);
  assert.equal(GF.badge("build_tips_enabled"), "");
  GF.noteSession({ owner: true });
  assert.equal(GF.shown("marketplace_enabled"), true);
  assert.equal(GF.shown("build_tips_enabled"), true);
  assert.equal(GF.badge("marketplace_enabled"), "Off for users");
  assert.equal(GF.badge("build_tips_enabled"), "Off for users");
  GF.noteSession({ owner: false });
  assert.equal(GF.shown("marketplace_enabled"), false);
  assert.equal(GF.badge("marketplace_enabled"), "");
});

test("the Global section names both switches and posts both booleans", () => {
  GF.reset();
  GF.noteSession({ owner: true });
  GF.ingest({ marketplace_enabled: true, build_tips_enabled: false });
  const body = GF.settingsHtml({ message: "" });
  assert.match(body, /id="os-global"/);
  assert.match(body, />Global</);
  assert.match(body, />Marketplace</);
  assert.match(body, />Build your own tips</);
  assert.match(body, /data-gf="marketplace_enabled" checked/);
  assert.match(body, /data-gf="build_tips_enabled"(?! checked)/);
  assert.match(body, /data-gf-badge="build_tips_enabled"/);
  assert.match(body, /Off for users/);
  assert.equal(GF.PATH, "/api/owner/global-flags");
  assert.equal(GF.CONFIG_PATH, "/api/config");
  assert.deepEqual(Object.keys(GF.payload()).sort(), ["build_tips_enabled", "marketplace_enabled"]);
});

test("the page wires the owner section, the public read, and both hide points", () => {
  assert.match(html, /assets\/global-flags\.js/);
  assert.match(html, /id="dd-marketplace"/);
  assert.match(html, /id="marketplace"/);
  assert.match(html, /function openMarketplace\(/);
  assert.match(html, /api\("\/api\/config"/);
  assert.match(html, /TBGlobalFlags\.ingest\(me\)/);
  assert.match(html, /id="dd-global"/);
  assert.match(html, /TBGlobalFlags\.mountSettings\(box/);
  assert.doesNotMatch(html, /TBGlobalFlags\.mountSettings\(\$\("settings"\)/);
  assert.doesNotMatch(html, /id="stab-global"/);
  assert.match(html, /if\(m\[2\]==="build" && !buildTipsShown\(\)\) return enterHome\(\), true;/);
  assert.match(html, /if\(m\[0\]==="marketplace"\)\{ if\(!marketplaceShown\(\)\) return enterHome\(\), true;/);
  assert.match(apex, /var TABS = \["home", "build", "upcoming"\];/);
  assert.match(apex, /if \(id === "build" && !flagShown\("build_tips_enabled"\)\) return;/);
  assert.match(apex, /apex-tabs-nobuild/);
  assert.doesNotMatch(src, /forward|mirror|master|consensus/i);
  assert.doesNotMatch(src, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
});
