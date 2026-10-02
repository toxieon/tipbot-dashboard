// node --test tests/   0.42.2: Scheduled Tips recovers from TipBot 503 warming/db_busy;
// Upcoming Bets doesn't give up on /api/upcoming after one network error; AFL tips send game_start.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const T = require("../assets/scheduled-tips.js");

const G = "1547413800012226692";
function api(seq) {
  let i = 0;
  return async () => {
    const [status, json] = seq[Math.min(i++, seq.length - 1)];
    return {status, ok: status >= 200 && status < 300, json: async () => json};
  };
}

test("503 warming shows a friendly message (not 'warming') and retries", async () => {
  const timers = [];
  const ui = T.create({gid: G, api: api([[503, {error: "warming", retry_after: 3}], [200, {ok: true, tips: []}]]),
    later: (fn, ms) => timers.push({fn, ms})});
  await ui.load();
  assert.equal(ui.state().err, T.BUSY_TEXT);
  assert.doesNotMatch(ui.view(), /warming/);
  assert.match(ui.view(), /busy or starting up/);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 3000);
  await timers[0].fn();
  assert.equal(ui.state().err, null);
  assert.deepEqual(ui.state().tips, []);
});

test("db_busy keeps the list already shown and retries a bounded number of times", async () => {
  const timers = [];
  const one = {tip_id: G + ":AFL-2026-036", display_id: "AFL-2026-036", post_at: new Date(Date.now() + 6e5).toISOString(),
    odds: 2, units: 1, legs: []};
  const seq = [[200, {ok: true, tips: [one]}]].concat(Array(20).fill([503, {error: "db_busy"}]));
  const ui = T.create({gid: G, api: api(seq), later: (fn, ms) => timers.push({fn, ms})});
  await ui.load();
  await ui.load();
  assert.equal(ui.state().tips.length, 1);
  assert.match(ui.view(), /AFL-2026-036/);
  assert.match(ui.view(), /busy or starting up/);
  for (let k = 0; k < 10 && timers.length; k++) await timers.shift().fn();
  assert.equal(timers.length, 0);
  assert.match(ui.state().err, /next check/);
});

test("Upcoming Bets: a network error does not switch /api/upcoming off for good", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const fn = html.slice(html.indexOf("async function fetchUpcomingCtx"), html.indexOf("function upcSetUpdating"));
  const caught = fn.slice(fn.indexOf("}catch(e){"), fn.indexOf("// Older TipBot"));
  assert.doesNotMatch(caught, /UPC_API\s*=\s*false/);
  assert.match(fn, /if\(res\.status!==404\) return null;[\s\S]*UPC_API=false;/);  // a real 404 still means older TipBot
});

test("builder sends game_start for AFL fixture games from the fixture's unixtime", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "assets", "builder.js"), "utf8");
  const m = src.match(/function aflGameStartIso\(g\)\{[\s\S]*?\n  \}/);
  assert.ok(m);
  const aflGameStartIso = new Function(m[0] + "; return aflGameStartIso;")();
  assert.equal(aflGameStartIso({unixtime: 1790996700}), "2026-10-03T03:05:00Z");
  assert.equal(aflGameStartIso({unixtime: null}), "");
  assert.equal(aflGameStartIso(null), "");
  assert.match(src, /else if\(!BUILD\.espn && !BUILD\.custom\)\{ const gs=aflGameStartIso\(BUILD\.game\); if\(gs\) out\.game_start=gs; \}/);
  assert.equal((src.match(/else if\((t|tipFields)\.game_start\)\{/g) || []).length, 3);  // batch, queue, single paths
});
