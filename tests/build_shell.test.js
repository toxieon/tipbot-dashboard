// node --test tests/build_shell.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("Apex armBuilder keeps step index but does not mount the flow bar", () => {
  const js = read("assets/theme-apex.js");
  const arm = js.slice(js.indexOf("function armBuilder()"), js.indexOf("function armEmptyStates"));
  assert.match(arm, /builderStep\(box\)/);
  assert.match(arm, /dataset\.apexStep/);
  assert.doesNotMatch(arm, /createElement\("ol"\)/);
  assert.doesNotMatch(arm, /Sport", "Game", "Market", "Confirm"/);
});

test("Build tab opens sports flow; Racing chip is in the sports picker", () => {
  const b = read("assets/builder.js");
  assert.match(b, /async function openBuilder\(guildId, name\) \{[\s\S]{0,120}openSportsBuilder\(guildId, name, true\)/);
  assert.match(b, /id="build-racing-switch"/);
  assert.doesNotMatch(b, /Ready to build/);
  assert.doesNotMatch(b, /tile-sports/);
});

test("phone tab bar hidden without server context; Build/Upcoming guarded", () => {
  const js = read("assets/theme-apex.js");
  assert.match(js, /function hasServerContext\(/);
  assert.match(js, /dataset\.apexTabs = "off"/);
  assert.match(js, /\(id === "build" \|\| id === "upcoming"\) && !hasServerContext\(\)\) return/);
  const css = read("assets/theme-apex.css");
  assert.match(css, /data-apex-tabs="off"\] \.apex-tabs\{display:none/);

  const ctx = {
    matchMedia: () => ({ matches: false }),
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => { fn(); return 1; },
    performance: { now: () => 0 },
    document: {
      documentElement: { dataset: { theme: "apex" }, classList: { toggle() {} } },
      body: { contains: () => false },
      hidden: false,
      addEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: (id) => {
        if (id === "overview") return { hidden: false };
        if (id === "app") return {};
        return { hidden: true };
      },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  const bootOff = js.replace(/if \(doc && doc\.documentElement && doc\.documentElement\.dataset\.theme === "apex"\) boot\(\);/, "");
  vm.runInContext(bootOff, ctx);
  assert.equal(typeof ctx.ApexTheme.hasServerContext, "function");
  assert.equal(ctx.ApexTheme.hasServerContext(), false);
  ctx.document.getElementById = (id) => {
    if (id === "overview") return { hidden: true };
    if (id === "detail") return { hidden: false };
    if (id === "app") return {};
    return { hidden: true };
  };
  assert.equal(ctx.ApexTheme.hasServerContext(), true);
});
