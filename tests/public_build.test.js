// node --test tests/   Public site copy: allowlist, secret scan, unlinked pricing.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const vm = require("node:vm");

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
  const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
  assert.equal(fs.readFileSync(path.join(dist, "VERSION"), "utf8").trim(), version);
  for (const rel of [
    "CHANGELOG.md",
    "REMAINING.md",
    "VERSIONING.md",
    "master/index.html",
    "assets/consensus-ui.js",
    "assets/master-access.js",
    "assets/slip-ui.js",
    "assets/admin.js",
    "assets/ext.js",
    "assets/owner-tools.js",
    "tests/public_build.test.js",
    "GPT/index.html",
    "labs/fx/index.html",
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
  assert.match(dash, /function ensureExt/);
  assert.doesNotMatch(dash, /TD\.load\("ext"\)/);
  assert.doesNotMatch(dash, /owner-tools|\/api\/ops|custom-games|ops:/);
  assert.doesNotMatch(dash, /1553952007923040309/);

  // assets/ext.js is public on GitHub, so the program-owner panel is no longer
  // shipped here at all: the file must be gone, and nothing public may name it.
  assert.equal(fs.existsSync(path.join(root, "assets/ext.js")), false, "assets/ext.js must not exist in the repo");
  const extRefGrep = spawnSync("grep", ["-rl", "assets/ext.js", dist], { encoding: "utf8" });
  assert.equal((extRefGrep.stdout || "").trim(), "", "public files must not reference assets/ext.js");
  assert.doesNotMatch(dash, /id="dd-master"/);
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

  writeTree(dir, { "leak.js": 'console.warn("nope");\n' });
  assert.ok(scanTree(dir).some((p) => p.rel === "leak.js" && p.kind === "console"));

  writeTree(dir, { "leak.js": 'var label = "God mode";\n' });
  assert.ok(scanTree(dir).some((p) => p.rel === "leak.js" && p.kind === "owner-tool" && p.match === "God mode"));

  writeTree(dir, { "leak.js": 'fetch("/api/owner/import-tips");\n' });
  assert.ok(scanTree(dir).some((p) => p.kind === "owner-tool" && p.match === "/api/owner/import-tips"));

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

function extractFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("missing " + name);
  let i = src.indexOf("{", start);
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unclosed " + name);
}

test("custom games controls stay out of the public copy", async () => {
  const { build, scanTree } = await modP;
  const result = build({ root, dist: path.join(root, "dist") });
  assert.deepEqual(scanTree(result.dist), []);
  assert.equal(fs.existsSync(path.join(result.dist, "assets/ext.js")), false);
  assert.equal(fs.existsSync(path.join(result.dist, "assets/owner-tools.js")), false);
  const refusal = "Custom games aren't available in this server.";
  const leaks = ["owner-tools", "/api/ops", "custom-games", "ops:"];
  const banned = [
    /Allow custom games/,
    /Custom bet lines on fixture games still work when this is off/,
    /data-custom-games/,
    /cg-allow/,
  ];
  function walk(dir, relBase) {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const rel = relBase ? relBase + "/" + name : name;
      for (const needle of leaks) assert.equal(rel.indexOf(needle), -1, rel + " path contains " + needle);
      if (fs.statSync(abs).isDirectory()) { walk(abs, rel); continue; }
      const text = fs.readFileSync(abs).toString("latin1").split(refusal).join("");
      for (const needle of leaks) {
        const at = text.indexOf(needle);
        assert.equal(at, -1, rel + " contains " + needle + (at < 0 ? "" : " near " + JSON.stringify(text.slice(Math.max(0, at - 40), at + needle.length + 40))));
      }
      if (/\.(html|js|css|md|json|webmanifest|txt)$/.test(name)) {
        for (const re of banned) assert.doesNotMatch(text, re, rel);
      }
    }
  }
  walk(result.dist, "");

  const dash = fs.readFileSync(path.join(result.dist, "index.html"), "utf8");
  const builder = fs.readFileSync(path.join(result.dist, "assets/builder.js"), "utf8");
  const blocked = "Custom games aren't available in this server.";
  assert.match(dash, /<div id="ops" hidden><\/div>/);
  assert.match(builder, /Custom games aren't available in this server\./);
  const bctx = {};
  vm.createContext(bctx);
  vm.runInContext(extractFn(builder, "scheduleRefusal"), bctx);
  assert.equal(bctx.scheduleRefusal({ ok: false, message: blocked }, ""), blocked);
  assert.equal(bctx.scheduleRefusal({ ok: false, error: "bad_request", errors: ["tip 0: " + blocked] }, ""), blocked);
  assert.equal(bctx.scheduleRefusal({ ok: false, message: "Odds must be greater than 1." }, ""), "");
  assert.equal(bctx.scheduleRefusal(null, ""), "");
  const failAt = builder.indexOf("function failMsg");
  const doAt = builder.indexOf("async function doSchedule");
  assert.ok(failAt > 0 && builder.indexOf("scheduleRefusal(j, raw)", failAt) < builder.indexOf("Couldn't schedule batch", failAt));
  assert.ok(doAt > 0 && builder.indexOf("scheduleRefusal(j, raw)", doAt) < builder.indexOf("Couldn't schedule.", doAt));

  const open = extractFn(dash, "openOps");
  assert.match(open, /TBOwner\.paintOps/);
  assert.match(open, /ensureExt/);
  assert.doesNotMatch(dash, /TD\.load\("ext"\)/);
  assert.doesNotMatch(open, /\/api\/ops\/custom-games|Allow custom games|whitelist|data-custom-games/);
});
