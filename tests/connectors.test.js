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
  assert.equal(p.events, "/api/connectors/id%202/events");
  assert.equal(p.stream, "/api/connectors/id%202/events/stream");
  assert.equal(C.pathsFor("g", "c1", "ev/1").events, "/api/connectors/c1/events?after=ev%2F1");
  assert.equal(C.POLL_MS, 3000);
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
  assert.match(html, /fetchRaw:function/);
  assert.match(html, /assets\/connectors\.js\?v=/);
  assert.doesNotMatch(html, /id="stab-connectors"[^<]*Connectors<\/button><\/div>/);
});

const recv = {
  id: "e1",
  type: "tip_received",
  at: "2026-10-14T18:21:04Z",
  tip: {
    event: "Randwick R4",
    selection: { number: 5, name: "Splendid Win" },
    market: "Win",
    odds: 4.2,
    bookie: "BetDeluxe",
    stake_units: 4.5,
    confidence: { models_agreeing: 3, models_total: 4, rating: "High" },
  },
};

test("a received tip formats as a terminal line in UTC when no Sydney clock is loaded", () => {
  assert.equal(
    C.formatLine(recv),
    "18:21:04 RECV Randwick R4 #5 Splendid Win @4.20 BetDeluxe 4.5u [3/4 HIGH]"
  );
  assert.equal(C.tagOf({ type: "posted", at: "2026-10-14T18:21:05Z", tip: recv.tip }), "POSTED");
  assert.equal(C.tagOf({ type: "status_update", status: "scratched" }), "SCRATCHED");
  assert.equal(C.tagOf({ type: "status_update", status: "void" }), "SCRATCHED");
  assert.equal(C.tagOf({ type: "status_update", status: "won" }), "WON");
  assert.equal(C.tagOf({ type: "status_update", status: "lost" }), "LOST");
  assert.equal(C.tagOf({ type: "status_update", status: "placed" }), "PLACED");
  assert.equal(C.tagOf({ type: "skipped" }), "SKIP");
  assert.equal(C.tagOf({ type: "error", message: "upstream 502" }), "ERR");
  assert.equal(C.tagOf({ type: "poll" }), "POLL");
  assert.equal(C.bucketOf("RECV"), "tips");
  assert.equal(C.bucketOf("POSTED"), "tips");
  assert.equal(C.bucketOf("SKIP"), "tips");
  assert.equal(C.bucketOf("WON"), "results");
  assert.equal(C.bucketOf("LOST"), "results");
  assert.equal(C.bucketOf("SCRATCHED"), "results");
  assert.equal(C.bucketOf("ERR"), "errors");
  assert.equal(C.bucketOf("POLL"), "");
  assert.equal(C.toneOf("RECV"), "ok");
  assert.equal(C.toneOf("SKIP"), "warn");
  assert.equal(C.toneOf("LOST"), "bad");
  assert.equal(C.toneOf("POLL"), "dim");
  assert.equal(C.formatLine({ type: "error", at: "2026-10-14T18:21:10Z", message: "upstream 502" }), "18:21:10 ERR upstream 502");
});

test("the live log parses a stream, dedupes, and filters", () => {
  const parsed = C.parseSse('id: t1\nevent: tip_received\ndata: {"id":"t1","type":"tip_received","at":"2026-10-14T18:21:04Z","tip":{"event":"Randwick R4","selection":{"number":5,"name":"Splendid Win"},"odds":4.2,"bookie":"BetDeluxe","stake_units":4.5,"confidence":{"models_agreeing":3,"models_total":4,"rating":"High"}}}\n\ndata: {"type":"err');
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].id, "t1");
  assert.equal(parsed.events[0].type, "tip_received");
  assert.match(parsed.rest, /err/);
  assert.match(C.formatLine(parsed.events[0]), /RECV Randwick R4 #5 Splendid Win @4\.20/);

  const body = C.eventsFrom({
    ok: true,
    events: [recv, { id: "err1", type: "error", at: "2026-10-14T18:21:10Z", message: "upstream 502" }, { id: "p1", type: "poll", at: "2026-10-14T18:21:00Z", count: 4 }],
  });
  assert.equal(body.length, 3);
  const merged = C.mergeEvents(body, [recv, { id: "n1", type: "posted", at: "2026-10-14T18:21:05Z", tip: recv.tip }]);
  assert.equal(merged.added, 1);
  assert.equal(merged.events.length, 4);

  const prev = [];
  for (let i = 0; i < 400; i++) prev.push({ id: "a" + i, type: "poll", at: "2026-10-14T00:00:00Z" });
  const capped = C.mergeEvents(prev, [{ id: "new", type: "error", message: "x" }]);
  assert.equal(capped.added, 1);
  assert.equal(capped.events.length, 400);
  assert.equal(capped.events[0].id, "a1");
  assert.equal(capped.events[399].id, "new");
  assert.equal(C.mergeEvents(capped.events, [{ id: "new", type: "error", message: "x" }]).added, 0);

  const all = C.boardsHtml([{ id: "c1", tipster_label: "HorsePicks AI" }], { c1: { events: body, filter: "all", follow: true } });
  assert.match(all, /data-tag="RECV"/);
  assert.match(all, /data-tag="ERR"/);
  assert.match(all, /data-tag="POLL"/);
  assert.match(all, /cx-cursor/);
  assert.match(all, />All</);
  assert.match(all, />Tips</);
  assert.match(all, />Results</);
  assert.match(all, />Errors</);
  assert.match(all, /cx-log-jump" hidden/);
  const tips = C.boardsHtml([{ id: "c1" }], { c1: { events: body, filter: "tips", follow: false } });
  assert.match(tips, /data-tag="RECV"/);
  assert.doesNotMatch(tips, /data-tag="ERR"/);
  assert.doesNotMatch(tips, /data-tag="POLL"/);
  assert.match(tips, /cx-log-jump">Latest/);
  const errors = C.boardsHtml([{ id: "c1" }], { c1: { events: body, filter: "errors", follow: true } });
  assert.match(errors, /data-tag="ERR"/);
  assert.doesNotMatch(errors, /data-tag="RECV"/);
  assert.equal(C.boardsHtml([{ id: "" }]), "");
  assert.equal(C.stickToEnd({ scrollHeight: 400, scrollTop: 0, clientHeight: 168 }), false);
  assert.equal(C.stickToEnd({ scrollHeight: 400, scrollTop: 210, clientHeight: 168 }), true);
});

test("connector source adds no blocked words", () => {
  assert.doesNotMatch(src, /forward|mirror|master|consensus/i);
  assert.doesNotMatch(src, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  assert.match(src, /prefers-reduced-motion:reduce/);
  assert.match(src, /events\/stream/);
  assert.doesNotMatch(html, /mirror|forwarding/i);
});
