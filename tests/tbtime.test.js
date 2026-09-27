// node --test tests/   (Tipdash has no build step; this only covers the pure clock helpers)
const test = require("node:test");
const assert = require("node:assert/strict");
const T = require("../assets/tbtime.js");

test("zone-less timestamps are UTC", () => {
  assert.equal(T.toMs("2026-09-27 09:30:00"), Date.parse("2026-09-27T09:30:00Z"));
  assert.equal(T.toMs("2026-09-27T09:30"), Date.parse("2026-09-27T09:30:00Z"));
  assert.equal(T.toMs("2026-09-27T19:30:00+10:00"), Date.parse("2026-09-27T09:30:00Z"));
  assert.equal(T.toMs(1790501552), 1790501552000);
  assert.ok(Number.isNaN(T.toMs("nope")));
});

test("Sydney day keys, whatever the device zone", () => {
  assert.equal(T.dayKey("2026-08-12T13:59:59Z"), "2026-08-12");
  assert.equal(T.dayKey("2026-08-12T14:00:00Z"), "2026-08-13"); // midnight AEST
  assert.equal(T.monthKey("2026-08-31T14:30:00Z"), "2026-09");
});

test("DST starts first Sunday in October (2026-10-04 02:00 → 03:00)", () => {
  assert.equal(T.parts("2026-10-03T15:59:00Z").hour, 1);  // 01:59 AEST
  assert.equal(T.parts("2026-10-03T16:00:00Z").hour, 3);  // 03:00 AEDT
  assert.equal(T.fromLocal(2026, 10, 4, 12, 0), Date.parse("2026-10-04T01:00:00Z"));
  assert.equal(T.fromLocal(2026, 10, 3, 12, 0), Date.parse("2026-10-03T02:00:00Z"));
  // 7 pm theme switch across the changeover: Sat 7 pm AEST → Sun 7 am AEDT is 11h (clock jumps).
  assert.equal(T.msUntilHour(7, "2026-10-03T09:00:00Z"), 11 * 3600e3);
});

test("games after midnight are the next Sydney day", () => {
  const now = "2026-09-27T02:00:00Z"; // Sun 12 pm AEST
  assert.equal(T.relDay("2026-09-27T10:00:00Z", now), "today");    // 8 pm Sun
  assert.equal(T.relDay("2026-09-27T17:00:00Z", now), "tomorrow"); // 3 am Mon (NFL 1 pm ET)
  assert.equal(T.relDay("2026-09-26T13:00:00Z", now), "yesterday");
});

test("day/night and formatting", () => {
  assert.equal(T.isDaytime("2026-09-27T02:00:00Z"), true);   // 12 pm
  assert.equal(T.isDaytime("2026-09-27T10:00:00Z"), false);  // 8 pm
  assert.match(T.fmtWhen("2026-09-27T09:30:00Z"), /Sun.*27.*Sep.*7:30/);
});
