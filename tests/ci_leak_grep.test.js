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

function run(dir, env = {}) {
  const merged = {
    ...process.env,
    PRIVATE_GUILD_IDS: "",
    TIPDASH_SCAN_TERMS: "",
    TIPDASH_SCAN_ID_1: "",
    GITHUB_ACTIONS: "",
    ...env,
  };
  for (const key of Object.keys(merged)) {
    if (merged[key] == null) delete merged[key];
  }
  return spawnSync(process.execPath, ["scripts/ci-leak-grep.mjs", dir], {
    cwd: root,
    encoding: "utf8",
    env: merged,
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

test("CI fails when PRIVATE_GUILD_IDS is empty or unset; local runs skip", () => {
  const dir = tree({ "index.html": "<p>Hello</p>\n" });
  try {
    for (const ids of ["", "  ,  ", undefined]) {
      const ci = run(dir, { GITHUB_ACTIONS: "true", PRIVATE_GUILD_IDS: ids });
      assert.notEqual(ci.status, 0);
      assert.match(ci.stderr, /PRIVATE_GUILD_IDS is empty or unset/);
      assert.doesNotMatch(ci.stdout + ci.stderr, /::notice::/);
      assert.doesNotMatch(ci.stdout, /leak grep ok/);
    }
    const local = run(dir, { GITHUB_ACTIONS: "", PRIVATE_GUILD_IDS: "" });
    assert.equal(local.status, 0, local.stderr);
    assert.match(local.stdout, /PRIVATE_GUILD_IDS not set/);
    const set = run(dir, { GITHUB_ACTIONS: "true", PRIVATE_GUILD_IDS: "111" });
    assert.equal(set.status, 0, set.stderr);
    assert.doesNotMatch(set.stdout + set.stderr, /111/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("leak grep fails if any built file still contains __TD_VERSION__", () => {
  const dir = tree({
    "index.html": "<p>ok</p>\n",
    "assets/extra.bin": "prefix __TD_VERSION__ suffix\n",
  });
  try {
    const r = run(dir, { PRIVATE_GUILD_IDS: "111" });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /assets\/extra\.bin/);
    assert.match(r.stderr, /unstamped __TD_VERSION__/);
    const out = r.stdout + r.stderr;
    assert.doesNotMatch(out, /prefix /);
    assert.doesNotMatch(out, /111/);
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
