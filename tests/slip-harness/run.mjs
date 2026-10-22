// Slip OCR fixture harness: runs the real browser pipeline (vendored tesseract.js wasm +
// assets/slip-ocr.js recognizeImage/parseSlipLines) in headless Chromium over
// tests/fixtures/slips and prints a per-fixture, per-field pass table.
// Usage: node tests/slip-harness/run.mjs [--json out.json] [--only 02,s03]
// Exit code 1 if any real fixture fails a field (fixture 02 must be exact).
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL("../..", import.meta.url).pathname);
const FX = path.join(ROOT, "tests/fixtures/slips");
const spec = JSON.parse(fs.readFileSync(path.join(FX, "expected.json"), "utf8"));
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const verbose = args.includes("-v");

const types = { ".js": "application/javascript; charset=utf-8", ".wasm": "application/wasm", ".png": "image/png", ".html": "text/html" };
const srv = http.createServer((q, r) => {
  const p = decodeURIComponent(q.url.split("?")[0]);
  if (p === "/") { r.setHeader("content-type", "text/html"); r.end("<!doctype html><html><body></body></html>"); return; }
  const f = path.join(ROOT, path.normalize(p));
  if (!f.startsWith(ROOT)) { r.statusCode = 403; r.end(); return; }
  try { const b = fs.readFileSync(f); r.setHeader("content-type", types[path.extname(f)] || "application/octet-stream"); r.end(b); }
  catch { r.statusCode = 404; r.end(); }
});
await new Promise((res) => srv.listen(0, "127.0.0.1", res));
const port = srv.address().port;

const norm = (v) => (v == null ? "" : String(v)).toLowerCase().replace(/\s+/g, " ").trim();
const eq = (a, b) => (typeof b === "number" ? Number(a) === b : norm(a) === norm(b));
const who = (l) => l.player || l.team || l.selection || "";
const stat = (l) => l.stat || l.market || "";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
await page.addScriptTag({ url: "/assets/vendor/tesseract/tesseract.min.js" });
await page.addScriptTag({ url: "/assets/slip-ocr.js" });

const rows = [];
let realFail = false;
for (const fx of spec.fixtures) {
  if (only && !only.includes(fx.id)) continue;
  const textFile = String(fx.file || "").endsWith(".txt");
  const text = textFile ? fs.readFileSync(path.join(FX, fx.file), "utf8") : "";
  const slip = await page.evaluate(async ({ file, text, now, textFile }) => {
    const parsedNow = Date.parse(now);
    if (textFile) {
      const s = window.TBSlipOcr.parseSlipLines(text, { now: parsedNow });
      s._raw = text;
      return s;
    }
    const r = await window.TBSlipOcr.recognizeImage(window.Tesseract, "/tests/fixtures/slips/" + file, "/assets/vendor/tesseract/");
    const s = window.TBSlipOcr.parseSlipLines(r, { now: parsedNow });
    s._raw = r.text; return s;
  }, { file: fx.file, text, now: fx.now || spec.now, textFile });
  const e = fx.expect, checks = [];
  const ck = (field, got, want) => checks.push({ field, got, want, ok: eq(got, want) });
  for (const k of ["bet_type", "odds", "leg_count", "sport", "event", "date_time", "bookie", "stake_dollars", "returns_dollars"]) if (k in e) ck(k, slip[k], e[k]);
  ck("legs.length", (slip.legs || []).length, e.legs.length);
  e.legs.forEach((w, i) => {
    const g = (slip.legs || [])[i] || {};
    ck(`leg${i + 1}.who`, who(g), w.who);
    ck(`leg${i + 1}.stat`, stat(g), w.stat);
    if ("line" in w) ck(`leg${i + 1}.line`, g.line, w.line);
    if ("side" in w) ck(`leg${i + 1}.side`, g.side, w.side);
    for (const k of ["event", "date_time", "sport"]) if (k in w) ck(`leg${i + 1}.${k}`, g[k], w[k]);
  });
  const pass = checks.filter((c) => c.ok).length;
  const fails = checks.filter((c) => !c.ok);
  if (!fx.synthetic && fails.length) realFail = true;
  const flags = (slip.flags || []).map((f) => (f.leg != null ? `leg${f.leg + 1}.` : "") + f.field + ": " + f.reason);
  rows.push({ id: fx.id, file: fx.file, synthetic: fx.synthetic, variant: fx.variant || "", pass, total: checks.length, fails, flags });
  if (verbose) console.log("---", fx.id, "\n" + slip._raw);
}
await browser.close(); srv.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(pad("fixture", 34) + pad("kind", 22) + pad("fields", 9) + "rate");
for (const r of rows) {
  console.log(pad(path.basename(r.file).replace(/\.(png|txt)$/, ""), 34) + pad(r.synthetic ? "SYNTHETIC " + r.variant : "real", 22) +
    pad(`${r.pass}/${r.total}`, 9) + Math.round((100 * r.pass) / r.total) + "%");
  for (const f of r.fails) console.log(`    FAIL ${f.field}: got ${JSON.stringify(f.got)} want ${JSON.stringify(f.want)}`);
  for (const f of r.flags) console.log(`    flag ${f}`);
}
const sum = (rs) => rs.reduce((a, r) => [a[0] + r.pass, a[1] + r.total], [0, 0]);
const [rp, rt] = sum(rows.filter((r) => !r.synthetic)), [sp, st] = sum(rows.filter((r) => r.synthetic));
console.log(`real: ${rp}/${rt}  synthetic: ${sp}/${st}`);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(rows, null, 1));
process.exit(realFail ? 1 : 0);
