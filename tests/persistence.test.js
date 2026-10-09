const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const vm = require("vm");
const path = require("path");

function read(file) { return fs.readFileSync(path.join(__dirname, "..", file), "utf8"); }

test("Theme and accent persistence works with new variants", () => {
  const html = read("index.html");
  const moduleStart = html.indexOf("var names = ['navy', 'day', 'ochre', 'apex', 'apex-light', 'apex-oled', 'apex-mono'];");
  const moduleEnd = html.indexOf("}());", moduleStart);
  let themeMod = html.substring(html.lastIndexOf("(function () {", moduleStart), moduleEnd + 5);

  let store = {};
  const mockEnv = {
    window: { matchMedia: () => ({ matches: false, addEventListener: () => {} }), addEventListener: () => {} },
    document: {
      documentElement: { dataset: {}, style: { setProperty: () => {}, removeProperty: () => {} } },
      addEventListener: () => {},
      querySelector: () => ({ setAttribute: () => {}, getAttribute: () => null }),
      querySelectorAll: () => [],
      createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
      head: { appendChild: () => {} },
      startViewTransition: (cb) => { cb(); },
      hidden: false
    },
    localStorage: {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; }
    },
    TBTime: { dayKey: () => "mock", isDaytime: () => true, hour: () => 12, msUntilHour: () => 1000 },
    setTimeout: () => 1,
    clearTimeout: () => {},
    Date: Date,
    matchMedia: () => ({ matches: false, addEventListener: () => {} })
  };
  mockEnv.TB = {};
  mockEnv.window.TB = mockEnv.TB;
  
  vm.createContext(mockEnv);
  
  try {
    vm.runInContext("var root = document.documentElement; function esc(s){return s;} " + themeMod, mockEnv);
  } catch (e) {
    // ignore
  }

  // Set theme to apex-light
  mockEnv.TB.theme.set("apex-light");
  assert.equal(store["tipbot_theme"], "apex-light");

  // Set accent to Gold
  mockEnv.TB.theme.setAccent("#fbbf24");
  assert.equal(store["tipbot_theme_accent"], "#fbbf24");

  // System toggle
  mockEnv.TB.theme.setSystem(true);
  assert.equal(store["tipbot_theme_system"], "true");
  assert.equal(store["tipbot_theme_auto"], "false");
});
