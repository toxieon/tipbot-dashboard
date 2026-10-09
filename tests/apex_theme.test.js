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
      if (list.indexOf("'apex'") === -1 && list.indexOf("'navy'") !== -1 && list.indexOf("'day'") !== -1 && list.indexOf("'ochre'") !== -1 && list.length < 30) {
        // legacy names list
        continue;
      }
      assert.match(list, /'day'/);
      assert.match(list, /'ochre'/);
      assert.match(list, /'apex'/, f + " " + list);
    }
  }
  assert.match(read("index.html"), /var names = \['apex', 'apex-light', 'apex-oled', 'apex-mono', 'apex-ochre', 'navy', 'day', 'ochre'\]/);
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
  assert.match(js, /startViewTransition/);
  assert.match(js, /IntersectionObserver/);
  assert.match(css, /\.apex-rail/);
  assert.match(css, /\.apex-tabs/);
  assert.match(css, /apex-tab-build/);
  const armB = js.slice(js.indexOf("function armBuilder()"), js.indexOf("function armEmptyStates"));
  assert.doesNotMatch(armB, /createElement\("ol"\)/);
  assert.doesNotMatch(armB, /Sport", "Game", "Market", "Confirm"/);
  assert.match(js, /function builderStep\(/);
  assert.match(js, /hasServerContext/);
  assert.match(css, /data-apex-tabs="off"/);
  assert.match(css, /\.apex-seg/);
  assert.match(css, /\.graderow/);
  assert.match(css, /\.apex-day/);
});

function ys(d) {
  return d.split(/[ML]/).filter(Boolean).map((part) => Number(part.trim().split(/\s+/)[1]));
}

function loadApex() {
  const js = read("assets/theme-apex.js");
  const ctx = {
    matchMedia: function () { return { matches: false }; },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    requestAnimationFrame: function () { return 1; },
    performance: { now: function () { return 1000; } }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  return ctx.ApexTheme;
}

test("home profit keeps the unit and one decimal", () => {
  const apex = loadApex();
  assert.equal(apex.fmtUnits(14.9), "+14.9u");
  assert.equal(apex.fmtUnits(18.4), "+18.4u");
  assert.equal(apex.fmtUnits(-3.5), "-3.5u");
  assert.equal(apex.fmtUnits(0), "0.0u");
  assert.equal(apex.fmtUnits(null), "\u2014");
});

test("a positive profit sparkline rises left to right", () => {
  const apex = loadApex();
  const up = ys(apex.sparkD([0, 18.4], 120, 36));
  assert.equal(up.length, 2);
  assert.ok(up[1] < up[0], "higher profit is higher on the chart");
  const total = ys(apex.sparkD([0, 14.9], 280, 72));
  assert.ok(total[1] < total[0]);
  const down = ys(apex.sparkD([0, -4.2], 120, 36));
  assert.ok(down[1] > down[0], "a loss falls left to right");
  const bankroll = Array.from(apex.cumulative([18.4, -3.5]), (n) => Math.round(n * 10));
  assert.equal(bankroll[0], 0);
  assert.equal(bankroll[1], 184);
  assert.equal(bankroll[2], 149);
  const bank = ys(apex.sparkD(apex.cumulative([18.4, -3.5]), 280, 72));
  assert.ok(bank[0] > bank[bank.length - 1], "a positive bankroll ends above where it started");
  const js = read("assets/theme-apex.js");
  assert.match(js, /svgLine\("apex-mini", \[0, st\.profit\]/);
  assert.match(js, /var running = profits\.length \? \[0, sum\] : \[\]/);
});

test("the server hero keeps the settled units figure while the tile is counting", () => {
  const apex = loadApex();
  const tile = { textContent: "+18.4u", dataset: {} };
  apex.countEl(tile, 640);
  assert.equal(tile.dataset.apexFinal, "+18.4u");
  assert.equal(tile.dataset.apexBusy, "1");
  tile.textContent = "+1.8u";
  assert.equal(apex.settledText(tile), "+18.4u");
  tile.textContent = "+18.4u";
  delete tile.dataset.apexBusy;
  tile.dataset.apexGen = "1";
  const hero = { textContent: "+18.4u", dataset: { apexGen: "2" } };
  let finished = false;
  const ctxNow = 5000;
  const themeSrc = read("assets/theme-apex.js");
  assert.match(themeSrc, /exactUnits\(settledText\(units\)\)/);
  const clock = {
    matchMedia: function () { return { matches: false }; },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    requestAnimationFrame: function (fn) { fn(ctxNow); return 1; },
    performance: { now: function () { return 1000; } }
  };
  clock.window = clock;
  vm.createContext(clock);
  vm.runInContext(themeSrc, clock);
  clock.ApexTheme.countEl(hero, 640);
  finished = hero.dataset.apexSettled === "1";
  assert.equal(finished, true);
  assert.equal(hero.textContent, "+18.4u");
});

test("next start counts down, and an empty slate says No games", () => {
  const apex = loadApex();
  assert.equal(apex.leadText(2 * 86400000 + 3 * 3600000), "2d 3h");
  assert.equal(apex.leadText(90 * 60000), "1h 30m");
  assert.equal(apex.leadText(5 * 60000), "5m");
  assert.equal(apex.leadText(15000), "<1m");
  assert.equal(apex.leadText(null), null);
  const js = read("assets/theme-apex.js");
  const css = read("assets/theme-apex.css");
  assert.match(js, /No games/);
  assert.match(js, /apex-muted/);
  assert.match(css, /\.apex-facts b\.apex-muted/);
  assert.match(css, /"units units strike"/);
  assert.match(css, /"units units record"/);
  assert.match(css, /"form form roi"/);
  assert.doesNotMatch(js, /series\.push\(st\.won\)/);
});

test("apex is the default when a visitor has not chosen a theme", () => {
  for (const f of PAGES) {
    const src = read(f);
    assert.match(src, /APEX_DEFAULT=true/, f);
    assert.match(src, /APEX_DEFAULT\?'apex':'navy'/, f);
  }
  assert.match(read("index.html"), /return savedOk\?saved:\(APEX_DEFAULT\?'apex':'navy'\)/);
});

test("streak flame chip is added for 3+ consecutive wins", () => {
  const js = read("assets/theme-apex.js");
  const ctx = {
    matchMedia: function () { return { matches: false }; },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    requestAnimationFrame: function () { return 1; },
    performance: { now: function () { return 1000; } }
  };
  ctx.window = ctx;
  const doc = {
    createElement: function(tag) { return { className: "", dataset: {}, setAttribute: function(k,v){ this[k]=v; }, innerHTML: "", classList: { add: function(c){ this.className += " " + c; } }, querySelector: function(s){ return { innerHTML: "", classList: { add: function(c){ this.className += " " + c; } } }; }, getAttribute: function(k){ return this[k]; }, querySelectorAll: function(){ return []; } }; },
    documentElement: { dataset: {} }
  };
  ctx.document = doc;
  vm.createContext(ctx);
  vm.runInContext(js, ctx);

  const form = doc.createElement("span");
  form.setAttribute("data-streak", "W");
  form.setAttribute("data-streak-n", "3");
  const tag = { className: "", innerHTML: "", classList: { add: (c) => tag.className = c } };
  form.querySelector = function() { return tag; };
  form.querySelectorAll = function() { return []; };
  ctx.ApexTheme.formStrip(form);
  assert.match(tag.className, /apex-flame-chip/);
  assert.match(tag.innerHTML, /apex-flame-icon/);

  const form2 = doc.createElement("span");
  form2.setAttribute("data-streak", "W");
  form2.setAttribute("data-streak-n", "2");
  const tag2 = { className: "", innerHTML: "", classList: { add: (c) => tag2.className = c } };
  form2.querySelector = function() { return tag2; };
  form2.querySelectorAll = function() { return []; };
  ctx.ApexTheme.formStrip(form2);
  assert.doesNotMatch(tag2.className, /apex-flame-chip/);
});

test("reduced-motion handling in countEl and stamp", () => {
  const js = read("assets/theme-apex.js");
  const ctx = {
    matchMedia: function () { return { matches: true }; },
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    requestAnimationFrame: function () { return 1; },
    performance: { now: function () { return 1000; } }
  };
  ctx.window = ctx;
  ctx.document = { createElement: function() { return { setAttribute: function(){}, classList: { add: function(){} } }; }, documentElement: { dataset: {} }, querySelectorAll: function(){ return []; } };
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  
  const el = { textContent: "100", dataset: {} };
  ctx.ApexTheme.countEl(el, 1000);
  assert.equal(el.dataset.apexSettled, "1");
  assert.equal(el.textContent, "100");

  const card = {
    dataset: { settled: "1" },
    getAttribute: function() { return "123"; },
    querySelector: function(s) { return s === ".tbchip--win" ? {} : null; },
    appendChild: function() {},
    classList: { add: function(c){ this.className = c; }, remove: function(){} }
  };
  ctx.ApexTheme.stamp(card);
  assert.notEqual(card.className, "apex-flip");
});
