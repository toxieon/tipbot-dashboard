// node --test tests/fx_live.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const BANNED = [
  /console\.(?:log|debug|info|warn|error|trace)\s*\(/,
  /\bowner-tools\b/,
  /\bcustom-games\b/,
  /\/api\/ops/,
  /\bops:/,
];
const SECRET_RE = /\b(?:forward|mirror|master|consensus)\b/gi;

function scanFile(rel) {
  const text = read(rel);
  for (const re of BANNED) {
    assert.doesNotMatch(text, re, rel + " must not match " + re);
  }
  const hits = text.match(SECRET_RE) || [];
  assert.deepEqual(hits, [], rel + " secret scan: " + hits.join(", "));
}

function makeCanvasEnv(reduced) {
  var rafIds = 0;
  var listeners = { visibilitychange: [] };
  var el = {
    clientWidth: 320,
    clientHeight: 200,
    children: [],
    firstChild: null,
    setAttribute: function () {},
    getBoundingClientRect: function () { return { width: 320, height: 200 }; },
    appendChild: function (c) {
      this.children.push(c);
      this.firstChild = c;
    },
    removeChild: function (c) {
      this.children = this.children.filter(function (x) { return x !== c; });
      this.firstChild = this.children[0] || null;
    },
  };
  function mockCtx() {
    return {
      save: function () {},
      restore: function () {},
      translate: function () {},
      scale: function () {},
      clearRect: function () {},
      fillRect: function () {},
      fillText: function () {},
      strokeRect: function () {},
      beginPath: function () {},
      closePath: function () {},
      moveTo: function () {},
      lineTo: function () {},
      quadraticCurveTo: function () {},
      ellipse: function () {},
      arc: function () {},
      fill: function () {},
      stroke: function () {},
      setTransform: function () {},
      lineCap: "",
      lineWidth: 1,
      fillStyle: "",
      strokeStyle: "",
      font: "",
      textAlign: "",
      textBaseline: "",
      createLinearGradient: function () {
        return { addColorStop: function () {} };
      },
    };
  }
  var canvas = {
    width: 0,
    height: 0,
    style: {},
    setAttribute: function () {},
    getContext: function () { return mockCtx(); },
  };
  var doc = {
    hidden: false,
    createElement: function (tag) {
      if (tag === "canvas") return canvas;
      return {};
    },
    addEventListener: function (ev, fn) {
      if (listeners[ev]) listeners[ev].push(fn);
    },
    removeEventListener: function (ev, fn) {
      if (!listeners[ev]) return;
      listeners[ev] = listeners[ev].filter(function (f) { return f !== fn; });
    },
  };
  var ctx = {
    setTimeout,
    clearTimeout,
    document: doc,
    devicePixelRatio: 1,
    performance: { now: function () { return 1000; } },
    requestAnimationFrame: function (f) {
      rafIds += 1;
      return rafIds;
    },
    cancelAnimationFrame: function () {},
    addEventListener: function () {},
    removeEventListener: function () {},
    matchMedia: function (q) {
      return { matches: reduced && q.indexOf("reduce") >= 0 };
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  return { ctx: ctx, el: el, doc: doc, listeners: listeners, canvas: canvas };
}

function loadFx(ctx, files) {
  for (const f of files) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
}

for (const rel of ["assets/fx/race-running.js", "assets/fx/afl-match.js"]) {
  test(rel + " passes content guards", () => scanFile(rel));
}

test("lab demo pages exist and reference FX scripts", () => {
  assert.ok(fs.existsSync(path.join(root, "labs/fx-live/index.html")));
  assert.match(read("labs/fx-live/race.html"), /assets\/fx\/race-running\.js/);
  assert.match(read("labs/fx-live/afl.html"), /assets\/fx\/afl-match\.js/);
});

test("TBLiveFx.race and stop in a browser-like VM", () => {
  const env = makeCanvasEnv(false);
  loadFx(env.ctx, ["assets/fx/race-running.js"]);
  assert.equal(typeof env.ctx.TBLiveFx.race, "function");
  assert.equal(typeof env.ctx.TBLiveFx.stop, "function");
  env.el.setAttribute = function (k, v) { this["_" + k] = v; };
  env.el.getAttribute = function (k) { return this["_" + k]; };
  const run = env.ctx.TBLiveFx.race(env.el, [{ number: 2, colours: ["#112233", "#aabbcc"] }]);
  assert.ok(run);
  assert.equal(env.el.getAttribute("data-tb-live-fx"), "race");
  assert.ok(env.listeners.visibilitychange.length > 0);
  env.ctx.TBLiveFx.stop();
  assert.equal(env.ctx.TBLiveFx._run, null);
});

test("TBLiveFx.afl paints and stop clears the run", () => {
  const env = makeCanvasEnv(false);
  loadFx(env.ctx, ["assets/fx/afl-match.js"]);
  assert.equal(typeof env.ctx.TBLiveFx.afl, "function");
  env.el.setAttribute = function (k, v) { this["_" + k] = v; };
  env.el.getAttribute = function (k) { return this["_" + k]; };
  const run = env.ctx.TBLiveFx.afl(env.el, { primary: "#001122", secondary: "#ffcc00" }, ["#aa0000", "#fff"]);
  assert.ok(run);
  assert.equal(env.el.getAttribute("data-tb-live-fx"), "afl");
  env.ctx.TBLiveFx.stop();
  assert.equal(env.ctx.TBLiveFx._run, null);
});

test("prefers-reduced-motion yields a static run (no rAF loop)", () => {
  const env = makeCanvasEnv(true);
  loadFx(env.ctx, ["assets/fx/race-running.js", "assets/fx/afl-match.js"]);
  const r = env.ctx.TBLiveFx.race(env.el, [{ number: 1, colours: { primary: "#333", secondary: "#eee" } }]);
  assert.ok(r && r.static);
  assert.equal(r.rafId, undefined);
  env.ctx.TBLiveFx.stop();
  const a = env.ctx.TBLiveFx.afl(env.el, { primary: "#111" }, { primary: "#222" });
  assert.ok(a && a.static);
});

test("race-running CommonJS helpers draw one frame without throw", () => {
  const R = require("../assets/fx/race-running.js");
  const horses = R.makeHorses([{ number: 5, colours: { primary: "#654", secondary: "#fff" } }]);
  assert.equal(horses[0].num, 5);
  const calls = [];
  const ctx = {
    save: function () { calls.push("save"); },
    restore: function () { calls.push("restore"); },
    translate: function () {},
    scale: function () {},
    clearRect: function () {},
    fillRect: function () {},
    fillText: function () {},
    strokeRect: function () {},
    beginPath: function () {},
    closePath: function () {},
    moveTo: function () {},
    lineTo: function () {},
    quadraticCurveTo: function () {},
    ellipse: function () {},
    arc: function () {},
    fill: function () {},
    stroke: function () {},
    setTransform: function () {},
    createLinearGradient: function () {
      return { addColorStop: function () {} };
    },
  };
  R.drawFrame(ctx, 320, 180, horses, 0, 0.1);
  assert.ok(calls.length > 0);
});

test("afl-match CommonJS helpers draw one frame without throw", () => {
  const A = require("../assets/fx/afl-match.js");
  const o = A.ovalRect(320, 200);
  assert.ok(o.rx > 0);
  const state = {
    players: [{ side: 0, cols: ["#111", "#eee"], ang: 0, dist: 0.5, phase: 0, role: "field" }],
    phase: "ground",
    ball: { x: o.cx, y: o.cy, r: 5, t: 0.3, x0: 0, x1: 0, y0: 0, y1: 0 },
    markT: 0,
    kickT: 0,
    kicker: -1,
    markSide: 0,
  };
  const ctx = {
    save: function () {},
    restore: function () {},
    translate: function () {},
    scale: function () {},
    fillRect: function () {},
    beginPath: function () {},
    moveTo: function () {},
    lineTo: function () {},
    ellipse: function () {},
    arc: function () {},
    fill: function () {},
    stroke: function () {},
    strokeRect: function () {},
    lineCap: "",
    lineWidth: 1,
    createLinearGradient: function () {
      return { addColorStop: function () {} };
    },
  };
  A.drawFrame(ctx, 320, 200, state, 0.4);
});

test("FX fixture PNGs exist (lab demo frames)", () => {
  for (const name of ["race-frame.png", "afl-frame.png"]) {
    const p = path.join(root, "tests/fixtures/fx", name);
    assert.ok(fs.existsSync(p), name);
    const buf = fs.readFileSync(p);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50);
    assert.ok(buf.length > 500, name + " should be non-trivial");
  }
});

test("headless Chrome can capture lab demo frames", {
  skip: !process.env.REGENERATE_FX_FRAMES || !fs.existsSync(process.env.CHROME_PATH || "/usr/local/bin/google-chrome"),
}, () => {
  const chrome = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
  const outDir = path.join(root, "tests/fixtures/fx");
  fs.mkdirSync(outDir, { recursive: true });
  for (const spec of [
    { page: "labs/fx-live/race.html", out: "race-frame.png", wait: 600 },
    { page: "labs/fx-live/afl.html", out: "afl-frame.png", wait: 700 },
  ]) {
    const url = "file://" + path.join(root, spec.page);
    const dest = path.join(outDir, spec.out);
    const res = spawnSync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--window-size=420,280",
      "--screenshot=" + dest,
      "--virtual-time-budget=" + String(spec.wait),
      url,
    ], { encoding: "utf8", timeout: 20000 });
    assert.equal(res.status, 0, spec.out + " capture failed: " + (res.stderr || res.stdout));
    assert.ok(fs.statSync(dest).size > 500);
  }
});
