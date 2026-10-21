// node --test tests/   Post settings stay on the owner connectors page.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets", "connector-post.js"), "utf8");
const shell = fs.readFileSync(path.join(root, "assets", "owner-server.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const P = require(path.join(root, "assets", "connector-post.js"));

const QUIET = { post_bookmaker: "Ladbrokes", post_style: "quiet" };

test("the quiet preview is the compact racing post", () => {
  const model = P.previewModel(QUIET);
  const names = model.fields.map((field) => field[0]);
  assert.equal(model.title, "\uD83C\uDFC7 R4 Flemington");
  assert.match(model.description, /#7 Fast Fleet/);
  assert.match(model.description, /\$4\.50 \(Ladbrokes\)/);
  assert.match(model.description, /1u \u00b7 Pending/);
  assert.doesNotMatch(model.description, /https?:\/\//);
  assert.equal(model.link.text, "Bet on Ladbrokes \u2192");
  assert.match(model.link.url, /^https:\/\/www\.ladbrokes\.com\.au\/racing\/flemington\//);
  const html = P.previewHtml({post_bookmaker: "Ladbrokes", post_style: "quiet"});
  assert.match(html, /<a [^>]*>Bet on Ladbrokes \u2192<\/a>/);
  assert.doesNotMatch(html, />https?:\/\//);
  assert.equal(model.button, "Bet on Ladbrokes");
  assert.equal(model.image, true);
  assert.equal(names.includes("Sport"), false);
  assert.equal(names.includes("Bookmaker"), false);
  assert.equal(names.includes("Status"), false);
  assert.equal(names.includes("Game"), false);
  assert.equal(names.includes("Type"), false);
  const page = P.previewHtml(QUIET);
  assert.match(page, /Silk card/);
  assert.match(page, /Quiet|cp-btn/);
});

test("full is stored as post_style standard and previews the full post", () => {
  assert.equal(P.styleCode("Full"), "standard");
  assert.equal(P.styleCode("quiet"), "quiet");
  const body = P.saveBody({ post_bookmaker: "TAB", post_style: "full" });
  assert.deepEqual(body, { post_bookmaker: "TAB", post_style: "standard" });
  const model = P.previewModel({ post_bookmaker: "Sportsbet", post_style: "standard" });
  const names = model.fields.map((field) => field[0]);
  assert.equal(model.title, "RACING PLAY");
  assert.ok(names.includes("Sport"));
  assert.ok(names.includes("Type"));
  assert.ok(names.includes("Odds"));
  assert.ok(names.includes("Units"));
  assert.equal(model.fields.find((field) => field[0] === "Bookmaker")[1], "Sportsbet");
  assert.equal(model.image, false);
  assert.equal(model.button, "");
});

test("a missing bookmaker reads as Ladbrokes", () => {
  assert.equal(P.bookOf({}), "Ladbrokes");
  assert.equal(P.saveBody({}).post_bookmaker, "Ladbrokes");
  assert.equal(P.saveBody({}).post_style, "quiet");
  assert.ok(P.BOOKS.includes("Ladbrokes"));
  assert.ok(P.BOOKS.includes("bet365"));
});

test("the section is mounted only from the owner connectors shell", async () => {
  const { ASSET_DENY } = await import("../scripts/build-public.mjs");
  assert.equal(ASSET_DENY.has("assets/connector-post.js"), true);
  const start = shell.indexOf("function renderConnectors");
  const block = shell.slice(start, start + 1800);
  assert.match(block, /data-cx-post/);
  assert.match(shell, /mountPostSettings\(post, ctx\)/);
  assert.match(shell, /TD\.load\("connector-post"\)/);
  assert.match(shell, /ctx\.owner !== true/);
  assert.doesNotMatch(html, /connector-post|data-cx-post|Post settings/);
  assert.doesNotMatch(html, /<script[^>]+connector-post\.js/);
  assert.doesNotMatch(src, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  assert.doesNotMatch(src, /forward|mirror|master|consensus/i);
  assert.doesNotMatch(src, /post-settings/);
  assert.match(src, /post_bookmaker/);
  assert.match(src, /post_style/);
  assert.match(src, /\/api\/connectors\//);
  assert.match(src, />Quiet</);
  assert.match(src, />Full</);
  assert.doesNotMatch(src, /Tip channel tiers|tip_channel_tiers|daily_free_limit|data-cp-tier|\/api\/channels/);
  const builder = fs.readFileSync(path.join(root, "assets", "builder.js"), "utf8");
  assert.match(builder, /id="f_tier"/);
  assert.match(builder, /<option value="">Auto<\/option>/);
  assert.match(builder, /<option value="free">Free<\/option>/);
  assert.match(builder, /<option value="premium">Premium<\/option>/);
  assert.match(builder, /if\(tier==="free"\|\|tier==="premium"\) out\.tier=tier/);
  assert.match(builder, /if\(tipFields\.tier\) payload\.tier=tipFields\.tier/);
  assert.doesNotMatch(builder, /out\.tier=""/);
});

test("post description and link: cleaned, validated and previewed", () => {
  const link = "https://apps.apple.com/au/app/example-tips/id000000000";
  assert.equal(P.cleanDescription("Hi @everyone <@&12> see https://x.example/a ok"), "Hi see ok");
  assert.doesNotMatch(P.cleanDescription("@every@everyoneone"), /@everyone/);
  assert.equal(P.linkError(link), "");
  assert.equal(P.linkError(""), "");
  ["http://apps.apple.com/x", "javascript:alert(1)", "https://localhost/x", "https://a.com/x)", "https://u@a.com/x", "apps.apple.com"].forEach((bad) => {
    assert.notEqual(P.linkError(bad), "", bad);
  });
  assert.equal(P.labelError("Get the app"), "");
  assert.notEqual(P.labelError("[x](y)"), "");
  const body = P.saveBody({ post_bookmaker: "TAB", post_style: "quiet", post_description: " Example  Tips @here ", post_link: " " + link + " ", post_link_label: "" });
  assert.equal(body.post_description, "Example Tips");
  assert.equal(body.post_link, link);
  assert.equal(body.post_link_label, "");
  const quiet = P.previewModel({ post_style: "quiet", post_description: "Example Tips daily - 1 unit each-way", post_link: link });
  assert.equal(quiet.extra.description, "Example Tips daily - 1 unit each-way");
  assert.equal(quiet.extra.link.text, "App Store →");
  const full = P.previewModel({ post_style: "standard", post_description: "Daily", post_link: link, post_link_label: "Get the app" });
  assert.equal(full.extra.link.text, "Get the app →");
  const html = P.previewHtml({ post_style: "quiet", post_description: "<b>x</b>", post_link: link });
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /data-cp-extra-link/);
  assert.doesNotMatch(html, new RegExp('<a[^>]+href="' + link.replace(/[.?/]/g, "\\$&")));
  const bad = P.previewModel({ post_style: "quiet", post_link: "http://plain.example" });
  assert.equal(bad.extra.link, null);
});

test("the post link fields never open a new tab", () => {
  const block = src.slice(src.indexOf("var extra = model.extra"), src.indexOf("if (model.fields.length)"));
  assert.doesNotMatch(block, /target=|window\.open/);
  assert.match(src, /data-cp-desc/);
  assert.match(src, /data-cp-link/);
  assert.match(src, /data-cp-label/);
});
