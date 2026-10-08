// node --test tests/   Apex theme: names lists, token set, deferred motion, local choice.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

const PAGES = [
  "index.html",
  "live/index.html",
  "live/board/index.html",
  "compare/index.html",
  "master/index.html",
];

const TOKENS = [
  "--bg", "--bg2", "--card", "--card2", "--line", "--txt", "--muted", "--faint",
  "--accent", "--accent2", "--on-accent", "--win", "--loss", "--push", "--void",
  "--radius", "--win-ink", "--loss-ink", "--push-ink", "--void-ink", "--warn", "--warn-ink",
];

function themeBlock(css, selector) {
  const re = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? m[1] : "";
}

test("apex is in every hard-coded theme names list", () => {
  for (const f of PAGES) {
    const src = read(f);
    const lists = src.match(/\[[^\]]*'navy'[^\]]*\]/g) || [];
    assert.ok(lists.length >= 1, f + " has a names list");
    for (const list of lists) {
      assert.match(list, /'day'/);
      assert.match(list, /'ochre'/);
      assert.match(list, /'apex'/, f + " " + list);
    }
  }
  assert.match(read("index.html"), /var names = \['navy', 'day', 'ochre', 'apex'\]/);
  assert.match(read("index.html"), /\.tb-swatch\[data-tb-theme="apex"\]/);
});

test("apex token blocks are complete and navy, day, ochre are unchanged", () => {
  const html = read("index.html");
  assert.match(html, /html\[data-theme="navy"\][\s\S]{0,240}--bg:#0b0f1a/);
  assert.match(html, /html\[data-theme="day"\][\s\S]{0,240}--bg:#f5f7fb/);
  assert.match(html, /html\[data-theme="ochre"\][\s\S]{0,280}--bg:#17110c/);
  for (const f of PAGES) {
    const css = (read(f).match(/<style[^>]*>([\s\S]*?)<\/style>/) || [, ""])[1];
    const dark = themeBlock(css, 'html[data-theme="apex"]');
    const light = themeBlock(css, 'html[data-theme="apex"][data-apex-light="1"]');
    assert.ok(dark, f + " dark apex block");
    assert.ok(light, f + " light apex block");
    for (const token of TOKENS) {
      assert.match(dark, new RegExp(token + ":"), f + " dark " + token);
      assert.match(light, new RegExp(token + ":"), f + " light " + token);
    }
    assert.match(dark, /#07090F/i);
    assert.match(dark, /#11141C/i);
    assert.match(dark, /#1E2430/i);
    assert.match(dark, /#F5F7FA/i);
    assert.match(dark, /#8B93A7/i);
    assert.match(dark, /#5B8CFF/i);
    assert.match(dark, /#3B6FE8/i);
    assert.match(dark, /#34D399/i);
    assert.match(dark, /#F87171/i);
    assert.match(dark, /#FBBF24/i);
    assert.match(light, /#F4F6F8/i);
    assert.match(light, /#FFFFFF/i);
    assert.match(light, /#E6E8EE/i);
    assert.match(light, /#0E1116/i);
    assert.match(light, /#5C6578/i);
    assert.match(light, /#3B6FE8/i);
  }
});

test("apex motion is deferred and keeps a local choice the server dropped", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /<script src="[^"]*theme-apex\.js/);
  assert.match(html, /theme-apex\.js/);
  assert.match(html, /keepLocalApex=localTheme==="apex" && \(incoming==null \|\| incoming===""\)/);
  const js = read("assets/theme-apex.js");
  const css = read("assets/theme-apex.css");
  assert.doesNotMatch(js, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  assert.doesNotMatch(css + js, /100vw|100vh/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /prefers-reduced-motion:\s*no-preference/);
  assert.match(css, /font-family:\s*Geist/);
  assert.match(css, /Instrument Sans/);
  assert.doesNotMatch(css + js, /fonts\.google|fonts\.gstatic/);
  assert.ok(fs.existsSync(path.join(root, "assets/fonts/geist-latin.woff2")));
  assert.ok(fs.existsSync(path.join(root, "assets/fonts/instrument-sans-latin.woff2")));
  assert.match(read("assets/fonts/OFL-Geist.txt"), /SIL OPEN FONT LICENSE/);
  assert.match(read("assets/fonts/OFL-InstrumentSans.txt"), /SIL OPEN FONT LICENSE/);
  const ctx = { matchMedia: function () { return { matches: false }; }, setTimeout: setTimeout, clearTimeout: clearTimeout };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  assert.equal(typeof ctx.ApexTheme.boot, "function");
  assert.equal(ctx.ApexTheme.reduced(), false);
  ctx.ApexTheme.boot();
});
