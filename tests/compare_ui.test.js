// node --test tests/compare_ui.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const C = require("../assets/compare-ui.js");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("exact line is ranked by price and the best price is marked", () => {
  const view = C.fromCompare(C.sampleCompare(), C.samplePick());
  assert.equal(view.kind, "prices");
  assert.equal(view.prop, "Errol Gulden 25+ disposals");
  assert.deepEqual(view.exactRows.map((r) => [r.book, r.price, !!r.best]), [
    ["Ladbrokes", 2.05, true],
    ["Sportsbet", 1.91, false],
    ["PointsBet", 1.87, false],
  ]);
  assert.equal(view.exactRows.filter((r) => r.best).length, 1);
});

test("a bookie with no price on a line is left out", () => {
  const view = C.fromCompare(C.sampleCompare(), C.samplePick());
  const twenty = view.nearby.find((g) => g.line === 20);
  const thirty = view.nearby.find((g) => g.line === 30);
  assert.deepEqual(twenty.rows.map((r) => r.book), ["Ladbrokes", "Sportsbet"]);
  assert.deepEqual(thirty.rows.map((r) => r.book), ["PointsBet", "Ladbrokes"]);
  assert.equal(twenty.title, "20+ disposals");
  assert.equal(thirty.title, "30+ disposals");
});

test("nearby lines are closest to the picked line first", () => {
  const data = C.sampleCompare();
  data.table.push({line: 15, cells: {sportsbet: {over: 1.2, under: 3.4}, pointsbetau: null, ladbrokes_au: null}});
  const view = C.fromCompare(data, C.samplePick());
  assert.deepEqual(view.nearby.map((g) => g.line), [20, 30, 15]);
});

test("a line that is not quoted stays out of the exact block", () => {
  const pick = C.samplePick();
  pick.line = 22;
  const view = C.fromCompare(C.sampleCompare(), pick);
  assert.equal(view.exactQuoted, false);
  assert.equal(view.exactRows.length, 0);
  assert.ok(view.nearby.some((g) => g.line === 20));
  assert.ok(view.nearby.some((g) => g.line === 25));
});

test("under uses under prices only", () => {
  const pick = Object.assign({}, C.samplePick(), {side: "Under"});
  const view = C.fromCompare(C.sampleCompare(), pick);
  assert.equal(view.prop, "Errol Gulden under 25 disposals");
  assert.equal(view.exactRows[0].book, "PointsBet");
  assert.equal(view.exactRows[0].price, 1.95);
  assert.equal(view.exactRows[0].side, "Under");
  assert.ok(view.exactRows.every((r) => r.price !== 2.05));
});

test("tied best prices are both highlighted, Sportsbet first", () => {
  const data = C.sampleCompare();
  data.table[1].cells.sportsbet.over = 2.05;
  const view = C.fromCompare(data, C.samplePick());
  assert.deepEqual(view.exactRows.map((r) => [r.book, r.best]), [
    ["Sportsbet", true],
    ["Ladbrokes", true],
    ["PointsBet", false],
  ]);
});

test("no saved prices is an empty view", () => {
  assert.equal(C.fromCompare({ok: true, available: false}, C.samplePick()), null);
  const quoted = C.sampleCompare();
  quoted.table.forEach((row) => {
    Object.keys(row.cells).forEach((k) => {
      if (row.cells[k]) row.cells[k] = {over: null, under: row.cells[k].under};
    });
  });
  const view = C.fromCompare(quoted, C.samplePick());
  assert.equal(view.kind, "empty");
});

test("player-lines payload supplies a primary line and a better line", () => {
  const raw = {
    players: [{
      player: "Errol Gulden",
      stat: "Disposals",
      bookie: "sportsbet",
      line: 25,
      over_price: 1.91,
      under_price: 1.9,
      better_under: {bookie: "pointsbetau", line: 30, over_price: 2.7, under_price: 1.4}
    }]
  };
  const view = C.fromPlayerLines(raw, C.samplePick());
  assert.equal(view.exactRows[0].book, "Sportsbet");
  assert.equal(view.exactRows[0].price, 1.91);
  assert.equal(view.nearby[0].line, 30);
  assert.equal(view.nearby[0].rows[0].book, "PointsBet");
});

test("Sportsbet disposal ladder is ranked and half-lines label cleanly", () => {
  const raw = {
    players: [{
      player: "E. Gulden",
      stat: "disposal",
      bookie: "sportsbet",
      lines: [
        {line: 20, price: 1.4, side: "Over"},
        {line: 25, price: 1.95, side: "Over"},
        {line: 30, price: 2.85, side: "Over"},
        {line: 24.5, price: 1.88, side: "Over"}
      ]
    }]
  };
  const view = C.fromPlayerLines(raw, C.samplePick());
  assert.equal(view.exactRows.length, 1);
  assert.equal(view.exactRows[0].price, 1.95);
  assert.equal(view.exactRows[0].best, true);
  assert.deepEqual(view.nearby.map((g) => g.title), ["24.5+ disposals", "20+ disposals", "30+ disposals"]);
  assert.equal(C.fromPlayerLines(raw, Object.assign({}, C.samplePick(), {player: "Nick Daicos"})), null);
});

test("html leads with the one-line explanation and highlights only the exact best price", () => {
  const html = C.html(C.fromCompare(C.sampleCompare(), C.samplePick()));
  assert.ok(html.startsWith('<p class="compare-lead">' + C.EXPLAIN + "</p>"));
  assert.equal((html.match(/compare-lead/g) || []).length, 1);
  assert.match(html, /class="compare-row is-best"/);
  assert.match(html, /Ladbrokes<span class="compare-best-tag">Best<\/span>/);
  assert.equal((html.match(/is-best/g) || []).length, 1);
  const twenty = html.split("20+ disposals")[1].split("30+ disposals")[0];
  assert.doesNotMatch(twenty, /PointsBet/);
  const empty = C.html(C.empty(C.samplePick()));
  assert.match(empty, /No prices saved for this yet/);
  assert.equal((empty.match(/compare-row/g) || []).length, 0);
  const prompt = C.html(C.prompt());
  assert.match(prompt, /Pick a player and a line, then tap Compare/);
  assert.equal(C.summary(C.prompt()), "");
  assert.equal(C.summary(C.fromCompare(C.sampleCompare(), C.samplePick())), "Errol Gulden · 25+");
});

test("the builder shows Compare as a closed section and does not hide the button", () => {
  const builder = read("assets/builder.js");
  const html = read("index.html");
  assert.match(builder, /id="compare-panel" data-sec="builder-compare"/);
  assert.match(builder, /<button type="button" class="compare-btn"/);
  assert.doesNotMatch(builder, /FEATURE_COMPARE/);
  assert.doesNotMatch(html, /FEATURE_COMPARE/);
  assert.match(html, /<script src="\.\/assets\/compare-ui\.js\?v=0\.48\.1"><\/script>/);
  assert.match(html, /compare-lead/);
  assert.match(read("compare/index.html"), /TBCompare/);
  const fresh = read("assets/compare-ui.js") + read("compare/index.html") + read("PUBLIC_CHANGELOG.md") + read("CHANGELOG.md").split("## 0.47.1")[0];
  assert.doesNotMatch(fresh, /forward/i);
});
