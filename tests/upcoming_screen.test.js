// node --test tests/   Upcoming is a real screen: panel list, deep links, no bounce to detail.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const apexJs = fs.readFileSync(path.join(__dirname, "..", "assets", "theme-apex.js"), "utf8");

test("panel() includes upcoming so the screen can unhide", () => {
  const m = html.match(/const panel=p=>\{for\(const x of (\[[^\]]*\])\)/);
  assert.ok(m, "panel() fixed list not found");
  const list = JSON.parse(m[1]);
  for (const id of ["overview","detail","followers","follower","mytips","discover","builder","upcoming","settings","ops"]) assert.ok(list.includes(id), id);
});

test("deep links open Upcoming instead of the server page", () => {
  assert.match(html, /if\(m\[2\]==="upcoming"\) return openUpcoming\(gid,nm\), true;/);
  assert.match(html, /if\(m\[0\]==="upcoming"\) return openUpcomingHome\(\), true;/);
});

test("openUpcoming stays on Upcoming and loads queued tips (no bounce to loadDetail)", () => {
  const start = html.indexOf("function openUpcoming(guildId, name)");
  assert.ok(start > 0, "openUpcoming missing");
  const body = html.slice(start, start + 2800);
  assert.match(body, /panel\("upcoming"\)/);
  assert.match(body, /loadUpcoming\(guildId,/);
  assert.doesNotMatch(body, /if\s*\(\s*!STATE\._upcSeq\s*\)/);
  assert.doesNotMatch(body, /if\s*\(\s*!STATE\._upcSeq/);
  assert.match(body, /upc-retry/);
  assert.match(body, /Couldn\\'t load upcoming bets/);
  assert.match(body, /Couldn\\'t reach the bot/);
});

test("no-servers Upcoming has an empty state and a window opener for the tab bar", () => {
  assert.match(html, /function openUpcomingHome\(\)/);
  assert.match(html, /No upcoming bets/);
  assert.match(html, /window\.TBOpenUpcoming=openUpcomingHome;/);
  assert.match(apexJs, /typeof root\.TBOpenUpcoming === "function"/);
});

test("openUpcomingHome prefers an in-progress Build server before the empty state", () => {
  assert.match(html, /function openUpcomingHome\(\)\{[\s\S]{0,220}if\(BUILD&&BUILD\.guildId\) return openUpcoming\(BUILD\.guildId, BUILD\.serverName\)/);
});

test("navRoute wires #\/upcoming and #\/s\/<gid>\/upcoming", () => {
  assert.match(html, /if\(m\[2\]==="upcoming"\) return openUpcoming\(gid,nm\), true;/);
  assert.match(html, /if\(m\[0\]==="upcoming"\) return openUpcomingHome\(\), true;/);
});
