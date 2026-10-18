// node --test tests/   public-site publish appends a commit and does not rewrite history.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const script = path.join(root, "scripts", "publish-public-site.sh");

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function publish(dist, remote) {
  const env = { ...process.env, PUBLIC_SITE_REMOTE: remote, PUBLIC_SITE_BRANCH: "public-site" };
  delete env.GITHUB_TOKEN;
  delete env.GIT_ASKPASS;
  delete env.GITHUB_REPOSITORY;
  return spawnSync("bash", [script, dist], { cwd: root, encoding: "utf8", env });
}

test("the publish script does not rewrite history", () => {
  const src = fs.readFileSync(script, "utf8");
  assert.match(src, /push origin "HEAD:\$\{branch\}"/);
  assert.doesNotMatch(src, /--force/);
});

test("publish updates an existing branch and leaves an unchanged tree", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tipdash-pub-"));
  const bare = path.join(tmp, "bare.git");
  const seed = path.join(tmp, "seed");
  const dist = path.join(tmp, "dist");
  try {
    git(["init", "--bare", "-b", "public-site", bare]);
    git(["init", "-b", "public-site", seed]);
    git(["config", "user.email", "test@example.com"], seed);
    git(["config", "user.name", "Test"], seed);
    fs.writeFileSync(path.join(seed, "VERSION"), "0.0.1\n");
    fs.writeFileSync(path.join(seed, "index.html"), "old\n");
    git(["add", "-A"], seed);
    git(["commit", "-m", "seed"], seed);
    git(["remote", "add", "origin", bare], seed);
    git(["push", "-u", "origin", "public-site"], seed);

    fs.mkdirSync(dist);
    fs.writeFileSync(path.join(dist, "VERSION"), "0.66.4-abc1234\n");
    fs.writeFileSync(path.join(dist, "index.html"), "new\n");
    fs.writeFileSync(path.join(dist, ".nojekyll"), "");

    const first = publish(dist, bare);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stdout, /public-site updated \(0\.66\.4-abc1234\)/);

    const check = path.join(tmp, "check");
    git(["clone", "--branch", "public-site", bare, check]);
    assert.equal(fs.readFileSync(path.join(check, "index.html"), "utf8"), "new\n");
    assert.equal(fs.readFileSync(path.join(check, "VERSION"), "utf8").trim(), "0.66.4-abc1234");
    assert.equal(fs.readFileSync(path.join(check, ".nojekyll"), "utf8"), "");
    assert.equal(fs.existsSync(path.join(check, "seed-only")), false);

    const again = publish(dist, bare);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /already matches/);

    fs.writeFileSync(path.join(dist, "index.html"), "newer\n");
    const third = publish(dist, bare);
    assert.equal(third.status, 0, third.stderr);
    const subjects = git(["--git-dir", bare, "log", "--format=%s", "public-site"]).split("\n");
    assert.deepEqual(subjects, ["Publish 0.66.4-abc1234", "Publish 0.66.4-abc1234", "seed"]);
    const parents = git(["--git-dir", bare, "rev-parse", "public-site^"]);
    const previous = git(["--git-dir", bare, "rev-parse", "public-site~1"]);
    assert.equal(parents, previous);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
