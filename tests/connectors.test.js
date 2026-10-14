// node --test tests/   Owner-only Connectors: write-only key, paused default, route contract.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const C = require("../assets/connectors.js");
const src = fs.readFileSync(path.join(root, "assets/connectors.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("a new connector is paused, skips past events, and uses the default label", () => {
  const form = C.formFrom(null);
  assert.equal(form.enabled, false);
  assert.equal(form.skip_past_events, true);
  assert.equal(form.post_mode, "replace");
  assert.equal(form.tipster_label, "HorsePicks AI");
  assert.equal(form.poll_interval_seconds, 60);
  assert.equal(form.backfill_from, "");
  assert.equal(form.api_key, "");
  assert.equal(form.endpoint_url, C.DEFAULT_ENDPOINT);
  assert.equal(C.postModeLabel(form.post_mode), "Replace their posts");
  assert.equal(C.postModeLabel("alongside"), "Mirror alongside");
});

test("the key is write-only: never copied into the form, and omitted until typed", () => {
  const form = C.formFrom({
    id: "c1",
    api_key: "super-secret-key-abcd",
    api_key_last4: "fYa1",
    has_api_key: true,
    enabled: 0,
    skip_past_events: false,
    post_mode: "mirror",
    tipster_name: "HorsePicks AI",
    poll_interval: 90,
  });
  assert.equal(form.api_key, "");
  assert.equal(form.api_key_last4, "fYa1");
  assert.equal(form.enabled, false);
  assert.equal(form.skip_past_events, false);
  assert.equal(form.post_mode, "alongside");
  assert.equal(form.poll_interval_seconds, 90);
  assert.match(C.keyNote(form), /ends in fYa1/);
  assert.doesNotMatch(JSON.stringify(form), /super-secret-key/);

  const blank = C.payload(form, "9");
  assert.equal(blank.api_key, undefined);
  assert.equal(blank.guild_id, "9");
  assert.equal(blank.id, "c1");
  assert.equal(blank.enabled, false);
  assert.equal(blank.post_mode, "alongside");

  form.api_key = "new-key-value";
  const sent = C.payload(form, "9");
  assert.equal(sent.api_key, "new-key-value");
  assert.equal(Object.prototype.hasOwnProperty.call(blank, "api_key"), false);
});

test("routes match the connector contract", () => {
  const p = C.pathsFor("guild/1", "id 2");
  assert.equal(p.list, "/api/connectors?guild_id=guild%2F1");
  assert.equal(p.save, "/api/connectors?guild_id=guild%2F1");
  assert.equal(p.remove, "/api/connectors?guild_id=guild%2F1&id=id%202");
  assert.equal(p.test, "/api/connectors/id%202/test");
  assert.equal(p.dryRun, "/api/connectors/id%202/dry-run");
  assert.equal(p.toggle, "/api/connectors/id%202/toggle");
});

test("test preview keeps the count and only the first three mapped tips", () => {
  const view = C.testView({
    ok: true,
    count: 5,
    preview: [
      { event: "Flemington R4", selection: { number: 3, name: "Night Mail" }, market: "Win", odds: 4.2, bookie: "TAB", stake_units: 1, confidence: { models_agreeing: 3, models_total: 4, rating: "High" } },
      { line: "Randwick R2 · 1 River Bend" },
      "Caulfield R6 · Gold Run",
      { event: "Should not show" },
    ],
  });
  assert.equal(view.count, 5);
  assert.equal(view.lines.length, 3);
  assert.match(view.lines[0], /Flemington R4/);
  assert.match(view.lines[0], /3 Night Mail/);
  assert.match(view.lines[0], /3\/4 models · High/);
  assert.equal(view.lines[1], "Randwick R2 · 1 River Bend");
  assert.doesNotMatch(view.lines.join("\n"), /Should not show/);
  const html = C.resultHtml("test", { ok: true, count: 5, preview: view.lines.concat(["extra"]) });
  assert.match(html, /5 tips/);
  assert.match(html, /Nothing was posted/);
  assert.doesNotMatch(html, /extra/);
});

test("dry run renders embed fields and posts nothing", () => {
  const html = C.resultHtml("dry", {
    ok: true,
    embeds: [{
      title: "HorsePicks AI · Flemington R4",
      description: "3 Night Mail · Win",
      color: 0x2eaf62,
      fields: [{ name: "Bookie", value: "TAB" }, { name: "Stake", value: "1u" }],
      footer: { text: "Dry run" },
    }],
  });
  assert.match(html, /Nothing was posted/);
  assert.match(html, /Flemington R4/);
  assert.match(html, /Bookie/);
  assert.match(html, />TAB</);
  assert.match(html, /#2eaf62/);
});

test("the settings tab is owner-gated the same way as the other owner tools", () => {
  assert.match(html, /const connTab=isAdmin\?'<button class="tab" id="stab-connectors">Connectors<\/button>':''/);
  assert.match(html, /tab==="connectors"/);
  assert.match(html, /STATE\.ops===true&&!STATE\.viewAs/);
  assert.match(html, /TBConnectors\.mount\(body,/);
  assert.match(html, /assets\/connectors\.js\?v=/);
  assert.doesNotMatch(html, /id="stab-connectors"[^<]*Connectors<\/button><\/div>/);
});

test("connector source adds no blocked words", () => {
  assert.doesNotMatch(src, /forward|mirror|master|consensus/i);
  assert.doesNotMatch(src, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  assert.doesNotMatch(html, /mirror|forwarding/i);
});
