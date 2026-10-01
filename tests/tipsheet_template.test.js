// 6.5: the Paste sheet reads TipBot's CSV template (shared fixture = TipBot tests/fixtures/tipsheet_template.csv).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const TEMPLATE = fs.readFileSync(path.join(__dirname, "fixtures", "tipsheet_template.csv"), "utf8");

function admin() {
  const ctx = { TD: { loaded: {} }, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/admin.js"), "utf8"), ctx, { filename: "admin.js" });
  return ctx;
}

test("the template's example row parses cleanly", () => {
  const p = admin().parseTipSheet(TEMPLATE);
  assert.equal(p.ok, true);
  assert.equal(p.hardErrors.length, 0);
  assert.equal(p.tipCount, 1);
  const t = p.singles[0];
  assert.equal(t.game_name, "Sydney Swans v Fremantle");
  assert.deepEqual([t.odds, t.units], [1.85, 1]);
  assert.deepEqual(t.legs[0], { player: "Chad Warner", stat: "Disposals", line: 24.5, side: "Over", game: "Sydney Swans v Fremantle" });
});

test("a filled CSV with quotes and a multi", () => {
  const sheet = "kind,game,player,stat,line,side,odds,units,group\n"
    + 'MULTI,"Carlton v Hawthorn","Smith, J",Goals,1.5,Over,3.2,0.5,M1\n'
    + "MULTI,Carlton v Hawthorn,Cripps,Disposals,29.5,Under,3.2,0.5,M1\n";
  const p = admin().parseTipSheet(sheet);
  assert.equal(p.ok, true);
  assert.deepEqual(p.multis[0].legs.map((l) => l.player), ["Smith, J", "Cripps"]);
});

test("TSV sheets are read as before", () => {
  const p = admin().parseTipSheet("kind\tgame\tplayer\tstat\tline\tside\todds\tunits\tgroup\nSINGLE\tA v B\tX, Y\tGoals\t1.5\tOver\t2\t1\t");
  assert.equal(p.ok, true);
  assert.equal(p.singles[0].legs[0].player, "X, Y");
});

test("the download button is only in the owner-only Admin Tools panel", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const zone = html.slice(html.indexOf("const pasteSheetZone="), html.indexOf("const adminFeatures="));
  assert.match(zone, /id="paste-template"/);
  assert.match(html, /const adminPanel=isAdmin\?\(/);
  assert.match(html, /const isAdmin=STATE\.role==="owner"&&!STATE\.viewAs;/);
});
