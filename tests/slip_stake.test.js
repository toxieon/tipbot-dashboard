const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const Ocr = require("../assets/slip-ocr.js");

const ui = fs.readFileSync(path.join(__dirname, "..", "assets", "slip-ocr-ui.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("a dollar stake on the slip is read as dollars", () => {
  const slip = Ocr.parseSlipText("Same Game Multi\nGeelong v Carlton\nStake: $25.00\nGeelong\nHead to Head\n1.90");
  assert.equal(slip.stake_dollars, 25);
  assert.equal(slip.stake_mode, "dollars");
  assert.equal(Ocr.readStake(["Bet amount $10"], ""), 10);
  assert.equal(Ocr.readStake(["no money here"], ""), null);
});

test("a leg without a matched field stays open until it is filled or skipped", () => {
  const linked = {event: "Geelong v Carlton", selection: "Geelong", market: "Head to Head", kind: "team"};
  assert.equal(Ocr.legAutoLinked(linked), true);
  const open = {event: "Geelong v Carlton", selection: "Sam Darcy", market: "Disposals", kind: "player", line: null, flags: [{field: "line", reason: "No line found"}]};
  assert.equal(Ocr.legAutoLinked(open), false);
  const h2h = {event: "Geelong v Carlton", selection: "Geelong", market: "Head to Head", kind: "team", line: null};
  assert.equal(Ocr.legAutoLinked(h2h), true);
  assert.match(ui, /Skip matching/);
  assert.match(ui, /slip-leg-unmatched/);
  assert.match(ui, /stakeUnitsValue/);
  assert.match(ui, /\/api\/slip\/leg-note/);
  assert.match(ui, /STATE\.ops !== true/);
  assert.match(ui, /public-omit:slip-leg-note/);
  assert.match(ui, /data-mode="dollars"/);
  assert.match(ui, /Match each highlighted leg, or skip matching/);
  const unitSize = html.slice(html.indexOf("function guildUnitSize"), html.indexOf("function dollarsToUnits"));
  assert.match(unitSize, /followerServers/);
  assert.match(html, /slip-leg-unmatched/);
  assert.match(html, /stake-toggle/);
});
