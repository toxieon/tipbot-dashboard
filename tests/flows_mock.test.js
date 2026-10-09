// node --test tests/   Theme persistence, perf guards, lazy-load markup.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const HTML = read("index.html");

test("theme persistence: five Apex variants plus legacy navy/day/ochre", () => {
  const moduleStart = HTML.indexOf("var names = ['apex', 'apex-light', 'apex-oled', 'apex-mono', 'apex-ochre', 'navy', 'day', 'ochre'];");
  const moduleEnd = HTML.indexOf("}());", moduleStart);
  const themeMod = HTML.substring(HTML.lastIndexOf("(function () {", moduleStart), moduleEnd + 5);
  const store = {};
  const root = { dataset: {}, style: { setProperty() {}, removeProperty() {} } };
  const mockEnv = {
    window: { matchMedia: () => ({ matches: false, addEventListener: () => {} }), addEventListener: () => {} },
    document: {
      documentElement: root,
      addEventListener: () => {},
      querySelector: () => ({ setAttribute: () => {}, getAttribute: () => null }),
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
      head: { appendChild: () => {} },
      hidden: false,
      startViewTransition: (cb) => { cb(); },
    },
    localStorage: {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    },
    TBTime: { dayKey: () => "mock", isDaytime: () => true, hour: () => 12, msUntilHour: () => 1000 },
    setTimeout: () => 1, clearTimeout: () => {}, Date: Date,
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
  };
  mockEnv.TB = {};
  mockEnv.window.TB = mockEnv.TB;
  vm.createContext(mockEnv);
  vm.runInContext("var root = document.documentElement; function esc(s){return s;} " + themeMod, mockEnv);

  const cases = [
    ["apex", { theme: "apex", variant: undefined }],
    ["apex-light", { theme: "apex", variant: "light" }],
    ["apex-oled", { theme: "apex", variant: "oled" }],
    ["apex-mono", { theme: "apex", variant: "mono" }],
    ["apex-ochre", { theme: "apex", variant: "ochre" }],
    ["navy", { theme: "navy", variant: undefined }],
    ["day", { theme: "day", variant: undefined }],
    ["ochre", { theme: "ochre", variant: undefined }],
  ];
  for (const [name, expect] of cases) {
    mockEnv.TB.theme.set(name);
    assert.equal(store.tipbot_theme, name, name + " stored");
    assert.equal(root.dataset.theme, expect.theme, name + " data-theme");
    if (expect.variant) assert.equal(root.dataset.apexVariant, expect.variant, name + " variant");
    else assert.equal(root.dataset.apexVariant, undefined, name + " no variant");
  }
});

test("apex resize handler is rAF-coalesced (perf)", () => {
  const js = read("assets/theme-apex.js");
  assert.match(js, /resizeQueued/);
  assert.match(js, /root\.addEventListener\("resize", function \(\) \{[\s\S]{0,220}raf\(function \(\)/);
});

test("lazy images: follower avatars and bookie marks defer loading", () => {
  assert.match(HTML, /width="44" height="44" loading="lazy" decoding="async"/);
  const bookie = HTML.indexOf("TB.bookie={");
  assert.ok(bookie > 0);
  assert.match(HTML.slice(bookie, bookie + 1400), /loading="lazy" decoding="async"/);
});
