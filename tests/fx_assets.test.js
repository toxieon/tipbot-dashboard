const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const fxDir = path.join(root, "assets", "fx");

const PAIRS = [
  ["goal", "goal"],
  ["behind", "behind"],
  ["win", "win"],
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("fx assets exist for goal, behind, and win", () => {
  assert.ok(fs.existsSync(path.join(fxDir, "tb-match-fx.js")));
  for (const [, name] of PAIRS) {
    for (const ext of ["svg", "css", "js"]) {
      const p = path.join(fxDir, name + "." + ext);
      assert.ok(fs.existsSync(p), name + "." + ext);
      assert.ok(fs.statSync(p).size > 20, name + "." + ext + " non-empty");
    }
  }
  assert.ok(fs.existsSync(path.join(root, "labs", "fx", "index.html")));
  assert.ok(fs.existsSync(path.join(root, "docs", "fx.md")));
});

test("fx SVG and CSS are well-formed and respect reduced motion", () => {
  for (const [, name] of PAIRS) {
    const svg = fs.readFileSync(path.join(fxDir, name + ".svg"), "utf8");
    assert.match(svg, /^<svg[\s>]/);
    assert.match(svg, /<\/svg>\s*$/);
    const css = fs.readFileSync(path.join(fxDir, name + ".css"), "utf8");
    assert.match(css, /prefers-reduced-motion/);
  }
});

test("fx scripts register TBMatchFx methods without console noise", () => {
  for (const [method, name] of PAIRS) {
    const js = fs.readFileSync(path.join(fxDir, name + ".js"), "utf8");
    assert.doesNotMatch(js, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
    assert.match(js, /TBMatchFx/);
    const ctx = {
      document: {
        body: {},
        documentElement: {},
        createElement: function (tag) {
          return {
            tag: tag,
            className: "",
            classList: { add: function () {}, remove: function () {} },
            style: { setProperty: function () {} },
            setAttribute: function () {},
            appendChild: function () {},
            parentNode: null,
            querySelectorAll: function () {
              return [];
            },
            getAttribute: function () {
              return "";
            },
          };
        },
        getElementById: function () {
          return null;
        },
        querySelectorAll: function () {
          return [];
        },
      },
      matchMedia: function () {
        return { matches: true };
      },
      setTimeout: function () {},
      fetch: function () {
        return Promise.resolve({ ok: true, text: function () { return Promise.resolve("<svg></svg>"); } });
      },
      TBMatchFx: {},
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(js, ctx);
    assert.equal(typeof ctx.TBMatchFx[method], "function", name + ".js registers " + method);
  }
});

test("public build denies labs directory", async () => {
  const { DENY_DIRS } = await import("../scripts/build-public.mjs");
  assert.ok(DENY_DIRS.has("labs"));
});

test("dashboard app files are not wired to fx yet", () => {
  const html = read("index.html");
  const live = read("live/index.html");
  assert.doesNotMatch(html, /assets\/fx\//);
  assert.doesNotMatch(html, /TBMatchFx/);
  assert.doesNotMatch(live, /assets\/fx\//);
  assert.doesNotMatch(read("assets/theme-apex.js"), /TBMatchFx|tbfx-goal/);
});
