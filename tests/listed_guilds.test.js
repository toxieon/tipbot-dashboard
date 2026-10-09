const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("server and follow lists pass through listedOnly", () => {
  assert.match(html, /STATE\.servers=listedOnly\(data\.servers\);/);
  assert.match(html, /STATE\.followerServers=listedOnly\(data\.follower_servers\);/);
  assert.match(html, /STATE\.servers=full\.servers\?listedOnly\(full\.servers\)/);
  assert.match(html, /STATE\.followerServers=full\.follower_servers\?listedOnly\(full\.follower_servers\)/);
  assert.doesNotMatch(html, /STATE\.(servers|followerServers)=(data|full)\.(servers|follower_servers)\|\|/);
});

test("listedOnly drops guilds flagged hidden or unlisted", () => {
  const src = html.match(/function listedOnly\(a\)\{[^\n]*\}/)[0];
  const listedOnly = new Function(src + "; return listedOnly;")();
  const out = listedOnly([
    { guild_id: "1", display_name: "A" },
    { guild_id: "2", hidden: true },
    { guild_id: "3", listed: false },
    null,
    { display_name: "no id" },
  ]);
  assert.deepEqual(out.map((s) => s.guild_id), ["1"]);
  assert.deepEqual(listedOnly(undefined), []);
});
