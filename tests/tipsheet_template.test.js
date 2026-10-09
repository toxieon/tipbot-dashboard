// 6.5: the Paste sheet reads TipBot's CSV template (shared fixture = TipBot tests/fixtures/tipsheet_template.csv).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const TEMPLATE = fs.readFileSync(path.join(__dirname, "fixtures", "tipsheet_template.csv"), "utf8");

// Values built inside the vm context have that realm's Object/Array prototypes, which
// strict deepEqual rejects; copy them into this realm before comparing.
const plain = (v) => JSON.parse(JSON.stringify(v));

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
  assert.deepEqual(plain(t.legs[0]), { player: "Chad Warner", stat: "Disposals", line: 24.5, side: "Over", game: "Sydney Swans v Fremantle" });
});

test("a filled CSV with quotes and a multi", () => {
  const sheet = "kind,game,player,stat,line,side,odds,units,group\n"
    + 'MULTI,"Carlton v Hawthorn","Smith, J",Goals,1.5,Over,3.2,0.5,M1\n'
    + "MULTI,Carlton v Hawthorn,Cripps,Disposals,29.5,Under,3.2,0.5,M1\n";
  const p = admin().parseTipSheet(sheet);
  assert.equal(p.ok, true);
  assert.deepEqual(plain(p.multis[0].legs.map((l) => l.player)), ["Smith, J", "Cripps"]);
});

test("TSV sheets are read as before", () => {
  const p = admin().parseTipSheet("kind\tgame\tplayer\tstat\tline\tside\todds\tunits\tgroup\nSINGLE\tA v B\tX, Y\tGoals\t1.5\tOver\t2\t1\t");
  assert.equal(p.ok, true);
  assert.equal(p.singles[0].legs[0].player, "X, Y");
});

test("the download button is not duplicated into the public dashboard shell", () => {
  // Paste sheet (with its download button) lives entirely in the program-owner
  // panel the bot serves at session-auth time; nothing in this repo's shell
  // should carry it or the admin-only gate's absence.
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /STATE\.ops===true&&!STATE\.viewAs/);
  assert.doesNotMatch(html, /id="paste-template"/);
});
