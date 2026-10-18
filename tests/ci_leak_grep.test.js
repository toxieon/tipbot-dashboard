// node --test tests/   Built-output leak grep. Hits name an index, never a secret value.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const modP = import("../scripts/ci-leak-grep.mjs");

function tree(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tipdash-leak-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

function run(dir, env) {
  return spawnSync(process.execPath, ["scripts/ci-leak-grep.mjs", dir], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PRIVATE_GUILD_IDS: "",
      TIPDASH_SCAN_TERMS: "",
      TIPDASH_SCAN_ID_1: "",
      ...env,
    },
  });
}

test("id lists split on commas and whitespace", async () => {
  const { parseIdList } = await modP;
  assert.deepEqual(parseIdList(" 111, 222\n333 "), ["111", "222", "333"]);
  assert.deepEqual(parseIdList('["444","555"]'), ["444", "555"]);
  assert.deepEqual(parseIdList(""), []);
});

test("a clean built tree passes and does not require private ids", () => {
  const dir = tree({
    "index.html": "<p>Hello</p>\n",
    "ok.css": ".a{color:#111;}\n",
  });
  try {
    const r = run(dir, {});
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /leak grep ok/);
    assert.match(r.stdout, /PRIVATE_GUILD_IDS not set/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a private id hit fails without printing the id", () => {
  const id = "4242424242424242";
  const other = "5151515151515151";
  const dir = tree({ "index.html": "<p>seen " + id + "</p>\n" });
  try {
    const r = run(dir, { PRIVATE_GUILD_IDS: other + "," + id });
    assert.notEqual(r.status, 0);
    const out = r.stdout + r.stderr;
    assert.doesNotMatch(out, new RegExp(id));
    assert.doesNotMatch(out, new RegExp(other));
    assert.match(r.stderr, /private id #2/);
    assert.match(r.stderr, /index\.html:1/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a guard term hit fails without printing the term", () => {
  const term = "zzsecretterm";
  const dir = tree({ "app.js": "const label = '" + term + "';\n" });
  try {
    const r = run(dir, { TIPDASH_SCAN_TERMS: term });
    assert.notEqual(r.status, 0);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(term));
    assert.match(r.stderr, /term #1/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
