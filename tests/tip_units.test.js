// ✎ Units on a posted tip until its first start (TipBot 0.102.1, POST /api/tip-units).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const U = require("../assets/tip-units.js");

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const NOW = Date.parse("2026-11-24T09:00:00Z");
const tip = (o) => Object.assign({tip_id: "1:NFL-1", units: 1, can_edit_units: true, units_lock_at: "2026-11-24T10:00:00Z"}, o);

test("button shows only for an editable tip before the lock", () => {
  assert.equal(U.canEdit(tip(), NOW), true);
  assert.equal(U.canEdit(tip({units_lock_at: "2026-11-24T08:59:00Z"}), NOW), false);
  assert.equal(U.canEdit(tip({can_edit_units: false}), NOW), false);
  assert.equal(U.canEdit(tip({units_lock_at: null}), NOW), false);
  assert.equal(U.buttonHtml(tip({can_edit_units: false}), esc), "");
});

test("parse", () => {
  assert.deepEqual(U.parse("2.5", 1), {units: 2.5});
  assert.deepEqual(U.parse("3u", 1), {units: 3});
  assert.deepEqual(U.parse("1", 1), {error: null});            // unchanged: nothing to send
  assert.deepEqual(U.parse("", 1), {error: null});
  assert.ok(U.parse("0", 1).error);
  assert.ok(U.parse("abc", 1).error);
  assert.ok(U.parse("101", 1).error);
});

function deps(status, body, typed) {
  const calls = [], toasts = [], saved = [], locked = [];
  return {
    calls, toasts, saved, locked,
    api: async (p, o) => { calls.push([p, JSON.parse(o.body)]); return {ok: status < 300, status, json: async () => body}; },
    ask: async () => typed, toast: (m, k) => toasts.push([m, k]),
    onSaved: (t) => saved.push(t), onLocked: (id) => locked.push(id),
  };
}

test("saves through /api/tip-units and reports", async () => {
  const d = deps(200, {ok: true, message: "Units updated.", tip: {tip_id: "1:NFL-1", units: 2}}, "2");
  await U.edit("1", "1:NFL-1", 1, d);
  assert.deepEqual(d.calls, [["/api/tip-units", {guild_id: "1", tip_id: "1:NFL-1", units: 2}]]);
  assert.deepEqual(d.saved, [{tip_id: "1:NFL-1", units: 2}]);
  assert.equal(d.toasts[0][1], "success");
});

test("409 after the start shows TipBot's message and drops the button", async () => {
  const d = deps(409, {ok: false, code: "started", message: "The game has started, so the units are locked."}, "2");
  await U.edit("1", "1:NFL-1", 1, d);
  assert.deepEqual(d.toasts, [["The game has started, so the units are locked.", "error"]]);
  assert.deepEqual(d.locked, ["1:NFL-1"]);
  assert.deepEqual(d.saved, []);
});

test("cancel or no change sends nothing", async () => {
  for (const typed of [null, "1", ""]) {
    const d = deps(200, {ok: true}, typed);
    await U.edit("1", "1:NFL-1", 1, d);
    assert.deepEqual(d.calls, []);
  }
});

test("index.html loads the script and puts the button on bet cards", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /assets\/tip-units\.js\?v=__TD_VERSION__/);
  assert.match(html, /right\+unitsBtn\+sbBtn\+fix\+del/);
  assert.match(html, /querySelectorAll\("\.unitsedit"\)/);
});
