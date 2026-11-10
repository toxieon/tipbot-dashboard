// Stat tracker model choice (0.72.2): pure helpers and the Command access wiring.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ST = require("../assets/stat-tracker-models.js");

const MODELS = [
  { key: "with_price", label: "With-price", tracked: true, wins: 3, losses: 4, units: -1.5 },
  { key: "pub_sheet", label: "Pub sheet", tracked: false },
  { key: "best_pick", label: "Best <pick>", tracked: true, wins: 1, losses: 0, units: 0.85 },
];

test("trackedKeys follows the toggles in the models' order; dirty compares with the saved list", () => {
  assert.deepEqual(ST.trackedKeys(MODELS, { best_pick: true, with_price: true }), ["with_price", "best_pick"]);
  const v = { models: MODELS, tracked: ["with_price", "best_pick"] };
  assert.equal(ST.dirty(v, { with_price: true, best_pick: true }), false);
  assert.equal(ST.dirty(v, { with_price: true }), true);
});

test("record and units: W-L and signed units for tracked models only", () => {
  assert.equal(ST.record(MODELS[0]), "3-4 · \u22121.50u");
  assert.equal(ST.record(MODELS[1]), "");
  assert.equal(ST.units(0.85), "+0.85u");
  assert.equal(ST.units(0), "0.00u");
});

test("html: escapes labels, editable for owner/admin, read-only otherwise, warns when nothing is tracked", () => {
  const v = { models: MODELS, tracked: ["with_price", "best_pick"], totals: { wins: 4, losses: 4, units: -0.65 }, days: 30, can_edit: true };
  const on = { with_price: true, best_pick: true };
  const h = ST.html(v, on);
  assert.match(h, /Best &lt;pick&gt;/);
  assert.match(h, /id="stm-save" disabled/);
  assert.match(h, /Not tracked/);
  assert.equal((h.match(/role="switch"/g) || []).length, 3);
  const ro = ST.html({ ...v, can_edit: false }, on);
  assert.doesNotMatch(ro, /stm-save/);
  assert.match(ro, / disabled><\/button>/);
  assert.match(ST.html(v, {}), /count nothing/);
});

test("hasTally: shown with a saved choice or a recap in the window, hidden otherwise", () => {
  const m = (days, tracked = true) => ({ key: "pub_sheet", label: "Pub sheet", tracked, days });
  assert.equal(ST.hasTally(null), false);
  assert.equal(ST.hasTally({ ok: false, models: [m(3)] }), false);
  assert.equal(ST.hasTally({ ok: true }), false);
  assert.equal(ST.hasTally({ ok: true, models: [m(0), m(0)] }), false);
  assert.equal(ST.hasTally({ ok: true, models: [m(0), m(2)] }), true);
  assert.equal(ST.hasTally({ ok: true, updated_at: "2026-11-10T00:00:00Z", models: [m(undefined, false)] }), true);
});

test("Command access mounts the stat tracker (lazy) under the permissions", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /<div id="perms-box"><\/div><div id="stat-tracker-box"><\/div><div id="source-agree-box"><\/div>/);
  assert.match(html, /lazyScript\("stat-tracker-models"\)/);
  const src = fs.readFileSync(path.join(__dirname, "..", "assets", "stat-tracker-models.js"), "utf8");
  assert.match(src, /\/api\/server\/predictor-tracker\?guild_id=/);
  assert.match(src, /"\/api\/server\/predictor-tracking", \{ method: "POST"/);
});


test("Settings has Studio tab for tipster admins and clears Apex bottom nav", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /id="stab-studio">Studio</);
  assert.match(html, /studio-marker-cb/);
  assert.match(html, /#settings-panel \.panel-body\{padding-bottom:calc\(88px/);
  const src = fs.readFileSync(path.join(__dirname, "..", "assets", "stat-tracker-models.js"), "utf8");
  assert.match(src, /stm-act.*padding-bottom:calc\(72px/);
});
