const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const fxDir = path.join(root, "assets", "fx");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function makeSvgEl() {
  return {
    setAttribute: function () {},
    appendChild: function () {},
    innerHTML: "",
    parentNode: null,
  };
}

function makeHost() {
  return {
    nodeType: 1,
    classList: { add: function () {}, remove: function () {} },
    style: {},
    appendChild: function () {},
  };
}

function bootCtx(extra) {
  var ctx = {
    document: {
      hidden: false,
      body: {},
      documentElement: {},
      createElement: function (tag) {
        return {
          tagName: tag,
          className: "",
          classList: { add: function () {}, remove: function () {} },
          style: { cssText: "", position: "", minHeight: "" },
          setAttribute: function () {},
          appendChild: function () {},
          parentNode: null,
        };
      },
      createElementNS: function (ns, tag) {
        var el = makeSvgEl();
        el.tagName = tag;
        el.appendChild = function (c) {};
        return el;
      },
      addEventListener: function () {},
      removeEventListener: function () {},
    },
    matchMedia: function (q) {
      return { matches: q.indexOf("reduce") >= 0 ? false : false };
    },
    requestAnimationFrame: function (fn) {
      return 1;
    },
    cancelAnimationFrame: function () {},
    performance: { now: function () { return 0; } },
    setTimeout: function () {},
    clearTimeout: function () {},
    TBLiveFx: {},
  };
  ctx.window = ctx;
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  return ctx;
}

test("live fx assets exist and lab page is present", () => {
  assert.ok(fs.existsSync(path.join(fxDir, "tb-live-fx.js")));
  assert.ok(fs.existsSync(path.join(fxDir, "race-running.js")));
  assert.ok(fs.existsSync(path.join(fxDir, "afl-match.js")));
  assert.ok(fs.existsSync(path.join(root, "labs", "fx-live", "index.html")));
});

test("live fx scripts honour reduced motion and tab visibility", () => {
  for (const name of ["race-running.js", "afl-match.js"]) {
    const js = fs.readFileSync(path.join(fxDir, name), "utf8");
    assert.match(js, /prefers-reduced-motion/);
    assert.match(js, /visibilitychange/);
    assert.doesNotMatch(js, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  }
});

test("live fx registers TBLiveFx.race, afl, and stop", () => {
  const ctx = bootCtx();
  vm.runInContext(read("assets/fx/tb-live-fx.js"), ctx);
  vm.runInContext(read("assets/fx/race-running.js"), ctx);
  vm.runInContext(read("assets/fx/afl-match.js"), ctx);
  assert.equal(typeof ctx.TBLiveFx.stop, "function");
  assert.equal(typeof ctx.TBLiveFx.race, "function");
  assert.equal(typeof ctx.TBLiveFx.afl, "function");
  ctx.TBLiveFx.race(makeHost(), [{ number: 3, colours: "red, white" }]);
  assert.ok(ctx.TBLiveFx._session);
  ctx.TBLiveFx.stop();
  assert.equal(ctx.TBLiveFx._session, null);
  ctx.TBLiveFx.afl(makeHost(), ["#111", "#fff"], { primary: "#E5484D", secondary: "#fff" });
  ctx.TBLiveFx.stop();
});

test("race colour parsing uses runner saddlecloth colours", () => {
  const Race = require("../assets/fx/race-running.js");
  const pair = Race.parsePair({ number: 2, colours: "blue, white" }, 0);
  assert.equal(pair[0], "#5B8CFF");
  assert.equal(pair[1], "#F5F7FA");
});

test("dashboard app files are not wired to live fx yet", () => {
  const html = read("index.html");
  const live = read("live/index.html");
  assert.doesNotMatch(html, /race-running\.js|afl-match\.js|TBLiveFx/);
  assert.doesNotMatch(live, /race-running\.js|afl-match\.js|TBLiveFx/);
});
