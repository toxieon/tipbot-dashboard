// node --test tests/   Optional CI secret: master guild id must not ship in the dashboard.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("when TIPDASH_MASTER_GUILD_ID is set, it is not in index.html or app JS", () => {
  const id = process.env.TIPDASH_MASTER_GUILD_ID;
  if (!id) return;
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotMatch(html, new RegExp(id));
  const assetsDir = path.join(root, "assets");
  for (const name of fs.readdirSync(assetsDir)) {
    if (!/\.js$/.test(name)) continue;
    const text = fs.readFileSync(path.join(assetsDir, name), "utf8");
    assert.doesNotMatch(text, new RegExp(id), name);
  }
});
