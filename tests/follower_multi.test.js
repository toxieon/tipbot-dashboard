"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const FL = require("../assets/follower-live.js");

const legs = [
  {id: "t:1", tip_id: "t", player: "Ausar Thompson", line_label: "Over 19.5 Points", odds: null, multi: true, multi_odds: 1.12, status: "pending"},
  {id: "t:2", tip_id: "t", player: "Cade Cunningham", line_label: "Over 19.5 Points", odds: null, multi: true, multi_odds: 1.12, status: "pending"},
  {id: "s:1", tip_id: "s", player: "Solo", line_label: "Over 9.5 Rebounds", odds: 1.9, multi: false, status: "pending"},
];
const html = FL.render({tipsters: [{name: "T", legs}], game: {game_name: "Boston Celtics v Detroit Pistons"}});

test("multi legs render in one group card labelled as a multi", () => {
  assert.equal((html.match(/class="fl-multi"/g) || []).length, 1);
  assert.match(html, /Multi · 2 legs/);
  const multi = html.slice(html.indexOf('class="fl-multi"'), html.indexOf('data-leg="s:1"'));
  assert.match(multi, /Ausar Thompson/);
  assert.match(multi, /Cade Cunningham/);
});

test("leg text carries the market", () => {
  assert.match(html, /Ausar Thompson Over 19\.5 Points/);
});

test("the multi total shows once and is never copied onto legs", () => {
  assert.equal((html.match(/1\.12/g) || []).length, 1);
  assert.match(html, /1\.90|1\.9/);
  // Older payload: total copied onto each leg is lifted to the group.
  const old = FL.groupLegs([{tip_id: "x", odds: 1.12}, {tip_id: "x", odds: 1.12}]);
  assert.equal(old.length, 1);
  assert.equal(old[0].odds, 1.12);
  assert.ok(old[0].legs.every((l) => l.odds == null));
});
