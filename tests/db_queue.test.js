// node --test tests/   0.43.4: cap concurrent DB calls, jitter 503 retries,
// offset the scheduled-tips and live-tips polls, and don't call a 503 a
// failure while a retry is still waiting.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const RP = require("../assets/req-pool.js");
const Sched = require("../assets/scheduled-tips.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const schedSrc = fs.readFileSync(path.join(__dirname, "..", "assets", "scheduled-tips.js"), "utf8");
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

test("DB calls stay at 2 in flight; fixtures, upcoming, master config and odds do not wait", async () => {
  const q = RP.createApiQueue(2);
  let active = 0, peak = 0;
  const jobs = [];
  for (let i = 0; i < 6; i++) {
    jobs.push(q("/api/server?guild_id=" + i, async () => {
      active++;
      peak = Math.max(peak, active);
      await tick(30);
      active--;
    }));
  }
  await Promise.all(jobs);
  assert.equal(peak, 2);
  assert.equal(q.gate.active(), 0);

  const blocked = RP.createApiQueue(1);
  let release;
  const held = blocked("/api/server", () => new Promise((res) => { release = res; }));
  await tick(10);
  assert.equal(blocked.gate.active(), 1);
  const fx = blocked("/api/fixtures?rosters=0", async () => "fixtures");
  const up = blocked("/api/upcoming?guild_id=1", async () => "upcoming");
  const cfg = blocked("/api/master/config", async () => "config");
  const odds = blocked("/api/odds/for-tips?guild_id=1", async () => "odds");
  assert.deepEqual(await Promise.all([fx, up, cfg, odds]), ["fixtures", "upcoming", "config", "odds"]);
  assert.equal(blocked.gate.active(), 1, "exempt routes did not take a DB slot");
  release("ok");
  assert.equal(await held, "ok");
  await tick(0);
  assert.equal(blocked.gate.active(), 0);
});

test("a rejected DB call frees its slot", async () => {
  const q = RP.createApiQueue(1);
  await assert.rejects(q("/api/server", async () => { throw new Error("boom"); }));
  assert.equal(q.gate.active(), 0);
  assert.equal(await q("/api/server", async () => 7), 7);
});

test("exempt paths are the cached ones, and the page wires a 2-wide queue", () => {
  for (const p of ["/api/fixtures", "/api/fixtures?rosters=0", "/api/fixtures/roster?game=1",
      "/api/upcoming?guild_id=1", "/api/master/config", "/api/odds/quota", "/api/odds/markets"]) {
    assert.equal(RP.dbSlotExempt(p), true, p);
  }
  for (const p of ["/api/server?guild_id=1", "/api/live-tips?guild_id=1", "/api/scheduled-tips?guild_id=1",
      "/api/feature-flags?guild_id=1", "/api/auto-push?guild_id=1", "/api/finished-games?guild_id=1",
      "/api/channels?guild_id=1", "/api/mod-settings?guild_id=1", "/api/tipster-form?guild_id=1"]) {
    assert.equal(RP.dbSlotExempt(p), false, p);
  }
  assert.match(html, /createApiQueue\(2\)/);
  assert.match(html, /API_QUEUE\(path, runFetch\)/);
  assert.match(html, /retryWaitMs\(\{status:r\.status, body:body, attempt:attempt\}\)/);
});

test("a 503 waits retry_after plus a random 0–1s", () => {
  const body = {error: "db_busy", retry_after: 2};
  assert.equal(RP.retryWaitMs({status: 503, body, attempt: 1, rand: 0}), 2000);
  assert.equal(RP.retryWaitMs({status: 503, body, attempt: 1, rand: 0.4}), 2400);
  assert.equal(RP.retryWaitMs({status: 503, body, attempt: 1, rand: 1}), 3000);
  const warming = RP.retryWaitMs({status: 503, body: {error: "warming", retry_after: 3}, attempt: 1, rand: 0.25});
  assert.equal(warming, 3250);
  // No retry_after: the old backoff, then jitter only on 503.
  assert.equal(RP.retryWaitMs({status: 503, body: {error: "db_busy"}, attempt: 1, rand: 0}), 1500);
  assert.equal(RP.retryWaitMs({status: 503, body: {error: "db_busy"}, attempt: 2, rand: 1}), 4000);
  // A 502 keeps the plain backoff (no jitter).
  assert.equal(RP.retryWaitMs({status: 502, body: {}, attempt: 1, rand: 1}), 1500);
});

test("Couldn't reach the bot is withheld while a retry is still pending", () => {
  assert.equal(RP.unreachableText({status: 503, attempt: 1, maxAttempts: 3, phase: "retry", body: {error: "db_busy"}}), "");
  assert.equal(RP.unreachableText({network: true, attempt: 2, maxAttempts: 3, phase: "retry"}), "");
  assert.equal(RP.retriesStillPending({attempt: 1, maxAttempts: 3}), true);
  assert.equal(RP.unreachableText({status: 503, attempt: 3, maxAttempts: 3}), "Couldn't reach the bot");
  assert.equal(RP.unreachableText({network: true, attempt: 3, maxAttempts: 3}), "Couldn't reach the bot");
  assert.equal(RP.unreachableText({status: 404, attempt: 3, maxAttempts: 3}), "");

  const loadDetail = html.slice(html.indexOf("async function loadDetail"), html.indexOf("function loadPropCounts"));
  const at = loadDetail.indexOf("onAttempt:");
  const onAttempt = loadDetail.slice(at, loadDetail.indexOf("paintWaking", at));
  assert.match(onAttempt, /reachErrorLine/);
  assert.match(onAttempt, /phase:"retry"/);
  assert.doesNotMatch(onAttempt, /innerHTML/);
  assert.match(loadDetail, /reachErrorLine\(r\.status, \{attempt:3, maxAttempts:3\}\)/);
  const boot = html.slice(html.indexOf("async function load("), html.indexOf("function saveThemePrefs"));
  assert.match(boot, /reachErrorLine\(r\.status, \{attempt:3, maxAttempts:3\}\)/);
});

test("scheduled-tips 503 retry adds jitter and does not say the bot was unreachable", async () => {
  const timers = [];
  const ui = Sched.create({
    gid: "1",
    jitter: () => 400,
    api: async () => ({status: 503, ok: false, json: async () => ({error: "db_busy", retry_after: 2})}),
    later: (fn, ms) => timers.push({fn, ms}),
  });
  await ui.load();
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 2400);
  assert.match(ui.view(), /busy or starting up/);
  assert.doesNotMatch(ui.view(), /reach the bot/);
});

test("scheduled-tips and live-tips polls never fire in the same second", () => {
  const s = RP.POLLS.scheduled, l = RP.POLLS.liveTips;
  assert.equal(s.period, 30000);
  assert.equal(s.offset, 0);
  assert.equal(l.period, 90000);
  assert.equal(l.offset, 15000);
  assert.match(html, /POLLS\.liveTips/);
  assert.match(html, /liveTipsStopPoll\(\)/);
  assert.match(html, /document\.hidden\)\{\s*pauseBwPolls\(\);\s*liveTipsStopPoll\(\)/);
  assert.match(schedSrc, /POLLS\.scheduled/);
  assert.match(schedSrc, /visibilitychange/);
  assert.match(schedSrc, /clearTimeout\(timer\)/);
  assert.match(html, /function pollAfter\(fn, base\)/);

  for (let now = 0; now <= 10 * 60 * 1000; now += 250) {
    for (const sj of [0, 1]) {
      for (const lj of [0, 1]) {
        const a = now + RP.pollDelay(now, s.period, s.offset, sj);
        const b = now + RP.pollDelay(now, l.period, l.offset, lj);
        assert.notEqual(Math.floor(a / 1000), Math.floor(b / 1000), "same second at " + now);
        assert.ok(Math.abs(a - b) >= 14000, "too close at " + now + " a=" + a + " b=" + b);
      }
    }
  }
  // Jitter does not accumulate: each fire stays on its grid.
  let t = 0;
  for (let i = 0; i < 30; i++) {
    t += RP.pollDelay(t, s.period, s.offset, 1);
    assert.equal(t % s.period, 1000);
  }
  t = 0;
  for (let i = 0; i < 12; i++) {
    t += RP.pollDelay(t, l.period, l.offset, 0);
    assert.equal(t % l.period, l.offset);
  }
});
