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

const QUIET = {
  bookmaker: "Ladbrokes",
  show: {
    odds: true, bookie: false, track: true, form: false, confidence: false,
    units: true, silks: true, race_link: true, sport: false, bet_type: false,
    status: false, game: false, follow: false, tip_id: false
  }
};

test("the quiet preview keeps the runner, odds, units, silks and the race link", () => {
  const model = P.previewModel(QUIET);
  const names = model.fields.map((field) => field[0]);
  assert.equal(model.title, "RACING PLAY");
  assert.ok(names.includes("Odds"));
  assert.ok(names.includes("Units"));
  assert.ok(names.includes("Race"));
  assert.ok(names.includes("Legs"));
  assert.equal(names.includes("Sport"), false);
  assert.equal(names.includes("Bookmaker"), false);
  assert.equal(names.includes("Status"), false);
  assert.equal(names.includes("Game"), false);
  assert.equal(names.includes("Type"), false);
  assert.equal(model.description, "");
  assert.equal(model.footer, "");
  assert.equal(model.image, true);
  const legs = model.fields.find((field) => field[0] === "Legs")[1];
  assert.match(legs, /R4 Flemington · 3:15pm · #7 Fast Fleet/);
  assert.doesNotMatch(legs, /Win|3\/4 models/);
  const race = model.fields.find((field) => field[0] === "Race")[1];
  assert.match(race, /^https:\/\/www\.ladbrokes\.com\.au\/racing\/flemington\//);
  const page = P.previewHtml(QUIET, "");
  assert.match(page, /cp-card-wait/);
  assert.doesNotMatch(page, /Sportsbet/);
});

test("a bookmaker override replaces the feed bookie in the preview", () => {
  const model = P.previewModel({ bookmaker: "Ladbrokes", show: Object.assign({}, QUIET.show, { bookie: true }) });
  const book = model.fields.find((field) => field[0] === "Bookmaker")[1];
  assert.equal(book, "Ladbrokes");
});

test("confidence and notes appear only when those toggles are on", () => {
  const on = P.previewModel({
    bookmaker: "",
    show: Object.assign({}, QUIET.show, { confidence: true, form: true, tip_id: true })
  });
  assert.match(on.description, /Soft ground/);
  assert.match(on.description, /3\/4 models · High/);
  assert.match(on.fields.find((field) => field[0] === "Legs")[1], /3\/4 models · High/);
  assert.equal(on.footer, "Tip ID: preview");
  const feed = P.previewModel({ bookmaker: "", show: Object.assign({}, QUIET.show, { bookie: true }) });
  assert.equal(feed.fields.find((field) => field[0] === "Bookmaker")[1], "Sportsbet");
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
  assert.equal(P.TOGGLES.length, 14);
});
