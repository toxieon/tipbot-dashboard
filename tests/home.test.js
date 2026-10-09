const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const body = (name) => {
  const i = html.indexOf("function " + name + "(");
  assert.ok(i >= 0, name + " exists");
  return html.slice(i, html.indexOf("\n  }\n", i));
};

test("Home: single-server and single-follow users are not auto-jumped into detail", () => {
  const eh = body("enterHome");
  assert.doesNotMatch(eh, /admin\.length===1/);
  assert.doesNotMatch(eh, /follows\.length===1/);
  assert.match(eh, /renderOverview\(\);/);
});

test("Home: single-server users get Stats, Racing and a one-tap server card", () => {
  const ro = body("renderOverview");
  assert.match(ro, /if\(list\.length\|\|follows\.length\)\{/);
  assert.match(ro, /statsTile\.onclick=\(\)=>openStats\(\)/);
  assert.match(ro, /const racingSrv=racingBuildServer\(\);/);
  assert.match(ro, /list\.forEach\(s=>/);
  assert.match(ro, /c\.onclick=\(\)=>loadDetail\(s\.guild_id\)/);
  assert.match(ro, /c\.onclick=\(\)=>openFollowerView\(s\.guild_id,s\.display_name\)/);
  const rb = body("racingBuildServer");
  assert.match(rb, /if\(list\.length\) return list\[0\];/);
  assert.match(rb, /return follows\[0\]\|\|null;/);
});
