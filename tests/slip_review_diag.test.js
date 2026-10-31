// node --test tests/   "Review imported slip" sends one diagnostics post per import id; the parser
// no longer reads Sportsbet's "Home At Away" game header as an extra leg.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");

function loadUi() {
  const calls = [], timers = [];
  class FD { constructor() { this.f = []; } append(k, v) { this.f.push([k, v]); } get(k) { const e = this.f.find((x) => x[0] === k); return e && e[1]; } }
  const ctx = { TD: { loaded: {} }, FormData: FD, setTimeout: (fn) => timers.push(fn), API: "https://bot.example", getToken: () => "tok",
    fetch: (url, init) => { calls.push({ url, init }); return Promise.resolve(); },
    document: { getElementById: () => null, addEventListener() {} }, URL: { createObjectURL: () => "" } };
  ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "assets/slip-ocr-ui.js"), "utf8"), ctx);
  return { ctx, calls, flush: () => timers.splice(0).forEach((fn) => fn()) };
}

test("review_shown posts once per import id, with legs, warnings and image, no OCR text", () => {
  const { ctx, calls, flush } = loadUi();
  const st = { importId: "abc-1", file: { size: 10, type: "image/png" }, ocrText: "secret text",
    parsed: { bet_type: "Same Game Multi", odds: 1.9, leg_count: 2, legs: [{ player: "A" }, { player: "B" }],
      flags: [{ field: "stake", reason: "Stake isn't on the slip — enter it" }] } };
  ctx.TDSlipDiag.reviewShown(st); ctx.TDSlipDiag.reviewShown(st); ctx.TDSlipDiag.reviewShown(st);
  flush();
  assert.equal(calls.length, 1);
  const fd = calls[0].init.body;
  assert.equal(fd.get("kind"), "review_shown");
  assert.equal(fd.get("import_id"), "abc-1");
  assert.ok(fd.get("image"));
  assert.equal(fd.get("ocr_text"), undefined);
  const p = JSON.parse(fd.get("parsed"));
  assert.equal(p.legs.length, 2);
  assert.match(p.flags[0].reason, /Stake/);
  ctx.TDSlipDiag.reviewShown(Object.assign({}, st, { importId: "abc-2" })); flush();
  assert.equal(calls.length, 2, "a new import posts again");
  ctx.TDSlipDiag.reviewShown(Object.assign({}, st, { importId: "" })); flush();
  assert.equal(calls.length, 2, "no id, no post");
});

test("import ids are unique and every re-render path uses the stored id", () => {
  const ui = fs.readFileSync(path.join(root, "assets/slip-ocr-ui.js"), "utf8");
  const { ctx } = loadUi();
  assert.notEqual(ctx.TDSlipDiag.newImportId(), ctx.TDSlipDiag.newImportId());
  assert.match(ui, /function renderReviewScreen\(\) \{[\s\S]{0,400}reportReviewShown\(\)/);
  assert.match(ui, /SLIP\.importId = e\.importId/);
});

function parse(text) {
  const ctx = { window: {} }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "assets/slip-ocr.js"), "utf8"), ctx);
  return ctx.TBSlipOcr.parseSlipLines(text, { now: Date.parse("2026-11-01T09:00:00+11:00") });
}

test("2-leg SGM under a 'X At Y' header reads 2 legs, not 3", () => {
  const s = parse("Same Game Multi @ 1.90\n2 Legs\nPhiladelphia 76ers At Charlotte Hornets\nTyrese Maxey Under (+4.5)\nTyrese Maxey - Rebounds\nKelly Oubre Jr. Over (+9.5)\nKelly Oubre Jr. - Points\n");
  assert.equal(s.legs.length, 2);
  assert.equal(s.event, "Philadelphia 76ers @ Charlotte Hornets");
  assert.ok(!s.flags.some((f) => f.field === "legs"), JSON.stringify(s.flags));
});

test("leg-count cross-check still warns when the slip and the read disagree", () => {
  const s = parse("Same Game Multi @ 1.90\n3 Legs\nPhiladelphia 76ers At Charlotte Hornets\nTyrese Maxey Under (+4.5)\nTyrese Maxey - Rebounds\nKelly Oubre Jr. Over (+9.5)\nKelly Oubre Jr. - Points\n");
  assert.ok(s.flags.some((f) => /Slip says 3 legs but 2 were read/.test(f.reason)));
});

test("lowercase 'at' inside a selection is not an event header", () => {
  const s = parse("Same Game Multi @ 1.90\n2 Legs\nPHI v CHA\nTyrese Maxey Under (+4.5)\nTyrese Maxey - Rebounds\nKelly Oubre Jr. Over (+9.5)\nKelly Oubre Jr. - Points\n");
  assert.equal(s.legs.length, 2);
});
