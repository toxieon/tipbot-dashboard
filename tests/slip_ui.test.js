// node --test tests/   Master → Overview → Slip import card (Phase 1.3).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const U = require("../assets/slip-ui.js");

const STATUS = {ok: true, _status: 200, enabled: false, key_present: false, model: null, drafts_today: 0, spend_today_usd: 0,
  spend_month_usd: 0, slips_channel_id: null, target_guild_id: "2",
  channels: [{id: "11", name: "slips", category: "Control"}], targets: [{guild_id: "2", name: "Tip2", unit_size: 10}]};

test("missing endpoint shows the deploy message with Retry", async () => {
  const ui = U.create({call: async () => ({_status: 404}), paint: () => {}});
  await ui.load();
  assert.match(ui.view(), /This needs TipBot’s latest deploy\./);
  assert.match(ui.view(), /id="slip-retry"/);
});

test("card shows the switch, pickers and status (off by default, key missing)", async () => {
  const ui = U.create({call: async () => STATUS, paint: () => {}});
  await ui.load();
  const html = ui.view();
  assert.match(html, /id="slip-on"(?![^>]*checked)/);
  assert.match(html, /Needs SLIP_VISION_API_KEY/);
  assert.match(html, /<option value="11">#slips \(Control\)<\/option>/);
  assert.match(html, /<option value="2" selected>Tip2 · unit \$10<\/option>/);
  assert.match(html, /drafts today/);
});

test("the switch and pickers save through the settings endpoint", async () => {
  const calls = [];
  const ui = U.create({call: async (p, b) => { calls.push([p, b]); return Object.assign({}, STATUS, b && "enabled" in b ? {enabled: b.enabled} : {}); },
    paint: () => {}});
  await ui.load();
  const els = {"slip-on": {checked: true}, "slip-chan": {value: "11"}, "slip-target": {value: "2"}};
  global.document = {getElementById: (id) => els[id] || null};
  try {
    ui.bind();
    await els["slip-on"].onchange();
    await els["slip-chan"].onchange();
  } finally { delete global.document; }
  assert.deepEqual(calls.slice(1), [["/api/owner/slip-import/settings", {enabled: true}],
                                    ["/api/owner/slip-import/settings", {slips_channel_id: "11"}]]);
  assert.equal(ui.state().msg.text, "#slips channel saved.");
  assert.equal(U.money(0.004), "<US$0.01");
  assert.equal(U.money(1.234), "US$1.23");
});

test("master page includes the card", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "master", "index.html"), "utf8");
  assert.match(html, /<script src="\.\.\/assets\/slip-ui\.js"><\/script>/);
  assert.match(html, /\+slip\.view\(\);/);
});
