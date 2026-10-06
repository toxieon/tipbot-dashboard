// node --test tests/   Server page → Scheduled Tips (0.41.1): list, cancel, adjust odds, edit (mocked TipBot).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const T = require("../assets/scheduled-tips.js");

const G = "1547413800012226692";
const tip = (over) => Object.assign({tip_id: G + ":AFL-2026-040", display_id: "AFL-2026-040", game_name: "Carlton v Hawthorn",
  odds: 1.9, units: 1, bookmaker: "Sportsbet", post_at: new Date(Date.now() + 10 * 60000).toISOString(), has_image: true,
  forward: {status: "posted", sent: true}, legs: [{position: 1, description: "Bontempelli 30+ disposals"}, {position: 2, description: "Carlton H2H"}]}, over || {});

function fakeApi(routes) {
  const calls = [];
  const api = async (p, opts) => {
    const body = opts && opts.body ? JSON.parse(opts.body) : null;
    calls.push({path: p, method: (opts && opts.method) || "GET", body});
    const [status, json] = routes(p, body, calls);
    return {status, ok: status >= 200 && status < 300, json: async () => json};
  };
  return {api, calls};
}

test("editBody sends only what changed and validates", () => {
  const t = tip();
  assert.deepEqual(T.editBody(t, {guild_id: G, odds: "2.10"}), {guild_id: G, tip_id: t.tip_id, action: "edit", odds: 2.1});
  assert.deepEqual(T.editBody(t, {guild_id: G, odds: "1.90", units: "2", bookmaker: "TAB", legs: {1: " Bontempelli  35+ disposals ", 2: "Carlton H2H"}}),
    {guild_id: G, tip_id: t.tip_id, action: "edit", units: 2, bookmaker: "TAB", legs: [{position: 1, description: "Bontempelli 35+ disposals"}]});
  assert.throws(() => T.editBody(t, {odds: "1"}), /above 1\.00/);
  assert.throws(() => T.editBody(t, {units: "0"}), /Stake/);
  assert.throws(() => T.editBody(t, {legs: {1: "  "}}), /can’t be empty/);
  assert.throws(() => T.editBody(t, {odds: "1.9"}), /Nothing changed/);
});

test("relative post time", () => {
  const now = Date.parse("2026-09-30T12:00:00Z");
  assert.equal(T.rel("2026-09-30T12:10:00Z", now), "in 10 min");
  assert.equal(T.rel("2026-09-30T13:30:00Z", now), "in 1 h 30 min");
  assert.equal(T.rel("2026-09-30T12:00:10Z", now), "any moment");
});

test("list shows each scheduled tip with when it posts, image and forward badges", async () => {
  const {api, calls} = fakeApi((p) => [200, {ok: true, tips: [tip(), tip({tip_id: "x", display_id: "AFL-2026-041", releasing: true, has_image: false, forward: null})]}]);
  const ui = T.create({api, gid: G, when: () => "Wed 30 Sep 10:30 pm"});
  await ui.load();
  assert.equal(calls[0].path, "/api/scheduled-tips?guild_id=" + G);
  const html = ui.view();
  assert.match(html, /AFL-2026-040/);
  assert.match(html, /Posts <b>Wed 30 Sep 10:30 pm<\/b> <span[^>]*>\(in (9|10) min\)/);
  assert.match(html, /📷 image/);
  assert.match(html, /↗ forwarded/);
  assert.match(html, /Adjust odds/);
  assert.match(html, /Cancel tip/);
  assert.match(html, /Posting now…/);                                  // the one being released: buttons disabled
  assert.match(html, /data-tip="x" disabled>Adjust odds/);
});

test("empty and missing-endpoint states", async () => {
  let ui = T.create({api: fakeApi(() => [200, {ok: true, tips: []}]).api, gid: G});
  await ui.load();
  assert.match(ui.view(), /No scheduled tips/);
  ui = T.create({api: fakeApi(() => [404, {}]).api, gid: G});
  await ui.load();
  assert.match(ui.view(), /latest deploy/);
});

test("adjust odds posts an edit, then reloads the list", async () => {
  let listed = 0;
  const {api, calls} = fakeApi((p, body) => p.startsWith("/api/scheduled-tips") ? [200, {ok: true, tips: [tip(listed++ ? {odds: 2.4} : {})]}]
    : [200, {ok: true, message: "Updated.", tip: {}}]);
  const ui = T.create({api, gid: G});
  await ui.load();
  ui.openForm(tip().tip_id, "odds");
  assert.match(ui.view(), /Save odds/);
  await ui.save(tip().tip_id, {odds: "2.40"});
  const post = calls.find((c) => c.method === "POST");
  assert.deepEqual(post, {path: "/api/scheduled-tip", method: "POST", body: {guild_id: G, tip_id: tip().tip_id, action: "edit", odds: 2.4}});
  assert.match(ui.view(), /2\.40/);
  assert.match(ui.view(), /master copy updates too/);
  assert.doesNotMatch(ui.view(), /Save odds/);                           // form closed
});

test("edit legs + stake, and cancel", async () => {
  let gone = false;
  const {api, calls} = fakeApi((p, body) => {
    if (p.startsWith("/api/scheduled-tips")) return [200, {ok: true, tips: gone ? [] : [tip()]}];
    if (body.action === "cancel") gone = true;
    return [200, {ok: true}];
  });
  const ui = T.create({api, gid: G});
  await ui.load();
  ui.openForm(tip().tip_id, "edit");
  assert.match(ui.view(), /<textarea class="sched-in-leg" data-pos="2"/);
  await ui.save(tip().tip_id, {odds: "1.90", units: "1.5", bookmaker: "Sportsbet", legs: {1: "Bontempelli 30+ disposals", 2: "Hawthorn H2H"}});
  assert.deepEqual(calls.filter((c) => c.method === "POST")[0].body,
    {guild_id: G, tip_id: tip().tip_id, action: "edit", units: 1.5, legs: [{position: 2, description: "Hawthorn H2H"}]});
  await ui.cancel(tip().tip_id);
  assert.deepEqual(calls.filter((c) => c.method === "POST")[1].body, {guild_id: G, tip_id: tip().tip_id, action: "cancel"});
  assert.match(ui.view(), /Cancelled\. It won’t post, and the master copy is removed\./);
  assert.match(ui.view(), /No scheduled tips/);
});

test("an edit after the tip posted shows TipBot's clear error and refreshes", async () => {
  let listed = 0;
  const {api} = fakeApi((p) => p.startsWith("/api/scheduled-tips") ? [200, {ok: true, tips: listed++ ? [] : [tip()]}]
    : [409, {ok: false, code: "posted", message: "This tip has already posted, so it can't be changed here. Edit or delete it from the tip card."}]);
  const ui = T.create({api, gid: G});
  await ui.load();
  const r = await ui.save(tip().tip_id, {odds: "3"});
  assert.equal(r._status, 409);
  assert.equal(ui.state().tips.length, 0);                              // list refreshed: it's gone from Scheduled
  assert.equal(ui.state().msg.text, "This tip has already posted, so it can't be changed here. Edit or delete it from the tip card.");
  assert.match(ui.view(), /already posted, so it can&#39;t be changed here/);   // still shown although the tip left the list
});

test("bad input never calls TipBot; 401 goes to login", async () => {
  const {api, calls} = fakeApi(() => [200, {ok: true, tips: [tip()]}]);
  const ui = T.create({api, gid: G});
  await ui.load();
  await ui.save(tip().tip_id, {odds: "0.5"});
  assert.equal(calls.filter((c) => c.method === "POST").length, 0);
  assert.match(ui.view(), /above 1\.00/);
  let loggedOut = 0;
  const ui2 = T.create({api: async () => { const e = new Error("unauth"); e.unauth = true; throw e; }, gid: G, onUnauth: () => loggedOut++});
  await ui2.load();
  assert.equal(loggedOut, 1);
});

test("server page loads the Scheduled Tips section", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const version = fs.readFileSync(path.join(__dirname, "..", "VERSION"), "utf8").trim();
  assert.match(html, new RegExp("<script src=\"\\./assets/scheduled-tips\\.js\\?v=" + version.replace(/\./g, "\\.") + "\"></script>"));
  assert.match(html, /id="scheduled-panel" data-sec="scheduled" data-sec-open="1"><h3>Scheduled Tips<\/h3>/);
  assert.match(html, /TBScheduled\.mount\(box,\{api:api,gid:String\(gid\)/);
});
