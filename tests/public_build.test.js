// node --test tests/   Public site copy: allowlist, secret scan, unlinked pricing.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const modP = import("../scripts/build-public.mjs");

function writeTree(dir, files) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
}

test("public build copies the allowlist and refuses secret terms", async () => {
  const { build, scanTree, SECRET_ALLOW, PRICE_EXEMPT } = await modP;
  const result = build({ root, dist: path.join(root, "dist") });
  assert.ok(result.count > 10);
  const dist = result.dist;
  for (const rel of [
    "index.html",
    "404.html",
    "CNAME",
    "VERSION",
    "PUBLIC_CHANGELOG.md",
    ".nojekyll",
    "manifest.webmanifest",
    "pricing/index.html",
    "assets/site/checkout.js",
    "welcome/index.html",
    "t/index.html",
  ]) {
    assert.ok(fs.existsSync(path.join(dist, rel)), rel);
  }
  assert.equal(fs.readFileSync(path.join(dist, "CNAME"), "utf8").trim(), "tipdashhq.com");
  assert.equal(fs.readFileSync(path.join(dist, "VERSION"), "utf8").trim(), "0.48.1");
  for (const rel of [
    "CHANGELOG.md",
    "REMAINING.md",
    "VERSIONING.md",
    "master/index.html",
    "assets/consensus-ui.js",
    "assets/master-access.js",
    "assets/slip-ui.js",
    "tests/public_build.test.js",
    "GPT/index.html",
  ]) {
    assert.equal(fs.existsSync(path.join(dist, rel)), false, rel + " must not ship");
  }
  assert.deepEqual(scanTree(dist), []);
  assert.ok(SECRET_ALLOW.some((r) => r.name === "css-animation-fill-forwards"));
  assert.ok(SECRET_ALLOW.some((r) => r.name === "straightforward"));
  assert.ok(PRICE_EXEMPT.has("pricing/index.html"));
  assert.ok(PRICE_EXEMPT.has("assets/site/checkout.js"));

  const grep = spawnSync("grep", ["-riE", "forward|mirror|master|consensus", dist], { encoding: "utf8" });
  assert.equal(grep.status, 0, "expected CSS forwards (and only the allow-list) to match");
  const lines = grep.stdout.split("\n").filter(Boolean);
  assert.ok(lines.length > 0);
  for (const line of lines) {
    assert.match(line, /forwards\b/, "unexpected secret match: " + line);
    assert.doesNotMatch(line, /forwarded|forwarding|\bmaster\b|\bmirror\b|\bconsensus\b/i);
  }

  for (const rel of ["welcome/index.html", "t/index.html", "404.html", "index.html"]) {
    const html = fs.readFileSync(path.join(dist, rel), "utf8");
    assert.doesNotMatch(html, /href\s*=\s*["']\/pricing\/["']/);
    assert.doesNotMatch(html, /A\$[0-9]/);
  }
  for (const rel of ["welcome/index.html", "t/index.html", "404.html"]) {
    const html = fs.readFileSync(path.join(dist, rel), "utf8");
    assert.doesNotMatch(html, />Home</);
  }
  const dash = fs.readFileSync(path.join(dist, "index.html"), "utf8");
  assert.match(dash, /id="nav-ops"[^>]*hidden>Admin tools</);
  assert.match(dash, /ops===true/);
  assert.match(dash, /\/api\/ops\/ui\.css/);
  assert.match(dash, /\/api\/ops\/ui\.js/);
  assert.match(dash, /credentials:"include"/);
  assert.match(dash, /TipOps\.mount\(container,\{apiBase:API\}\)/);
  assert.doesNotMatch(dash, /id="dd-master"/);
  assert.doesNotMatch(dash, /1553952007923040309/);
});

test("scanner keeps only the explicit allow-list and fails closed otherwise", async () => {
  const { scanTree } = await modP;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tipdash-scan-"));
  writeTree(dir, {
    "ok.css": ".a{animation:spin .5s ease-out forwards;} .b{animation-fill-mode: forwards;}",
    "ok.js": 'el.style.animation = "pop .3s ease forwards";',
    "word.html": "<p>Straightforward</p>",
    "pricing/index.html": '<a href="/pricing/">A$3</a>',
    "assets/site/checkout.js": 'return "A$8";',
  });
  assert.deepEqual(scanTree(dir).map((p) => p.rel + ":" + p.kind), []);

  writeTree(dir, {
    "bad.html": "<p>master server</p>",
  });
  const secret = scanTree(dir);
  assert.ok(secret.some((p) => p.rel === "bad.html" && p.kind === "secret" && /master/i.test(p.match)));

  writeTree(dir, { "bad.html": "<p>Straightforward work, then forwarded.</p>" });
  const forwarded = scanTree(dir);
  assert.ok(forwarded.some((p) => p.kind === "secret" && /forward/i.test(p.match)));
  assert.equal(forwarded.filter((p) => p.rel === "bad.html").length, 1);

  writeTree(dir, { "bad.html": '<a href="/pricing/">plans</a>' });
  assert.ok(scanTree(dir).some((p) => p.kind === "pricing-link"));

  writeTree(dir, { "welcome/index.html": "<p>From A$2.42</p>" });
  assert.ok(scanTree(dir).some((p) => p.rel === "welcome/index.html" && p.kind === "aud-price"));

  fs.rmSync(dir, { recursive: true, force: true });
});

test("--scan exits non-zero when a secret word is present", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tipdash-scan-cli-"));
  fs.writeFileSync(path.join(dir, "note.txt"), "consensus preview\n");
  const r = spawnSync(process.execPath, ["scripts/build-public.mjs", "--scan", dir], {
    cwd: root, encoding: "utf8",
  });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /consensus/);
  fs.writeFileSync(path.join(dir, "note.txt"), "animation: fade .2s ease-out forwards;\n");
  const ok = spawnSync(process.execPath, ["scripts/build-public.mjs", "--scan", dir], {
    cwd: root, encoding: "utf8",
  });
  assert.equal(ok.status, 0, ok.stderr);
  fs.rmSync(dir, { recursive: true, force: true });
});
