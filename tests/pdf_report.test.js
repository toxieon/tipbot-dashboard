// node --test tests/   Premium PDF report: model, HTML, public tips, sample screenshots.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

globalThis.TBTime = require("../assets/tbtime.js");
globalThis.TBSports = require("../assets/sport-marks.js");
globalThis.SvgCharts = require("../assets/svg-charts.js");
globalThis.ServerView = require("../assets/server-view.js");
globalThis.TBDashStats = require("../assets/stats.js");
globalThis.TBRacingLegs = require("../assets/racing-legs.js");
globalThis.TBAflGuernseys = require("../assets/afl-guernseys.js");
const PDF = require("../assets/pdf-report.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const now = Date.parse("2026-10-09T04:00:00Z");

function tip(over) {
  return Object.assign({
    tip_id: "t1",
    result: "Win",
    units: 1,
    odds: 2.1,
    profit_units: 1.1,
    settled_at: "2026-10-08T04:00:00Z",
    sport: "AFL",
    bet_type: "H2H",
    match: "Carlton v Collingwood"
  }, over);
}

const fixtureTips = [
  tip({ tip_id: "a", profit_units: 2, odds: 3, settled_at: "2026-10-07T04:00:00Z", sport: "AFL" }),
  tip({ tip_id: "b", result: "Loss", profit_units: -1, odds: 1.85, settled_at: "2026-10-06T04:00:00Z", sport: "NRL", bet_type: "Line" }),
  tip({
    tip_id: "c",
    result: "Win",
    profit_units: 4,
    odds: 5.5,
    settled_at: "2026-10-05T04:00:00Z",
    sport: "Racing",
    bet_type: "Win",
    legs: [{ kind: "racing", runner_number: 7, meeting: "Flemington", race_number: 4, colours: "red, white" }]
  }),
  tip({
    tip_id: "d",
    result: "Win",
    profit_units: 1.5,
    odds: 2.4,
    settled_at: "2026-10-04T04:00:00Z",
    sport: "AFL",
    bet_type: "Player",
    legs: [
      { team: "Carlton", player: "Walsh", number: 4, stat: "30+ disposals", line: 30 },
      { team: "Collingwood", player: "Daicos", number: 35, stat: "1+ goals", line: 1 }
    ]
  }),
  tip({ tip_id: "hidden", hidden: true, profit_units: 99, result: "Win" }),
  tip({ tip_id: "imp", historical: true, profit_units: 50, result: "Win" })
];

test("public tips exclude hidden and historical imports", () => {
  assert.equal(PDF.isPublicTip(tip()), true);
  assert.equal(PDF.isPublicTip(tip({ hidden: true })), false);
  assert.equal(PDF.isPublicTip(tip({ owner_only: true })), false);
  assert.equal(PDF.isPublicTip(tip({ historical: true })), false);
  const collected = PDF.collectTipsFromDetail({ tips: { settled: fixtureTips } });
  assert.ok(collected.every((t) => PDF.isPublicTip(t)));
  assert.equal(collected.length, 4);
});

test("buildModel includes executive summary, breakdowns and tip log", () => {
  const model = PDF.buildModel(fixtureTips.filter(PDF.isPublicTip), {
    window: "30",
    now: now,
    serverName: "Midfield Mick",
    periodLabel: "Last 30 days"
  });
  assert.equal(model.won, 3);
  assert.equal(model.lost, 1);
  assert.ok(model.units > 0);
  assert.ok(model.roi !== 0);
  assert.ok(model.best && model.worst);
  assert.equal(model.breakdowns.sport.length >= 2, true);
  assert.equal(model.log.length, 4);
  assert.match(model.log[0].legsHtml, /rp-leg-txt|tray-horse|tray-guernsey/);
});

test("documentHtml includes cover, charts, disclaimer and gamble responsibly", () => {
  const model = PDF.buildModel(fixtureTips.filter(PDF.isPublicTip), {
    window: "30",
    now: now,
    serverName: "Demo Server",
    title: "Performance report"
  });
  const doc = PDF.documentHtml(model);
  assert.match(doc, /TipBot/);
  assert.match(doc, /Executive summary/);
  assert.match(doc, /Cumulative profit/);
  assert.match(doc, /18\+ Gamble responsibly/);
  assert.match(doc, /rp-page/);
  assert.match(doc, /<svg/);
  assert.doesNotMatch(doc, /console\./);
});

test("normalizeOptions keeps cover mandatory and respects section toggles", () => {
  const raw = PDF.defaultOptions();
  raw.sections.cover = false;
  raw.sections.summary = false;
  raw.sections.chartCumulative = false;
  raw.sections.notes = false;
  const norm = PDF.normalizeOptions(raw);
  assert.equal(norm.sections.cover, true);
  assert.equal(norm.sections.summary, false);
  assert.equal(norm.sections.chartCumulative, false);
  assert.equal(norm.sections.notes, false);
});

test("documentHtml omits disabled sections and log columns", () => {
  const model = PDF.buildModel(fixtureTips.filter(PDF.isPublicTip), {
    window: "30",
    now: now,
    serverName: "Demo Server"
  });
  const opts = PDF.defaultOptions();
  opts.sections.summary = false;
  opts.sections.chartMonthly = false;
  opts.sections.breakdownMarket = false;
  opts.sections.log = true;
  opts.logColumns.event = false;
  opts.logColumns.odds = false;
  const doc = PDF.documentHtml(model, opts);
  assert.doesNotMatch(doc, /Executive summary/);
  assert.doesNotMatch(doc, /Monthly P&amp;L/);
  assert.doesNotMatch(doc, /By market/);
  assert.match(doc, /Tip log/);
  assert.match(doc, /<th>Date<\/th>/);
  assert.doesNotMatch(doc, /<th>Event<\/th>/);
  assert.doesNotMatch(doc, /<th class="odds">Odds<\/th>/);
});

test("brand_custom gate and custom accent on cover", () => {
  assert.equal(PDF.brandCustomAllowed({ brand_custom: true }), true);
  assert.equal(PDF.brandCustomAllowed({ settings: { brand_custom: 1 } }), true);
  assert.equal(PDF.brandCustomAllowed({}), false);
  assert.equal(PDF.brandCustomAllowed(null, { brand_custom: "yes" }), true);
  const model = PDF.buildModel(fixtureTips.filter(PDF.isPublicTip), {
    window: "30",
    now: now,
    serverName: "Branded"
  });
  const doc = PDF.documentHtml(model, PDF.defaultOptions(), {
    displayName: "Lucky Tips",
    accent: "#ff5500",
    logoDataUrl: "data:image/png;base64,iVBORw0KGgo="
  });
  assert.match(doc, /Lucky Tips/);
  assert.match(doc, /--accent:#ff5500/);
  assert.match(doc, /data:image\/png;base64/);
});

test("index wires pdf-report and Stats PDF button", () => {
  const statsJs = fs.readFileSync(path.join(root, "assets", "stats.js"), "utf8");
  assert.match(html, /pdf-report\.js/);
  assert.match(html, /promptExport/);
  assert.match(html, /brandCustomAllowed/);
  assert.match(html, /id="pdfbtn"/);
  assert.match(statsJs, /id="ds-pdf-btn"/);
});

test("sample PDF pages render to screenshots with mocked data", async (t) => {
  const chrome = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
  if (!fs.existsSync(chrome)) {
    t.skip("Chrome not available for PDF screenshots");
    return;
  }
  const puppeteer = require("puppeteer-core");
  const model = PDF.buildModel(fixtureTips.filter(PDF.isPublicTip), {
    window: "30",
    now: now,
    serverName: "Screenshot Server",
    title: "Performance report"
  });
  const doc = PDF.documentHtml(model);
  const outDir = path.join(root, "tests", "fixtures", "pdf-report");
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
  await page.setContent(doc, { waitUntil: "networkidle0" });
  const pages = await page.$$(".rp-page");
  assert.ok(pages.length >= 3);
  for (let i = 0; i < Math.min(pages.length, 4); i++) {
    const shot = path.join(outDir, "page-" + (i + 1) + ".png");
    await pages[i].screenshot({ path: shot });
    assert.ok(fs.statSync(shot).size > 8000, "page " + (i + 1) + " screenshot");
  }
  await browser.close();
});
