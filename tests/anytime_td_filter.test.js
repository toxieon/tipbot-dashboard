// node --test tests/   Anytime TD tab: position filter (default All) and QBs pinned first.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../assets/espn-props.js");
const B = fs.readFileSync(path.join(__dirname, "..", "assets", "builder.js"), "utf8");
const match = (n, num, q) => String(n).toLowerCase().includes(String(q).toLowerCase());
const roster = [
  {name: "Zed Wide", position: "WR"}, {name: "Amy Tight", position: "TE"}, {name: "Bo Back", position: "RB"},
  {name: "Hal Half", position: "HB"}, {name: "Zack Arm", position: "QB"}, {name: "Al Arm", position: "QB"}, {name: "Kay Kick", position: "K"}
];

test("Anytime TD tab exists and is graded by TipBot's anytime_td key", () => {
  const t = P.NFL_PROP_TABS.find(x => x.key === "anytime_td");
  assert.ok(t && t.posFilter && t.def === 0.5);
  assert.deepEqual(P.NFL_POSITIONS, ["All", "QB", "RB", "WR", "TE"]);
});
test("default All keeps every skill player, QBs pinned to the top", () => {
  const names = P.visiblePlayers(roster, "nfl", "", match, "All", true).map(p => p.name);
  assert.deepEqual(names, ["Al Arm", "Zack Arm", "Amy Tight", "Bo Back", "Hal Half", "Zed Wide"]);
});
test("position filter narrows (HB counts as RB); other tabs not pinned", () => {
  assert.deepEqual(P.visiblePlayers(roster, "nfl", "", match, "RB", true).map(p => p.name), ["Bo Back", "Hal Half"]);
  assert.deepEqual(P.visiblePlayers(roster, "nfl", "", match, "TE", true).map(p => p.name), ["Amy Tight"]);
  const plain = P.visiblePlayers(roster, "nfl", "", match).map(p => p.name);
  assert.ok(plain.indexOf("Amy Tight") < plain.indexOf("Zack Arm"));
});
test("builder defaults the filter to All and pins on posFilter tabs", () => {
  assert.match(B, /BUILD\.espnPos\|\|"All"/);
  assert.match(B, /nameMatchesSearch, pos, !!prop\.posFilter\)/);
});
test("compact multi tray: Review multi (N) toggles chips + SGM warning", () => {
  assert.match(B, /Review multi \('\+n\+'\)/);
  assert.match(B, /id="traybody"'\+\(open\?'':' hidden'\)/);
  assert.match(B, /TB\.multiSummary\(BUILD\.legs\)\+'<\/div><\/div>'/);
});
