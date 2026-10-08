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
    "assets/owner-tools.js",
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
  assert.equal(fs.existsSync(path.join(result.dist, "assets/owner-tools.js")), false);
  const banned = [
    /\/api\/ops\/custom-games/,
    /Allow custom games/,
    /Custom bet lines on fixture games still work when this is off/,
    /data-custom-games/,
    /cg-allow/,
    /custom-games\/whitelist/,
  ];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (fs.statSync(abs).isDirectory()) { walk(abs); continue; }
      if (!/\.(html|js|css|md|json|webmanifest|txt)$/.test(name)) continue;
      const text = fs.readFileSync(abs, "utf8");
      for (const re of banned) assert.doesNotMatch(text, re, abs);
    }
  }
  walk(result.dist);

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

  const tools = fs.readFileSync(path.join(root, "assets/owner-tools.js"), "utf8");
  const load = extractFn(tools, "loadCustomGames");
  const post = extractFn(tools, "postCustomGames");
  assert.ok(load.indexOf("STATE.ops!==true") >= 0);
  assert.ok(load.indexOf("STATE.ops!==true") < load.indexOf("/api/ops/custom-games"));
  assert.ok(post.indexOf("STATE.ops!==true") < post.indexOf("api(path"));
  assert.match(tools, /postCustomGames\("\/api\/ops\/custom-games", \{enabled:on\}\)/);
  assert.match(post, /JSON\.stringify\(body\)/);
  assert.match(tools, /\{guild_id:gid, allow:true\}/);
  assert.match(tools, /\{guild_id:gid, allow:false\}/);
  assert.match(tools, /Custom bet lines on fixture games still work when this is off\./);
  const open = extractFn(dash, "openOps");
  assert.match(open, /TBOwner\.paintOps/);
  assert.match(open, /ensureOwnerTools/);
  assert.doesNotMatch(open, /\/api\/ops\/custom-games|Allow custom games|whitelist|data-custom-games/);

  const calls = [];
  const opsBox = { innerHTML: "sentinel" };
  const status = { textContent: "", className: "" };
  const ctx = {
    STATE: { ops: false },
    TD: { loaded: {} },
    esc(s) { return String(s == null ? "" : s); },
    $(id) { return id === "ops" ? opsBox : (id === "cg-status" ? status : { disabled: false }); },
    api() { calls.push([].slice.call(arguments)); return Promise.resolve({ status: 200, ok: true, json: async () => ({}) }); },
    renderLogin() {},
    document: {
      getElementById() { return null; },
      createElement() { return { id: "", textContent: "" }; },
      head: { appendChild() {} },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(tools, ctx);
  const owner = ctx.TBOwner;
  const slot = {
    innerHTML: "stale",
    textContent: "",
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  await owner.loadCustomGames(slot);
  assert.equal(calls.length, 0, "non-owner must not request custom games");
  assert.equal(slot.innerHTML, "");
  owner.paintOps(opsBox);
  assert.equal(calls.length, 0);

  ctx.STATE.ops = true;
  const sample = {
    ok: true,
    enabled: true,
    whitelist: [{ guild_id: "1546102020732100658", name: "Tip2" }, { guild_id: "99", name: null }],
  };
  const html = owner.customGamesPanelHTML(sample, null);
  assert.match(html, /aria-label="Allow custom games"/);
  assert.match(html, /aria-checked="true"/);
  assert.match(html, /class="toggle on"/);
  assert.match(html, />Tip2</);
  assert.match(html, /1546102020732100658/);
  assert.match(html, /aria-label="Remove Tip2"/);
  assert.match(html, />99</);
  assert.equal((html.match(/cg-id/g) || []).length, 1);
  assert.match(html, /Add a server/);
  assert.match(html, /placeholder="Server id"/);
  assert.match(html, /Custom bet lines on fixture games still work when this is off\./);
  assert.doesNotMatch(html, /forward|mirror|master|consensus/i);

  const off = owner.customGamesPanelHTML({ ok: true, enabled: false, whitelist: [] }, { kind: "err", text: "Couldn't update custom games." });
  assert.match(off, /aria-checked="false"/);
  assert.doesNotMatch(off, /class="toggle on"/);
  assert.match(off, /cg-status err/);
  assert.match(off, /No servers yet/);

  let posted = null;
  ctx.api = async function (path, opts) {
    posted = { path, body: opts && opts.body ? JSON.parse(opts.body) : null, method: opts && opts.method };
    calls.push(path);
    return {
      status: 200,
      ok: true,
      async json() {
        return { ok: true, enabled: false, whitelist: sample.whitelist };
      },
    };
  };
  const live = {
    innerHTML: "",
    textContent: "",
    querySelector() { return { onclick: null }; },
    querySelectorAll() { return []; },
  };
  await owner.setCustomGamesEnabled(false, live);
  assert.equal(posted.path, "/api/ops/custom-games");
  assert.equal(posted.method, "POST");
  assert.equal(typeof posted.body.enabled, "boolean");
  assert.equal(posted.body.enabled, false);
  assert.match(live.innerHTML, /Custom games are off/);
  assert.match(live.innerHTML, /cg-status ok/);

  await owner.addCustomGameServer("1546102020732100658", live);
  assert.equal(posted.path, "/api/ops/custom-games/whitelist");
  assert.equal(posted.body.allow, true);
  assert.equal(typeof posted.body.allow, "boolean");
  assert.equal(posted.body.guild_id, "1546102020732100658");
  assert.match(live.innerHTML, /Added Tip2/);

  await owner.removeCustomGameServer("1546102020732100658", "Tip2", live);
  assert.equal(posted.body.allow, false);
  assert.equal(typeof posted.body.allow, "boolean");
  assert.match(live.innerHTML, /Removed Tip2/);

  ctx.api = async function () {
    return { status: 404, ok: false, async json() { return { ok: false, error: "not_found" }; } };
  };
  live.innerHTML = "<section data-custom-games>controls</section>";
  await owner.loadCustomGames(live);
  assert.equal(live.innerHTML, "");
  assert.doesNotMatch(live.innerHTML, /Allow custom games/);
});
