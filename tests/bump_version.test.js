// node --test tests/   Release stamp for the built site. Source keeps the placeholder.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const modP = import("../scripts/bump-version.mjs");

test("release version is VERSION plus a short sha, or the next patch", async () => {
  const { releaseVersion, nextPatch, shortSha } = await modP;
  assert.equal(shortSha("ABC1234DEADBEEF"), "abc1234");
  assert.equal(shortSha(""), "");
  assert.equal(nextPatch("0.66.4"), "0.66.5");
  assert.equal(nextPatch("1.2.9"), "1.2.10");
  assert.equal(releaseVersion("0.66.4", "abc1234ffff"), "0.66.4-abc1234");
  assert.equal(releaseVersion("0.66.4", ""), "0.66.5");
  assert.throws(() => releaseVersion("nope", ""), /x\.y\.z/);
});

test("stamp writes the built tree only", async () => {
  const { stampTree, PLACEHOLDER } = await modP;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tipdash-stamp-"));
  const page = path.join(dir, "index.html");
  fs.writeFileSync(page, '<script src="./assets/app.js?v=' + PLACEHOLDER + '"></script>\n<div>tipdash v' + PLACEHOLDER + "</div>\n");
  fs.mkdirSync(path.join(dir, "assets"));
  fs.writeFileSync(path.join(dir, "assets", "app.js"), 'TD.version="' + PLACEHOLDER + '";\n');
  fs.writeFileSync(path.join(dir, "VERSION"), "0.66.4\n");
  fs.writeFileSync(path.join(dir, "pic.png"), Buffer.from([0, 1, 2, 3]));
  const result = stampTree(dir, "0.66.4-abc1234");
  assert.equal(result.files, 2);
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /app\.js\?v=0\.66\.4-abc1234/);
  assert.match(html, /tipdash v0\.66\.4-abc1234/);
  assert.doesNotMatch(html, /__TD_VERSION__/);
  assert.match(fs.readFileSync(path.join(dir, "assets", "app.js"), "utf8"), /TD\.version="0\.66\.4-abc1234"/);
  assert.equal(fs.readFileSync(path.join(dir, "VERSION"), "utf8").trim(), "0.66.4-abc1234");
  assert.deepEqual(fs.readFileSync(path.join(dir, "pic.png")), Buffer.from([0, 1, 2, 3]));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("export prints the release version and does not edit source", async () => {
  const base = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  const before = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const r = spawnSync(process.execPath, ["scripts/bump-version.mjs", "--export"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GITHUB_SHA: "abc1234deadbeef" },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, "TIPDASH_RELEASE_VERSION=" + base + "-abc1234\n");
  assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8"), before);
});

test("public build applies the release version to dist and leaves source pages alone", async () => {
  const { build } = await import("../scripts/build-public.mjs");
  const { PLACEHOLDER } = await modP;
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "tipdash-rel-"));
  const source = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(source, new RegExp(PLACEHOLDER));
  try {
    build({ root, dist, release: "0.66.4-abc1234" });
    const built = fs.readFileSync(path.join(dist, "index.html"), "utf8");
    assert.doesNotMatch(built, new RegExp(PLACEHOLDER));
    assert.match(built, /TD\.version="0\.66\.4-abc1234"/);
    assert.match(built, /id="dd-version"[^>]*>tipdash v0\.66\.4-abc1234</);
    assert.match(built, /assets\/tbtime\.js\?v=0\.66\.4-abc1234/);
    const welcome = fs.readFileSync(path.join(dist, "welcome", "index.html"), "utf8");
    assert.match(welcome, /site\.css\?v=0\.66\.4-abc1234/);
    assert.equal(fs.readFileSync(path.join(dist, "VERSION"), "utf8").trim(), "0.66.4-abc1234");
    assert.equal(fs.readFileSync(path.join(root, "index.html"), "utf8"), source);
  } finally {
    fs.rmSync(dist, { recursive: true, force: true });
  }
});
