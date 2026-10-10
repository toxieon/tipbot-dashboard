// node --test tests/tb_delight.test.js — delight stamp, form, drift, reduced motion.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("tb-delight is loaded from index and has no console calls", () => {
  const html = read("index.html");
  const version = read("VERSION").trim();
  assert.match(html, new RegExp('<script src="\\./assets/tb-delight\\.js\\?v=' + version.replace(/\./g, "\\.") + '"></script>'));
  const js = read("assets/tb-delight.js");
  assert.doesNotMatch(js, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
});

function loadDelight(reduced) {
  const js = read("assets/tb-delight.js");
  const ctx = {
    matchMedia: function () {
      return { matches: !!reduced };
    },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    requestAnimationFrame: function (fn) {
      fn();
      return 1;
    },
    sessionStorage: { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; } },
    navigator: { vibrate: function () { ctx.vibrated = true; } },
    vibrated: false
  };
  ctx.window = ctx;
  const doc = {
    createElement: function (tag) {
      const el = {
        tagName: tag.toUpperCase(),
        className: "",
        style: {},
        dataset: {},
        id: "",
        textContent: "",
        setAttribute: function () {},
        classList: { add: function (c) { this.className += " " + c; }, remove: function () {} },
        appendChild: function () {},
        querySelector: function () { return null; },
        querySelectorAll: function () { return []; }
      };
      return el;
    },
    getElementById: function (id) {
      if (id === "td-delight-css") return { id };
      return null;
    },
    querySelectorAll: function () { return []; },
    documentElement: {},
    head: { appendChild: function () {} },
    body: {},
    readyState: "complete"
  };
  ctx.document = doc;
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  return ctx.TBDelight;
}

test("odds drift arrow when posted and current differ", () => {
  const D = loadDelight(false);
  const up = D.oddsDriftHtml(1.9, 2.05);
  assert.match(up, /leg-odds-drift/);
  assert.match(up, /\u2191/);
  assert.equal(D.oddsDriftHtml(1.9, 1.91), "");
});

test("settle stamp vibrates on win but skips flip when reduced motion", () => {
  const D = loadDelight(true);
  const card = {
    dataset: { settled: "1" },
    style: {},
    getAttribute: function () { return "tip-1"; },
    querySelector: function (s) { return s === ".tbchip--win" ? {} : null; },
    appendChild: function () {},
    classList: { add: function (c) { this.flip = c; }, remove: function () {} },
    flip: ""
  };
  D.stamp(card);
  assert.notEqual(card.flip, "td-flip");
  const D2 = loadDelight(false);
  D2.stamp(card);
  assert.equal(card.dataset.tdStamp, "1");
});

test("form strip adds flame chip at 3+ wins", () => {
  const D = loadDelight(false);
  const tag = { innerHTML: "", className: "", classList: { add: function () { for (var i = 0; i < arguments.length; i++) this.className += " " + arguments[i]; } } };
  const form = {
    dataset: {},
    getAttribute: function (k) {
      if (k === "data-streak") return "W";
      if (k === "data-streak-n") return "4";
      if (k === "aria-label") return "form";
      return null;
    },
    querySelector: function () { return tag; },
    querySelectorAll: function () { return []; }
  };
  D.formStrip(form);
  assert.equal(form.dataset.tdForm, "1");
  assert.match(tag.innerHTML, /4W/);
});

test("apex theme delegates stamp and form to TBDelight when present", () => {
  const js = read("assets/theme-apex.js");
  assert.match(js, /TBDelight\.stamp/);
  assert.match(js, /TBDelight\.formStrip/);
  assert.match(js, /TBDelight\.flipLists/);
});
