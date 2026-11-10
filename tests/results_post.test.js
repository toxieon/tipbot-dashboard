// Server page: owners and admins can open a Results post panel beside the bets-list button.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const src = fs.readFileSync(path.join(root, "assets/results-post.js"), "utf8");
const banned = /ops:|\bforward\b|\bconnector\b|mirror|master|consensus|OWNER_DISCORD|\/api\/ops|follow-stake/i;
const TB = require(path.join(root, "assets/results-post.js"));

const sample = {
  ok: true,
  from: "2026-11-09",
  to: "2026-11-09",
  default_day: "2026-11-09",
  tz: "Australia/Sydney",
  server_name: "Example Server",
  pages: 1,
  text: "1U Example Runner W ❌\n\nTotal: -1.0U",
  rows: [{ tip_id: "1", display_id: "1", stake: "1U", text: "Example Runner W", result: "Loss", logo_team: "EX" }],
  counts: { listed: 1, void_push: 1, pending: 0, late_excluded: 0, over_cap: 0 },
  channels: [{ id: "900", name: "results" }, { id: "901", name: "tips" }]
};

test("the Results post script is loaded and the button is admin-only beside the bets list", () => {
  assert.match(html, /<script src="\.\/assets\/results-post\.js\?v=__TD_VERSION__"><\/script>/);
  assert.match(html, /\(s\.can_admin&&!STATE\.viewAs\)\?'<button type="button" class="ghost" id="betslistbtn"/);
  assert.match(html, /id="resultspostbtn"/);
  assert.match(html, /id="betslistbtn"[\s\S]{0,400}?id="resultspostbtn"/);
  const line = html.split("\n").find((l) => l.includes('id="resultspostbtn"'));
  assert.ok(line);
  assert.match(line, /s\.can_admin&&!STATE\.viewAs/);
  assert.match(html, /id="results-post-box"/);
  assert.match(html, /\{ const rp=\$\("resultspostbtn"\); if\(rp\) rp\.onclick=\(\)=>toggleResultsPost\(rp\); \}/);
  assert.match(html, /function toggleResultsPost\(btn\)/);
  assert.match(html, /TBResultsPost\.mount\(box,\{api:api,gid:btn\.getAttribute\("data-gid"\),onUnauth:/);
  assert.doesNotMatch(html, /paintFeatures\([\s\S]{0,200}TBResultsPost/);
});

test("the module and the new asset stay free of private scan terms", () => {
  assert.doesNotMatch(src, banned);
  assert.equal(typeof TB.mount, "function");
  assert.equal(typeof TB.shellHtml, "function");
  assert.equal(typeof TB.sendPayload, "function");
});

test("query, image and send helpers match the bot routes", () => {
  const ui = { from: "2026-11-09", to: "2026-11-09", include_void: true, page: 2, header: false, channel_id: "900", include_text: true };
  assert.equal(TB.contextPath("42", ui), "/api/results-post?guild_id=42&from=2026-11-09&to=2026-11-09&include_void=1");
  assert.equal(TB.imagePath("42", ui), "/api/results-post/image?guild_id=42&from=2026-11-09&to=2026-11-09&include_void=1&page=2&header=0");
  assert.deepEqual(TB.sendPayload("42", ui), {
    guild_id: "42",
    from: "2026-11-09",
    to: "2026-11-09",
    channel_id: "900",
    include_text: true,
    include_void: true
  });
  assert.equal(TB.pickChannel(sample.channels), "900");
  assert.equal(TB.countsNote(sample.counts), "1 bet · 1 void/push hidden");
});

test("the painted panel has dates, copy text, channel picker and a post button", () => {
  const out = TB.shellHtml(sample, { from: "2026-11-09", to: "2026-11-09", channel_id: "900", header: true });
  assert.match(out, /data-rp/);
  assert.match(out, /data-rp-from value="2026-11-09"/);
  assert.match(out, /data-rp-to value="2026-11-09"/);
  assert.match(out, /Include void \/ push/);
  assert.match(out, /1 bet · 1 void\/push hidden/);
  assert.match(out, /data-rp-text/);
  assert.match(out, /1U Example Runner W ❌/);
  assert.match(out, /data-rp-copy/);
  assert.match(out, /data-rp-channel/);
  assert.match(out, /#results/);
  assert.match(out, /data-rp-send/);
  assert.doesNotMatch(out, /data-rp-send disabled/);
});

test("mount with fixture data paints into the box and stop clears timers", () => {
  const calls = [];
  const box = {
    ownerDocument: null,
    isConnected: true,
    innerHTML: "",
    querySelector() { return null; }
  };
  const stop = TB.mount(box, {
    api: async (path) => { calls.push(path); return { status: 200, ok: true, json: async () => sample, blob: async () => new Blob() }; },
    gid: "42",
    data: sample,
    ui: { channel_id: "900" }
  });
  assert.match(box.innerHTML, /data-rp/);
  assert.match(box.innerHTML, /Results post/);
  assert.equal(calls.length, 0);
  assert.equal(typeof stop, "function");
  stop();
});

test("a 401 from the loader calls onUnauth and does not throw", async () => {
  let unauth = 0;
  const box = { ownerDocument: null, isConnected: true, innerHTML: "", querySelector() { return null; } };
  TB.mount(box, {
    api: async () => { throw { unauth: true }; },
    gid: "42",
    onUnauth() { unauth += 1; }
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(unauth, 1);
});
