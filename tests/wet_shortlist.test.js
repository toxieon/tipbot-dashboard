"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const ws = require("../assets/wet-shortlist.js");
const hr = require("../assets/horse-results.js");
const build = fs.readFileSync(path.join(__dirname, "..", "scripts/build-public.mjs"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const src = fs.readFileSync(path.join(__dirname, "..", "assets/wet-shortlist.js"), "utf8");
const hrSrc = fs.readFileSync(path.join(__dirname, "..", "assets/horse-results.js"), "utf8");

const W = (starts, wins, places) => ({ starts, wins, places });
const ent = (name, won, extra) => Object.assign({ id: name, name, number: 3, price: 4.5, wet: W(2, 1, 2), stays: false, won }, extra || {});
const body = {
  ok: true, run: 1, upcoming: 1, rule: "Rule text <b>",
  tally: {
    with_price: { bets: 1, wins: 1, losses: 0, units: 3.5 },
    without_price: { bets: 1, wins: 0, losses: 1, units: -1 },
    agree: { bets: 0, wins: 0, losses: 0, units: 0 },
  },
  races: [
    { id: "r1", track: "Doomben", race_number: 3, start: "2026-11-28T02:53:00Z", distance: 2000, track_condition: "Soft5", status: "run",
      winner: { name: "Savisanta", number: 1, price: 3.6 },
      columns: { with_price: [ent("Savisanta", true, { stays: true }), ent("La Rosetta", false)], without_price: [ent("La Rosetta", false)], agree: [] } },
    { id: "r2", track: "Wagga", race_number: 1, start: "2026-11-28T06:00:00Z", distance: 1200, track_condition: "Heavy10", status: "upcoming", winner: null,
      columns: { with_price: [ent("Mudlark", null)], without_price: [], agree: [] }, note: "no model log" },
  ],
};

test("wet shortlist is a private asset on the owner route and stays out of the public build", () => {
  assert.match(build, /"assets\/wet-shortlist\.js"/);
  assert.match(src, /\/api\/owner\/horse\/wet-shortlist/);
  assert.match(src, /TD\.loaded\["wet-shortlist"\]/);
  assert.doesNotMatch(hrSrc, /\/api\/owner/);
  assert.match(index, /TD\.load\("wet-shortlist"\)/);
});

test("renders three columns per race with a tick, a cross or a dot", () => {
  const html = ws.render(body);
  assert.strictEqual((html.match(/class="ws-race"/g) || []).length, 2);
  for (const c of ["with_price", "without_price", "agree"]) assert.match(html, new RegExp('data-col="' + c + '"'));
  assert.match(html, /\u2705/);
  assert.match(html, /\u274C/);
  assert.match(html, /ws-mk[^>]*>\u2022</);
  assert.match(html, /Won: 1 Savisanta \$3\.6/);
  assert.match(html, /Upcoming/);
  assert.match(html, /no model log/);
});

test("tally shows W-L and signed units per column", () => {
  const html = ws.tallyHtml(body.tally);
  assert.match(html, /data-tally="with_price"[\s\S]*?1-0[\s\S]*?\+3\.5u/);
  assert.match(html, /data-tally="without_price"[\s\S]*?0-1[\s\S]*?-1\.0u/);
});

test("text from the API is escaped", () => {
  const evil = JSON.parse(JSON.stringify(body));
  evil.races[0].columns.with_price[0].name = '<img src=x onerror=alert(1)>';
  evil.rule = "<script>x</script>";
  const html = ws.render(evil);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>x/);
});

test("empty day and missing body render a message, not an error", () => {
  assert.match(ws.render({ races: [], run: 0, upcoming: 0, tally: {} }), /No Australian races found/);
  assert.match(ws.render(null), /Nothing to show/);
});

test("Horses page shows the checkbox only when an extra view is passed", () => {
  const plain = hr.render({ view: "ready", all: [], q: "" });
  assert.doesNotMatch(plain, /hr-extra-cb/);
  const extra = { label: "Wet track shortlist", mount() {} };
  const on = hr.render({ view: "ready", all: [], q: "", extra, extraOn: false });
  assert.match(on, /id="hr-extra-cb"/);
  assert.match(on, /Wet track shortlist/);
  assert.doesNotMatch(on, /id="hr-extra-cb" checked/);
  const ticked = hr.render({ view: "ready", all: [], q: "", extra, extraOn: true });
  assert.match(ticked, /id="hr-extra-cb" checked/);
  assert.match(ticked, /hr-extra-on/);
});

test("the Horses page only offers it to the signed-in owner", () => {
  assert.match(index, /extra: ownerSettingsAllowed\(\) \? \{\s*label: "Wet track shortlist"/);
});

test("mount fetches the endpoint once, renders, and a 401 calls onUnauth", async () => {
  const calls = [];
  const box = { innerHTML: "", hidden: false, isConnected: true };
  const app = { innerHTML: "", querySelector() { return null; } };
  box.querySelector = (sel) => (sel === "#ws-app" ? app : null);
  const ok = async (p) => { calls.push(p); return { status: 200, ok: true, json: async () => body }; };
  await ws.mount(box, { call: ok, intervalMs: 1e9 });
  assert.deepStrictEqual(calls, ["/api/owner/horse/wet-shortlist"]);
  assert.match(app.innerHTML, /ws-race/);
  let unauth = 0;
  await ws.mount(box, { call: async () => ({ status: 401, ok: false, json: async () => ({}) }), onUnauth: () => { unauth++; }, intervalMs: 1e9 });
  assert.strictEqual(unauth, 1);
  ws.stop();
});
