// Predictor Call settings (0.73.2): helpers, Command access wiring, public-scan safety.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const SA = require("../assets/source-agree-mod.js");

const VIEW = {
  ok: true,
  has_predictor: true,
  can_edit: true,
  enabled: false,
  sources: [],
  channel_id: null,
  picker: [
    { id: "s1", tipster_name: "Feed <A>", guild_name: "Alpha", enabled: true },
    { id: "s2", tipster_name: "Feed B", guild_name: "Beta", enabled: false },
  ],
  channels: [
    { id: "10", name: "source-agree" },
    { id: "11", name: "general" },
  ],
};

test("visible only when the server has a Horse Predictor", () => {
  assert.equal(SA.visible(null), false);
  assert.equal(SA.visible({ ok: true, has_predictor: false }), false);
  assert.equal(SA.visible({ ok: true, has_predictor: true }), true);
});

test("dirty and selectedIds follow enable, sources and dest channel", () => {
  const st = SA.takeState(VIEW);
  assert.equal(st.enabled, false);
  assert.deepEqual(SA.selectedIds(VIEW, st), []);
  assert.equal(SA.dirty(VIEW, st), false);
  st.enabled = true;
  st.src.s1 = true;
  st.channel_id = "10";
  assert.deepEqual(SA.selectedIds(VIEW, st), ["s1"]);
  assert.equal(SA.dirty(VIEW, st), true);
});

test("html: hidden extras when off, escapes names, read-only without can_edit", () => {
  const off = SA.html(VIEW, SA.takeState(VIEW));
  assert.match(off, /id="sam-on"/);
  assert.doesNotMatch(off, /data-src=/);
  assert.doesNotMatch(off, /sam-ch/);
  const onState = { enabled: true, src: { s1: true, s2: false }, channel_id: "10" };
  const on = SA.html(VIEW, onState);
  assert.match(on, /Feed &lt;A&gt;/);
  assert.match(on, /data-src="s1"/);
  assert.match(on, /id="sam-ch"/);
  assert.match(on, /#source-agree/);
  const ro = SA.html({ ...VIEW, can_edit: false }, onState);
  assert.doesNotMatch(ro, /sam-save/);
  assert.match(ro, /Only the owner or a server admin/);
});

test("Command access mounts Predictor Call under the permissions", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /id="source-agree-box"/);
  assert.match(html, /lazyScript\("source-agree-mod"\)/);
  assert.doesNotMatch(html, /connector/i);
  const src = fs.readFileSync(path.join(__dirname, "..", "assets", "source-agree-mod.js"), "utf8");
  assert.match(src, /\/api\/server\/predictor-agree\?guild_id=/);
  assert.match(src, /"\/api\/server\/predictor-agree", \{ method: "POST"/);
  const deny = fs.readFileSync(path.join(__dirname, "..", "scripts", "build-public.mjs"), "utf8");
  assert.match(deny, /assets\/source-agree-mod\.js/);
});
