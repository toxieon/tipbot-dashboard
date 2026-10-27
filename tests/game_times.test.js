// Game view start times in the viewer's zone (Settings → Game times, default Melbourne).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const FL = require("../assets/follower-live.js");

function store(value) { return { getItem: (k) => (k === FL.TZ_KEY ? value : null) }; }

test("unset, unknown or broken settings mean Melbourne; device follows the device", () => {
  assert.equal(FL.DEFAULT_TZ, "Australia/Melbourne");
  assert.equal(FL.viewerZone(store(null), "Asia/Tokyo"), "Australia/Melbourne");
  assert.equal(FL.viewerZone(store("Mars/Base"), "Asia/Tokyo"), "Australia/Melbourne");
  assert.equal(FL.viewerZone({ getItem() { throw new Error("private mode"); } }, "Asia/Tokyo"), "Australia/Melbourne");
  assert.equal(FL.viewerZone(store("device"), "Asia/Tokyo"), "Asia/Tokyo");
  assert.equal(FL.viewerZone(store("device"), ""), "Australia/Melbourne");
  assert.equal(FL.viewerZone(store("Australia/Perth"), "Asia/Tokyo"), "Australia/Perth");
});

test("start times convert from UTC with daylight saving and the zone name", () => {
  const winter = Date.parse("2026-07-01T09:30:00Z");
  const summer = Date.parse("2026-11-01T08:30:00Z");
  assert.equal(FL.timeLabel(winter, "Australia/Melbourne", true), "Wed 1 Jul · 7:30 pm AEST");
  assert.equal(FL.timeLabel(summer, "Australia/Melbourne", true), "Sun 1 Nov · 7:30 pm AEDT");
  assert.equal(FL.timeLabel(summer, "Australia/Brisbane", true), "Sun 1 Nov · 6:30 pm AEST");
  assert.equal(FL.timeLabel(summer, "Australia/Perth", false), "Sun 1 Nov · 4:30 pm");
  // TipBot's zone-less timestamps are UTC, never the device's local time.
  assert.equal(FL.gameStartMs({ game_start: "2026-11-01 08:30:00" }), summer);
  assert.equal(FL.gameStartMs({ start: "2026-11-01T08:30Z" }), summer);
  assert.equal(FL.timeLabel(null, "Australia/Melbourne", true), "");
});

test("the scoreboard says when an upcoming game starts, in the chosen zone", () => {
  const game = { starts_at: "2099-11-01T08:30:00Z", venue: "Ground", home: { name: "A" }, away: { name: "B" } };
  try {
    FL.setZone("Australia/Melbourne");
    assert.match(FL.scoreHtml(game), /<span class="fl-starts">Starts Sun 1 Nov · 7:30 pm AEDT<\/span>/);
    FL.setZone("Australia/Perth");
    assert.match(FL.scoreHtml(game), /Starts Sun 1 Nov · 4:30 pm AWST/);
    assert.equal(FL.setZone("nonsense"), "Australia/Melbourne");
    const live = Object.assign({}, game, { live: true, starts_at: "2020-01-01T00:00:00Z" });
    assert.doesNotMatch(FL.scoreHtml(live), /fl-starts/);
  } finally {
    FL.setZone("Australia/Melbourne");
  }
});

test("Settings has Game times, saved per device, and the open game repaints", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<label class="tb-setting tb-gv-tz" id="dd-gv-tz"/);
  assert.match(html, /<select id="dd-gv-tz-pick"><\/select>/);
  assert.match(html, /\["", "Melbourne \(AEST\/AEDT\)"\], \["device", "This device"\]/);
  assert.match(html, /localStorage\.setItem\("tipdash_tz", tz\.value\)/);
  assert.match(html, /FollowerLive\.setZone\(FollowerLive\.viewerZone\(gvZoneStore\(\), deviceZone\(\)\)\)/);
  assert.match(html, /window\.addEventListener\("tipdash-tz", function\(\)\{ if\(FLIVE&&FLIVE\.board\) flivePaint\(FLIVE\.board\); \}\);/);
});
