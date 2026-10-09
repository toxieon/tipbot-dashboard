// node --test tests/   0.44.1: server page stats, charts, bookie donut, tipster breakdown.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const SV = require("../assets/server-view.js");
const SC = require("../assets/svg-charts.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();

function tip(over){
  return Object.assign({
    tip_id: "t", result: "Win", units: 1, odds: 1.9, profit_units: 0.9,
    settled_at: "2026-08-01T04:00:00Z", bookmaker: "Sportsbet", tipster_name: "Mick"
  }, over);
}

test("historical and import flags are skipped; ordinary tips are not", () => {
  assert.equal(SV.isHistoricalImport(tip()), false);
  assert.equal(SV.isHistoricalImport(tip({settle_source: "manual"})), false);
  assert.equal(SV.isHistoricalImport(tip({settle_source: "god"})), false);
  assert.equal(SV.isHistoricalImport(tip({source: "discord"})), false);
  assert.equal(SV.isHistoricalImport(tip({historical: true})), true);
  assert.equal(SV.isHistoricalImport(tip({imported: 1})), true);
  assert.equal(SV.isHistoricalImport(tip({is_historical: "yes"})), true);
  assert.equal(SV.isHistoricalImport(tip({historical: false})), false);
  assert.equal(SV.isHistoricalImport(tip({import_id: "sheet-4"})), true);
  assert.equal(SV.isHistoricalImport(tip({source: "historical_import"})), true);
  assert.equal(SV.isHistoricalImport(tip({origin: "Import"})), true);
  assert.equal(SV.isHistoricalImport(tip({flags: ["live", "historical"]})), true);
  assert.equal(SV.isHistoricalImport(tip({meta: {imported_at: "2020-01-01"}})), true);
});

test("cards use API stats until a complete payload marks imports", () => {
  const partial = {
    stats: {won: 87, lost: 61, push: 3, profit_units: 29.8, roi: 12.1, strike_rate: 58.8, staked_units: 245.5, settled: 151, queued: 2, followers: 40},
    tips: {settled: [tip({historical: true, profit_units: 50, units: 10})], queued: []}
  };
  const apiCards = SV.cardModel(partial);
  assert.equal(apiCards.source, "api");
  assert.equal(apiCards.unitsText, "+29.8u");
  assert.equal(apiCards.roiText, "+12.1%");
  assert.equal(apiCards.strikeText, "58.8%");
  assert.equal(apiCards.recordText, "87–61");
  assert.equal(apiCards.pushText, "3 push");

  const full = {
    stats: {won: 2, lost: 1, push: 1, profit_units: 99, roi: 50, strike_rate: 50, staked_units: 10, settled: 4, queued: 1, followers: 3},
    tips: {
      settled: [
        tip({tip_id: "a", result: "Win", profit_units: 1, units: 1, historical: true}),
        tip({tip_id: "b", result: "Win", profit_units: 2, units: 2}),
        tip({tip_id: "c", result: "Loss", profit_units: -1, units: 1}),
        tip({tip_id: "d", result: "Push", profit_units: 0, units: 1})
      ],
      queued: [tip({tip_id: "e", result: "", status: "Pending", units: 1})]
    }
  };
  const cards = SV.cardModel(full);
  assert.equal(cards.source, "tips");
  assert.equal(cards.won, 1);
  assert.equal(cards.lost, 1);
  assert.equal(cards.push, 1);
  assert.equal(cards.unitsText, "+1.0u");
  assert.equal(cards.roiText, "+25.0%");
  assert.equal(cards.strikeText, "50.0%");
  assert.equal(cards.recordText, "1–1");
  assert.equal(cards.pushText, "1 push");
  assert.equal(cards.unitsCls, "pos");
});

test("missing tips, stats, and long names do not throw", () => {
  assert.doesNotThrow(() => SV.cardModel({}));
  assert.doesNotThrow(() => SV.cardModel({tips: null, stats: null}));
  assert.doesNotThrow(() => SV.blocks({}));
  assert.doesNotThrow(() => SV.unitsSeries({}));
  const empty = SV.cardModel({});
  assert.equal(empty.recordText, "0–0");
  assert.equal(empty.unitsText, "0.0u");
  const rows = SV.tipsterBreakdown({
    tips: {settled: [tip({tipster_name: "A".repeat(64) + " " + "B".repeat(64)})], queued: []}
  });
  assert.equal(rows[0].initials, "AB");
  assert.ok(rows[0].name.length > 100);
});

test("a losing record is negative and push is not a strike", () => {
  const detail = {
    stats: {won: 0, lost: 2, push: 1, settled: 3, profit_units: -2, roi: -100, strike_rate: 0, staked_units: 2},
    tips: {settled: [
      tip({result: "Loss", profit_units: -1, units: 1, historical: true}),
      tip({tip_id: "1", result: "Loss", profit_units: -1, units: 1}),
      tip({tip_id: "2", result: "Loss", profit_units: -1, units: 1}),
      tip({tip_id: "3", result: "Void", profit_units: 0, units: 1})
    ], queued: []}
  };
  const cards = SV.cardModel(detail);
  assert.equal(cards.strikeText, "0.0%");
  assert.equal(cards.recordText, "0–2");
  assert.equal(cards.pushText, "1 push");
  assert.equal(cards.unitsText, "-2.0u");
  assert.equal(cards.unitsCls, "neg");
  assert.equal(cards.roiCls, "neg");
});

test("units series is cumulative and drops historical imports", () => {
  const detail = {
    tips: {settled: [
      tip({settled_at: "2026-08-02T02:00:00Z", profit_units: 2, historical: true}),
      tip({tip_id: "b", settled_at: "2026-08-03T02:00:00Z", profit_units: -1}),
      tip({tip_id: "a", settled_at: "2026-08-01T02:00:00Z", profit_units: 3})
    ], queued: []}
  };
  const series = SV.unitsSeries(detail);
  assert.deepEqual(series.points.map((p) => p.y), [0, 3, 2]);
  assert.equal(series.points[0].label, "Start");
  assert.equal(series.fallback, false);
});

test("monthly bars group Sydney months and skip undated fallback when imports are marked", () => {
  const detail = {
    profit_series: [{month: "2026-01", profit: 99}],
    tips: {settled: [
      tip({settled_at: "2026-08-31T14:30:00Z", profit_units: 4}),
      tip({settled_at: "2026-08-12T04:00:00Z", profit_units: 1, historical: true}),
      tip({tip_id: "c", settled_at: "2026-09-01T02:00:00Z", profit_units: -2})
    ], queued: []}
  };
  const bars = SV.monthlyBars(detail);
  assert.deepEqual(bars.map((b) => [b.key, b.value]), [["2026-09", 2]]);
});

test("without dates, monthly bars fall back to the API series", () => {
  const detail = {
    profit_series: [{month: "2026-07", profit: 3}, {month: "2026-08", profit: -1}],
    tips: {settled: [tip({settled_at: "", created_at: "", profit_units: 9})], queued: []}
  };
  const bars = SV.monthlyBars(detail);
  assert.deepEqual(bars.map((b) => [b.key, b.value]), [["2026-07", 3], ["2026-08", -1]]);
});

test("bookie donut only when a bookie field is present", () => {
  assert.equal(SV.bookieBreakdown({tips: {settled: [tip({bookmaker: "", bookie: ""})], queued: []}}), null);
  assert.equal(SV.bookieBreakdown({tips: {settled: [tip({bookmaker: "No bookie"})], queued: []}}), null);
  const books = SV.bookieBreakdown({tips: {
    settled: [
      tip({bookmaker: "Sportsbet"}),
      tip({tip_id: "2", bookie: "TAB", bookmaker: ""}),
      tip({tip_id: "3", bookmaker: "Sportsbet", historical: true}),
      tip({tip_id: "4", bookmaker: ""})
    ],
    queued: [tip({tip_id: "5", result: "", status: "Pending", bookmaker: "TAB"})]
  }});
  assert.equal(books.total, 3);
  assert.deepEqual(books.slices.map((s) => [s.name, s.n]), [["Sportsbet", 1], ["TAB", 2]].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  assert.equal(books.slices[0].name, "TAB");
  assert.ok(books.slices[0].pct > 0);
});

test("tipster breakdown is units in this server, highest first, and hidden with no names", () => {
  assert.deepEqual(SV.tipsterBreakdown({tips: {settled: [tip({tipster_name: "", user_id: ""})], queued: []}}), []);
  const rows = SV.tipsterBreakdown({tips: {
    settled: [
      tip({tipster_name: "Larry", profit_units: -4, result: "Loss"}),
      tip({tip_id: "2", tipster_name: "Mick", profit_units: 5}),
      tip({tip_id: "3", tipster_name: "Mick", profit_units: 1}),
      tip({tip_id: "4", tipster_name: "Rhi", profit_units: 9, historical: true})
    ],
    queued: [tip({tip_id: "5", result: "", status: "Pending", tipster_name: "Larry", profit_units: 0})]
  }});
  assert.deepEqual(rows.map((r) => r.name), ["Mick", "Larry"]);
  assert.equal(rows[0].units, 6);
  assert.equal(rows[0].bets, 2);
  assert.equal(rows[0].unitsText, "+6.0u");
  assert.equal(rows[1].bets, 2);
  assert.equal(rows[1].units, -4);
  assert.equal(rows[0].initials, "MI");
});

test("render hides the donut and the tipster list when there is nothing to show", () => {
  const bare = {stats: {won: 1, lost: 0, push: 0, profit_units: 1, roi: 10, strike_rate: 100, staked_units: 10, settled: 1, queued: 0, followers: 2}, tips: {settled: [], queued: []}};
  const blocks = SV.blocks(bare, {period: "Lifetime", formHtml: '<span class="tb-form">dots</span>'});
  assert.match(blocks.stats, /ROI/);
  assert.match(blocks.stats, /Strike rate/);
  assert.match(blocks.stats, /Units/);
  assert.match(blocks.stats, /Record/);
  assert.match(blocks.stats, /data-act="queued"/);
  assert.match(blocks.stats, /data-act="followers"/);
  assert.match(blocks.stats, /tb-form/);
  assert.match(blocks.charts, /Units over time/);
  assert.match(blocks.charts, /Monthly P&amp;L/);
  assert.equal(blocks.splits, "");
  const rich = SV.splitsHtml({tips: {settled: [tip(), tip({tip_id: "2", tipster_name: "Rhi", bookmaker: "TAB", profit_units: -1, result: "Loss"})], queued: []}});
  assert.match(rich, /Bets by bookie/);
  assert.match(rich, /Tipsters in this server/);
  assert.match(rich, /Sportsbet/);
  assert.match(rich, /<path /);
});

test("stale queued tile says Updating", () => {
  const htmlStr = SV.statsHtml({stats: {queued: 4, followers: 1, won: 0, lost: 0, push: 0, profit_units: 0, roi: 0, strike_rate: 0}, tips: {settled: [], queued: []}}, {stale: true});
  assert.match(htmlStr, /data-sv="queued">Updating…/);
});

test("area, bar and donut are inline SVG and use theme variables", () => {
  const area = SC.areaChart({data: [0, 2, 1, 4], xLabels: [[0, "Start"], [3, "End"]], id: "t", aria: "units"});
  assert.match(area, /^<svg /);
  assert.match(area, /stroke="var\(--accent\)"/);
  assert.match(area, /<path /);
  assert.equal(SC.areaChart({data: [1]}), "");
  const bars = SC.barChart({bars: [{label: "Aug", value: 3}, {label: "Sep", value: -2}]});
  assert.equal((bars.match(/<rect /g) || []).length, 2);
  assert.match(bars, /fill="var\(--win\)"/);
  assert.match(bars, /fill="var\(--loss\)"/);
  const ring = SC.donut({slices: [{name: "TAB", n: 2, color: "var(--accent)"}, {name: "Neds", n: 1, color: "var(--win)"}]});
  assert.equal((ring.match(/<path /g) || []).length, 2);
  assert.match(ring, />3</);
  assert.equal(SC.donut({slices: []}), "");
  assert.doesNotMatch(area + bars + ring, /font-family:\s*"?Inter/i);
});

test("the server page wires the helpers and keeps the old panels", () => {
  assert.match(html, new RegExp('<script src="\\./assets/svg-charts\\.js\\?v=' + version.replace(/\./g, "\\.") + '"></script>'));
  assert.match(html, new RegExp('<script src="\\./assets/server-view\\.js\\?v=' + version.replace(/\./g, "\\.") + '"></script>'));
  const detail = html.slice(html.indexOf("function renderDetail"), html.indexOf("function mountScheduled"));
  assert.match(detail, /ServerView\.blocks/);
  assert.match(detail, /id="monthsel"/);
  assert.match(detail, /id="scheduled-panel"/);
  assert.match(detail, /id="live-tips-panel"/);
  assert.match(detail, /id="scheduled-panel"/);
  assert.match(detail, /id="settings-panel"/);
  assert.match(detail, /id="recent-panel"/);
  assert.match(detail, /recentTipRow/);
  assert.match(detail, /renderCalendar/);
  assert.doesNotMatch(html, /fonts\.googleapis|@font-face/);
});
