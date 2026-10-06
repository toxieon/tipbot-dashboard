// node --test tests/   0.45.1: public tipster stats skip historical imports.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const stats = require("../assets/site/tipster-stats.js");

const root = path.join(__dirname, "..");
const example = JSON.parse(fs.readFileSync(path.join(root, "assets/site/example-tipster.json"), "utf8"));

function tip(partial) {
  return Object.assign({sel: "Test", match: "A v B", odds: 2, stake: 1, res: "W", pl: 1, book: "TAB", rnd: 1}, partial);
}

test("imports and historical rows are dropped before the record", () => {
  const rows = [
    tip({i: 1, res: "W", stake: 2, pl: 1.5, odds: 1.75}),
    tip({i: 2, res: "L", stake: 1, pl: -1, odds: 2.1}),
    tip({i: 0, res: "W", stake: 50, pl: 100, imported: true}),
    tip({i: 3, res: "L", stake: 20, pl: -20, is_historical: true}),
    tip({i: 4, res: "W", stake: 8, pl: 12, source: "import"}),
    tip({i: 5, res: "W", stake: 4, pl: 4, source: "Import"}),
    tip({i: 6, res: "pending", stake: 3, pl: 9, rnd: 9}),
    tip({i: 7, res: "P", stake: 5, pl: 0, odds: 1.9}),
    tip({res: "W", stake: 1, pl: 0.5, source: "discord", rnd: 2, i: 8})
  ];
  const out = stats.computeTipsterStats(rows);
  assert.equal(out.excludedImports, 4);
  assert.equal(out.wins, 2);
  assert.equal(out.losses, 1);
  assert.equal(out.pushes, 1);
  assert.equal(out.pendingCount, 1);
  assert.equal(out.settledCount, 4);
  assert.equal(out.units, 1);
  assert.equal(out.staked, 4);
  assert.equal(out.pending[0].result, "pending");
  assert.equal(out.recent[0].result, "W");
  assert.ok(out.recent.every((row) => row.result !== "pending"));
});

test("each import flag is enough on its own", () => {
  assert.equal(stats.isHistoricalImport({imported: true}), true);
  assert.equal(stats.isHistoricalImport({imported: false, is_historical: true}), true);
  assert.equal(stats.isHistoricalImport({source: "import"}), true);
  assert.equal(stats.isHistoricalImport({source: " IMPORT "}), true);
  assert.equal(stats.isHistoricalImport({imported: false, is_historical: false, source: "discord"}), false);
  assert.equal(stats.isHistoricalImport(null), false);
  const only = stats.computeTipsterStats([
    tip({res: "L", pl: -2, stake: 2, i: 1}),
    {imported: "true", res: "W", pl: 40, stake: 10, sel: "Old", match: "X", rnd: 1}
  ]);
  assert.equal(only.excludedImports, 1);
  assert.equal(only.wins, 0);
  assert.equal(only.losses, 1);
  assert.equal(only.units, -2);
});

test("last 10 is newest-first and a win run of 3 or more is hot", () => {
  const letters = ["L", "W", "W", "L", "W", "W", "W", "W", "W", "P", "W", "W"];
  const rows = letters.map((res, i) => tip({
    i: i, res: res, rnd: i + 1, pl: res === "W" ? 1 : (res === "L" ? -1 : 0), stake: 1
  }));
  const out = stats.computeTipsterStats(rows);
  assert.deepEqual(out.last10, ["W", "W", "P", "W", "W", "W", "W", "W", "L", "W"]);
  assert.equal(out.streak.type, "W");
  assert.equal(out.streak.n, 2);
  assert.equal(out.streak.hot, false);
  rows.push(tip({i: 20, res: "W", pl: 1, stake: 1, rnd: 20}));
  const hot = stats.computeTipsterStats(rows);
  assert.equal(hot.streak.n, 3);
  assert.equal(hot.streak.hot, true);
  assert.equal(hot.last10[0], "W");
});

test("example file keeps the MidfieldMick record after imports are removed", () => {
  assert.equal(example.example, true);
  assert.equal(example.handle, "midfieldmick");
  const out = stats.computeTipsterStats(example.tips);
  assert.equal(out.excludedImports, 3);
  assert.equal(out.wins, 87);
  assert.equal(out.losses, 61);
  assert.equal(out.pushes, 0);
  assert.equal(out.settledCount, 148);
  assert.equal(out.pendingCount, 1);
  assert.equal(out.units, 29.8);
  assert.equal(out.staked, 245.5);
  assert.equal(out.roi, 12.1);
  assert.equal(out.strikeRate, 58.8);
  assert.equal(out.avgOdds, 1.96);
  assert.deepEqual(out.last10, ["W", "W", "W", "W", "W", "L", "W", "W", "L", "W"]);
  assert.equal(out.last10Wins, 8);
  assert.equal(out.last10Losses, 2);
  assert.deepEqual(out.streak, {type: "W", n: 5, hot: true});
  assert.equal(out.pending[0].selection, "Sydney −12.5");
  assert.equal(out.pending[0].match, "Sydney v Collingwood");
  assert.equal(out.roundSeries[0], 0);
  assert.equal(out.roundSeries[out.roundSeries.length - 1], 29.8);
  assert.equal(out.roundSeries.length, 24);
  assert.equal(out.roundSeries[6], 9.75);
  assert.equal(out.recent[0].result, "W");
  assert.equal(stats.formatUnits(out.units, 1), "+29.8u");
  assert.equal(stats.formatPct(out.roi, true), "+12.1%");
  const withImports = stats.computeTipsterStats(example.tips.map((row) => {
    const copy = Object.assign({}, row);
    delete copy.imported;
    delete copy.is_historical;
    if (copy.source === "import") delete copy.source;
    return copy;
  }));
  assert.notEqual(withImports.units, out.units);
  assert.ok(withImports.settledCount > out.settledCount);
});

test("loader uses the example file until the public API base is set", async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    return {ok: true, status: 200, json: async () => ({handle: "midfieldmick", tips: []})};
  };
  const local = await stats.loadPublicTipster("MidfieldMick", {fetch: fetchFn, exampleUrl: "/assets/site/example-tipster.json"});
  assert.deepEqual(calls, ["/assets/site/example-tipster.json"]);
  assert.equal(local.example, true);
  assert.equal(local.requestedHandle, "MidfieldMick");
  calls.length = 0;
  const remote = await stats.loadPublicTipster("ada", {fetch: fetchFn, apiBase: "https://tipdashhq.com"});
  assert.equal(calls[0], "https://tipdashhq.com/api/public/tipster/ada");
  assert.equal(remote.example, undefined);
  await assert.rejects(
    () => stats.loadPublicTipster("ada", {fetch: async () => ({ok: false, status: 404, json: async () => ({})}), apiBase: ""}),
    /tipster_http_404/
  );
});

test("path and query pick a /t/<handle> and leave other paths alone", () => {
  assert.equal(stats.tipsterHandleFromPath("/t/midfieldmick"), "midfieldmick");
  assert.equal(stats.tipsterHandleFromPath("/t/MidfieldMick/"), "midfieldmick");
  assert.equal(stats.tipsterHandleFromPath("/t/index.html"), null);
  assert.equal(stats.tipsterHandleFromPath("/t/"), null);
  assert.equal(stats.tipsterHandleFromPath("/welcome/"), null);
  assert.equal(stats.tipsterHandleFromPath("/missing"), null);
  assert.equal(stats.tipsterHandleFromPath("/t/has space"), null);
  assert.equal(stats.tipsterHandleFromPath("/t/a/b"), null);
  assert.equal(stats.tipsterHandleFromQuery("?handle=Ada_1"), "ada_1");
  assert.equal(stats.tipsterHandleFromQuery("?handle="), null);
  assert.equal(stats.tipsterHandleFromQuery(""), null);
  const page = fs.readFileSync(path.join(root, "404.html"), "utf8");
  assert.match(page, /\/t\//);
  assert.match(page, /That page isn’t here/);
  assert.match(page, /tipsterHandleFromPath/);
});
