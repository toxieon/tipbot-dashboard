// node --test tests/   Stats loads settled tips via /api/server/settled-summary when available.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const S = require("../assets/stats.js");

test("detailFromSettledSummary maps TipBot payloads into tips.settled", () => {
  const tip = { tip_id: "a", result: "Win", profit_units: 1 };
  assert.deepEqual(S.detailFromSettledSummary({ ok: true, tips: { settled: [tip] } }), { tips: { settled: [tip] } });
  assert.deepEqual(S.detailFromSettledSummary({ settled: [tip] }), { tips: { settled: [tip] } });
  assert.deepEqual(S.detailFromSettledSummary({ ok: false }), null);
});

test("openStats prefers settled-summary then falls back to /api/server", () => {
  assert.match(html, /async function fetchSettledSummaryDetail\(gid\)/);
  assert.match(html, /\/api\/server\/settled-summary\?guild_id=/);
  assert.match(html, /return fetchServerDetail\(gid\)/);
  assert.match(html, /detail:await fetchSettledSummaryDetail\(s\.guild_id\)/);
});
