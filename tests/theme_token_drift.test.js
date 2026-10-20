// Theme tokens are copied by hand into index.html, live/index.html and
// compare/index.html. For every theme, a var that two or more of those files
// declare must have the same value. Colours are never changed here: Cinna
// decides. Known drift on 18 Oct 2026 is pinned below so that any NEW drift
// fails straight away, while the full "no drift" check stays a todo.
const test = require("node:test");
const assert = require("node:assert/strict");

// theme | var | app (index.html) | live | compare   ("-" = not declared there)
const KNOWN_DRIFT = [
  "navy|--t-callout|.875rem|.875rem|15px",
  "navy|--t-cap|.6875rem|.6875rem|11px",
  "navy|--t-foot|.75rem|.75rem|12px",
  "navy|--t-h3|1.0625rem|1.0625rem|18px",
  "navy|--t-sub|.8125rem|.8125rem|14px",
  "day|--t-callout|.875rem|.875rem|15px",
  "day|--t-cap|.6875rem|.6875rem|11px",
  "day|--t-foot|.75rem|.75rem|12px",
  "day|--t-h3|1.0625rem|1.0625rem|18px",
  "day|--t-sub|.8125rem|.8125rem|14px",
  "day|--warn|#e0a04a|#c9861f|-",
  "ochre|--t-callout|.875rem|.875rem|15px",
  "ochre|--t-cap|.6875rem|.6875rem|11px",
  "ochre|--t-foot|.75rem|.75rem|12px",
  "ochre|--t-h3|1.0625rem|1.0625rem|18px",
  "ochre|--t-sub|.8125rem|.8125rem|14px",
  "apex|--faint|#8B93A7|#6E768C|#6E768C",
  "apex|--t-callout|.875rem|.875rem|15px",
  "apex|--t-cap|.6875rem|.6875rem|11px",
  "apex|--t-h3|1.0625rem|1.0625rem|18px",
  "apex-light-legacy|--faint|#5C6578|#6A7386|#6A7386",
  "apex-light-legacy|--t-callout|.875rem|.875rem|15px",
  "apex-light-legacy|--t-cap|.6875rem|.6875rem|11px",
  "apex-light-legacy|--t-h3|1.0625rem|1.0625rem|18px",
];

async function drift() {
  const ts = await import("../scripts/token-sheet.mjs");
  return ts.driftReport(ts.buildModel({ withApexCss: false })).map(d =>
    [d.theme, d.var, d.values.app ?? "-", d.values.live ?? "-", d.values.compare ?? "-"].join("|"));
}

test("parser finds every theme block in all three surfaces", async () => {
  const ts = await import("../scripts/token-sheet.mjs");
  const model = ts.buildModel({ withApexCss: false });
  assert.deepEqual(Object.keys(model.app), ["navy", "day", "ochre", "apex", "apex-light", "apex-oled", "apex-mono", "apex-ochre", "apex-light-legacy"]);
  for (const s of ["live", "compare"]) assert.deepEqual(Object.keys(model[s]), ["navy", "day", "ochre", "apex", "apex-light-legacy"]);
  for (const s of Object.keys(model)) for (const t of Object.keys(model[s])) {
    for (const v of ["--bg", "--card", "--txt", "--muted", "--accent"]) assert.ok(model[s][t][v], `${s} ${t} is missing ${v}`);
  }
});

test("no NEW drift beyond the known list", async () => {
  const now = await drift();
  const fresh = now.filter(row => !KNOWN_DRIFT.includes(row));
  assert.deepEqual(fresh, [], "new token drift between index.html, live/ and compare/:\n" + fresh.join("\n"));
});

test("known drift entries are still real (remove fixed ones from KNOWN_DRIFT)", async () => {
  const now = await drift();
  const fixed = KNOWN_DRIFT.filter(row => !now.includes(row));
  assert.deepEqual(fixed, []);
});

test("shared theme vars match across index.html, live/ and compare/", {
  todo: "Known drift waiting on Cinna, see KNOWN_DRIFT: compare/ uses px type sizes (and different values), live/ day --warn, apex --faint",
}, async () => {
  assert.deepEqual(await drift(), []);
});
