// node --test tests/   Failed slip imports send a fire-and-forget diagnostics report.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const ui = fs.readFileSync(path.join(root, "assets/slip-ocr-ui.js"), "utf8");
const builder = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");

function load(opts = {}) {
  const calls = [];
  const timers = [];
  class FD { constructor() { this.f = []; } append(k, v, n) { this.f.push([k, v, n]); } get(k) { const e = this.f.find((x) => x[0] === k); return e && e[1]; } }
  const ctx = {
    TD: { loaded: {} }, FormData: FD, setTimeout: (fn) => timers.push(fn),
    API: "https://bot.example", getToken: () => (opts.token === undefined ? "tok" : opts.token),
    fetch: (url, init) => { calls.push({ url, init }); if (opts.throws) throw new Error("x"); return Promise.reject(new Error("offline")); },
    document: { getElementById: () => null, addEventListener() {} },
    URL: { createObjectURL: () => "" },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(ui, ctx);
  return { ctx, calls, flush: () => timers.splice(0).forEach((fn) => fn()) };
}

test("report posts multipart with image and fields, async and never throws", () => {
  const { ctx, calls, flush } = load();
  const file = { size: 1000, type: "image/png" };
  ctx.TDSlipDiag.report("ocr_failed", new Error("boom"), {
    file, ocr: { text: "Same Game Multi @ 3.10", lines: [{ text: "a" }], width: 9 },
    parsed: { sport: "AFL", bookie: "Sportsbet", legs: [] }, guildId: "123",
  });
  assert.equal(calls.length, 0, "sent on a later tick, not inline");
  flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://bot.example/api/diagnostics/slip");
  const fd = calls[0].init.body;
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok");
  assert.equal(fd.get("kind"), "ocr_failed");
  assert.equal(fd.get("error"), "boom");
  assert.equal(fd.get("sport"), "AFL");
  assert.equal(fd.get("bookie"), "Sportsbet");
  assert.equal(fd.get("guild_id"), "123");
  assert.match(fd.get("ocr_text"), /Same Game Multi/);
  assert.equal(JSON.parse(fd.get("ocr_lines")).width, 9);
  assert.ok(fd.get("image") === file);
});

test("big or non-image files are not attached; signed-out and failing fetch are silent", () => {
  let t = load();
  t.ctx.TDSlipDiag.report("parse_failed", "x", { file: { size: 9 * 1024 * 1024, type: "image/png" } });
  t.ctx.TDSlipDiag.report("parse_failed", "x", { file: { size: 10, type: "application/pdf" } });
  t.flush();
  assert.equal(t.calls.length, 2);
  assert.ok(t.calls.every((c) => c.init.body.get("image") === undefined));
  t = load({ token: null });
  t.ctx.TDSlipDiag.report("ocr_failed", "x");
  t.flush();
  assert.equal(t.calls.length, 0);
  t = load({ throws: true });
  assert.doesNotThrow(() => { t.ctx.TDSlipDiag.report("ocr_failed", "x"); t.flush(); });
});

test("at most five reports per import", () => {
  const t = load();
  for (let i = 0; i < 8; i++) t.ctx.TDSlipDiag.report("nothing_recognised", "x");
  t.flush();
  assert.equal(t.calls.length, 5);
});

test("import flow reports each failure stage and the schedule refusal", () => {
  assert.match(ui, /reportDiagnostics\("nothing_recognised"/);
  assert.match(ui, /reportDiagnostics\(stage === "done" \? "parse_failed" : stage, e/);
  assert.match(ui, /BUILD\._slipDiag = \{/);
  assert.match(builder, /TDSlipDiag\.report\("server_rejected"/);
  assert.match(builder, /BUILD\._slipDiag=null/);
  assert.doesNotMatch(ui, /await fetch\(API \+ "\/api\/diagnostics/);
});
