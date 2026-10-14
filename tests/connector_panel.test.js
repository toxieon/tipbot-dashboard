// node --test tests/   Generic connector stats, alerts, and the JSON field map.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets", "connector-panel.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const panel = require(path.join(root, "assets", "connector-panel.js"));

test("the generic panel is loaded only from the gated settings tab", () => {
  assert.doesNotMatch(html, /<script[^>]+connector-panel\.js/);
  assert.equal(fs.existsSync(path.join(root, "assets", "connectors.js")), false);
  const start = html.indexOf('if(tab==="connectors")');
  const end = html.indexOf("body.innerHTML='<div style=\"display:flex;align-items:center;gap:10px", start);
  const block = html.slice(start, end);
  assert.ok(start > 0 && end > start, "connectors tab block");
  const gate = block.indexOf("STATE.ops===true&&!STATE.viewAs");
  const ret = block.indexOf("return;");
  const load = block.indexOf("loadConnectorPanel()");
  assert.ok(gate >= 0 && ret > gate && load > ret, "non-owners return before the panel loads");
  assert.match(block, /ensureExt\(\)\.then\(function\(\)\{/);
  assert.match(block, /data-cx-client/);
  assert.match(block, /data-cx-extra/);
});

test("the public panel does not name a feed vendor", () => {
  assert.doesNotMatch(src, /horse/i);
  assert.doesNotMatch(src, /workers\.dev/i);
  assert.doesNotMatch(src, /mirror|forward|master|consensus/i);
  assert.doesNotMatch(src, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
});

test("stats url carries the period", () => {
  assert.equal(panel.statsPath("12", "abc", "week"), "/api/connectors/abc/stats?guild_id=12&period=week");
  assert.equal(panel.statsPath("12", "a b", "all"), "/api/connectors/a%20b/stats?guild_id=12&period=all");
  assert.deepEqual(panel.PERIODS.map((p) => p.id), ["day", "week", "month", "all"]);
});

test("stats cover the record, rates, confidence, mismatches, and best and worst", () => {
  const model = panel.normalizeStats({
    ok: true,
    period: "day",
    wins: 4,
    losses: 2,
    voids: 1,
    strike_rate: 0.667,
    profit_units: 3.5,
    roi: 0.25,
    average_odds: 2.4,
    confidence: [
      { label: "High", wins: 3, losses: 0, voids: 0, strike_rate: 1, profit_units: 4.2 },
    ],
    mismatches: 2,
    mismatch_items: [{ summary: "Sample R2", client: "won", ours: "lost" }],
    best: { summary: "Sample R1", odds: 4.5, profit_units: 3.5, result: "won" },
    worst: { summary: "Sample R3", odds: 1.6, profit_units: -1, result: "lost" },
  });
  assert.equal(model.wins, 4);
  assert.equal(model.losses, 2);
  assert.equal(model.voids, 1);
  assert.equal(panel.pct(model.strike_rate), "66.7%");
  assert.equal(panel.pct(1), "100%");
  assert.equal(panel.pct(70.6), "70.6%");
  assert.equal(panel.unitsText(3.5), "+3.5u");
  assert.equal(panel.unitsText(-1), "-1u");
  const body = panel.statsBodyHtml(model);
  assert.match(body, /4 W · 2 L · 1 void/);
  assert.match(body, /66\.7%/);
  assert.match(body, /\+3\.5u/);
  assert.match(body, /25%/);
  assert.match(body, /2\.40/);
  assert.match(body, /High/);
  assert.match(body, /3 W · 0 L · 0 voids/);
  assert.match(body, /Mismatches/);
  assert.match(body, />2</);
  assert.match(body, /client won/);
  assert.match(body, /ours lost/);
  assert.match(body, /Best/);
  assert.match(body, /Sample R1/);
  assert.match(body, /Worst/);
  assert.match(body, /Sample R3/);
  assert.match(body, /-1u/);
});

test("a missing strike rate is wins over wins plus losses", () => {
  const model = panel.normalizeStats({ wins: 3, losses: 1, voids: 2, profit_units: 1, staked_units: 4 });
  assert.equal(panel.pct(model.strike_rate), "75%");
  assert.equal(panel.pct(model.roi), "25%");
  assert.equal(model.voids, 2);
});

test("alert settings are their own fields and do not toggle the feed", () => {
  const from = panel.alertsFrom({ alerts_enabled: true, alert_failure_threshold: 5, alert_quiet_minutes: 15 });
  assert.deepEqual(from, { enabled: true, failure_threshold: 5, quiet_minutes: 15 });
  const nested = panel.alertsFrom({ alerts: { enabled: false, failure_threshold: 2, quiet_window_seconds: 120 } });
  assert.deepEqual(nested, { enabled: false, failure_threshold: 2, quiet_minutes: 2 });
  const body = panel.alertPayload({ enabled: true, failure_threshold: 5, quiet_minutes: 15 }, "9");
  assert.deepEqual(body, {
    guild_id: "9",
    alerts_enabled: true,
    alert_failure_threshold: 5,
    alert_quiet_minutes: 15,
  });
  assert.equal(Object.prototype.hasOwnProperty.call(body, "enabled"), false);
});

test("a JSON feed sends the endpoint, auth, cursor, and field map", () => {
  const form = {
    endpoint_url: "https://feeds.example.com/tips",
    auth_style: "query",
    api_key: "secret-key",
    cursor_param: "since",
    field_map: { tips: "$.items", external_id: "$.id", event: "$.race.name" },
    channel_id: "42",
    tipster_name: "JSON feed",
    poll_interval_seconds: 60,
    post_mode: "alongside",
    skip_past_events: true,
  };
  assert.deepEqual(panel.validateJson(form), []);
  const body = panel.jsonPayload(form, "9");
  assert.equal(body.type, "json");
  assert.equal(body.endpoint_url, "https://feeds.example.com/tips");
  assert.equal(body.auth_style, "query");
  assert.equal(body.api_key, "secret-key");
  assert.equal(body.cursor_param, "since");
  assert.equal(body.field_map.event, "$.race.name");
  assert.equal(body.field_map.tips, "$.items");
  assert.equal(body.field_map.odds, "");
  assert.equal(body.post_mode, "alongside");
  assert.equal(Object.prototype.hasOwnProperty.call(body, "enabled"), false);
  const update = panel.jsonPayload(Object.assign({ id: "c1" }, form, { api_key: "" }), "9");
  assert.equal(update.id, "c1");
  assert.equal(Object.prototype.hasOwnProperty.call(update, "api_key"), false);
  const dry = panel.dryPayload(form, "9");
  assert.equal(dry.field_map.event, "$.race.name");
  assert.equal(dry.auth_style, "query");
  assert.equal(dry.api_key, "secret-key");
  assert.equal(Object.prototype.hasOwnProperty.call(dry, "poll_interval_seconds"), false);
  assert.deepEqual(panel.validateJson(Object.assign({}, form, { endpoint_url: "http://insecure.example/tips" })), ["Endpoint must be an https URL."]);
  assert.ok(panel.validateJson(Object.assign({}, form, { api_key: "", id: "" })).some((p) => /key/i.test(p)));
  assert.equal(panel.isJsonType("json"), true);
  assert.equal(panel.isJsonType("generic_json"), true);
  assert.equal(panel.isJsonType("feed"), false);
});

test("dry run copy says nothing was posted", () => {
  const html = panel.previewHtml({
    ok: true,
    count: 1,
    posted: 0,
    preview: [{ game: "Sample R1", selection: { number: 4, name: "Runner" }, bet_type: "Win", odds: 3.4 }],
  });
  assert.match(html, /Nothing was posted/);
  assert.match(html, /Sample R1 · #4 Runner · Win · @3\.40/);
});
