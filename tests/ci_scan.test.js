// CI guard: term parsing and the private scan, with throwaway terms only.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "scripts", "ci-public-guard.mjs"), "utf8");

function parseTerms(raw) {
  const body = src.match(/export function parseTerms\(raw\) \{([\s\S]*?)\n\}/)[1];
  return new Function("raw", body)(raw);
}

test("terms split on newlines and commas; whole words, case-insensitive", () => {
  const pats = parseTerms("alpha, beta\n\n re:gam+a ");
  assert.equal(pats.length, 3);
  assert.ok(pats[0].test("an Alpha here"));
  assert.ok(!pats[0].test("alphas"));
  assert.ok(!pats[0].test("xalpha"));
  assert.ok(pats[1].test("/beta/"));
  assert.ok(pats[2].test("gammma"));
  assert.equal(parseTerms("").length, 0);
  assert.equal(parseTerms(undefined).length, 0);
});

test("guard reads terms and ids from CI secrets, and skips with a notice when absent", () => {
  assert.match(src, /process\.env\.TIPDASH_SCAN_TERMS/);
  assert.match(src, /TIPDASH_SCAN_ID_\\d\+/);
  assert.match(src, /::notice::private scan skipped/);
  assert.doesNotMatch(src, /process\.stderr\.write\([^)]*\.match/);
  const wf = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
  assert.match(wf, /TIPDASH_SCAN_ID_1: \$\{\{ secrets\.TIPDASH_SCAN_ID_1 \}\}/);
  assert.match(wf, /TIPDASH_SCAN_TERMS: \$\{\{ secrets\.TIPDASH_SCAN_TERMS \}\}/);
});

test("when scan ids are set, none appears in index.html or app JS", () => {
  const ids = Object.keys(process.env).filter((k) => /^TIPDASH_SCAN_ID_\d+$/.test(k)).map((k) => process.env[k]).filter(Boolean);
  if (!ids.length) return;
  const files = [path.join(root, "index.html")].concat(
    fs.readdirSync(path.join(root, "assets")).filter((n) => n.endsWith(".js")).map((n) => path.join(root, "assets", n))
  );
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    for (const id of ids) assert.ok(!text.includes(id), path.basename(f));
  }
});
