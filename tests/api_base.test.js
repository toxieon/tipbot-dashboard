// node --test tests/   P0 guard: the dashboard must call TipBot, not its own origin.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("index.html API base points at TipBot", () => {
  assert.match(html, /const API="https:\/\/afl-tipster-bot\.onrender\.com";/);
  assert.doesNotMatch(html, /const API="";/);
});
