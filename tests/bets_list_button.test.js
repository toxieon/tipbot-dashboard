// Server page: owners and admins can have TipBot DM them the bets list.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("the button shows only for server owners and admins, and posts to the bot", () => {
  assert.match(html, /\(s\.can_admin&&!STATE\.viewAs\)\?'<button type="button" class="ghost" id="betslistbtn"/);
  assert.match(html, /✉ DM me today\\'s bets<\/button>/);
  assert.doesNotMatch(html, /DM me the bets list/);
  assert.match(html, /title="TipBot DMs you only the bets logged today \(Sydney time\) in this server, ready to copy"/);
  assert.match(html, /\{ const bl=\$\("betslistbtn"\); if\(bl\) bl\.onclick=\(\)=>dmBetsList\(bl\); \}/);
  assert.match(html, /api\("\/api\/bets-list\/dm",\{method:"POST"/);
  assert.match(html, /if\(r\.status===404\) note="Only this server's owner and admins can do this\.";/);
});

test("the server page script still parses", () => {
  const line = html.split("\n").find((l) => l.includes('id="betslistbtn"'));
  assert.ok(line);
  // The label sits inside a single-quoted JS string, so its apostrophe must be escaped.
  assert.doesNotMatch(line, /[^\\]today's/);
});
