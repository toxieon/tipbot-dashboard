// node --test tests/   Sportsbet link paste button (TipBot 0.72.1).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function fn(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " missing");
  let depth = 0, i = html.indexOf("{", start);
  for (; i < html.length; i++) { if (html[i] === "{") depth++; else if (html[i] === "}" && --depth === 0) break; }
  return html.slice(start, i + 1);
}

test("Sportsbet link is hidden unless the server feature is explicitly on", () => {
  const GUILD_FEATURES = {};
  const on = new Function("GUILD_FEATURES", fn("sportsbetLinkOn") + "; return sportsbetLinkOn;")(GUILD_FEATURES);
  assert.equal(on("1"), false);
  GUILD_FEATURES["1"] = { sportsbet_link: false };
  assert.equal(on("1"), false);
  GUILD_FEATURES["1"] = { sportsbet_link: true };
  assert.equal(on("1"), true);
});

test("button only on pending Sportsbet tips, posts to the paste endpoint", () => {
  assert.match(html, /const sbOn=!isSettled&&tid&&\/\^sportsbet\$\/i\.test/);
  assert.match(fn("pasteSportsbetLink"), /api\("\/api\/sportsbet\/paste",\{method:"POST"/);
  assert.match(html, /querySelectorAll\("\.sblink"\)/);
});

// Owner view: the Sportsbet link switch is listed under Owner, once.
{
  const test = require("node:test");
  const assert = require("node:assert");
  const fs = require("node:fs");
  const path = require("node:path");
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const src = html.slice(html.indexOf("  function ownerPlaceSportsbet(groups){"));
  const body = src.slice(0, src.indexOf("\n  }\n") + 4);
  const ownerPlaceSportsbet = new Function(body + "; return ownerPlaceSportsbet;")();
  test("owner sees the Sportsbet link switch in the Owner group", () => {
    const g = ownerPlaceSportsbet([{ name: "Tips", keys: ["feat.a", "feat.sportsbet_link"] }, { name: "Owner", keys: ["feat.god_settle"] }]);
    assert.deepStrictEqual(g, [{ name: "Tips", keys: ["feat.a"] }, { name: "Owner", keys: ["feat.sportsbet_link", "feat.god_settle"] }]);
  });
  test("admins (no Owner group) keep it under Tips", () => {
    const g = ownerPlaceSportsbet([{ name: "Tips", keys: ["feat.sportsbet_link"] }]);
    assert.deepStrictEqual(g, [{ name: "Tips", keys: ["feat.sportsbet_link"] }]);
  });
  test("an older bot without the flag adds nothing", () => {
    const g = ownerPlaceSportsbet([{ name: "Tips", keys: ["feat.a"] }, { name: "Owner", keys: ["feat.x"] }]);
    assert.deepStrictEqual(g[1].keys, ["feat.x"]);
  });
}
