const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const builderJs = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
const apexCss = fs.readFileSync(path.join(root, "assets/theme-apex.css"), "utf8");

test("Racing UI: category gating is gallops T and harness H only", () => {
  assert.match(builderJs, /if\s*\(\s*category\s*===\s*'T'\s*\)\s*\{\s*html\s*\+=\s*RACING_HERO_HTML;\s*\}/);
  assert.match(builderJs, /const RACING_ALLOWED = \{ T:true, H:true \}/);
  assert.match(builderJs, /Gallops/);
  assert.match(builderJs, /Harness/);
  assert.doesNotMatch(builderJs, /Greys/);
  assert.doesNotMatch(builderJs, /category=G/);
  assert.match(builderJs, /Greyhounds aren't listed\. Gallops and harness only\./);
});

test("Racing UI: reduced motion is scoped to #race-app", () => {
  assert.match(builderJs, /const reduce = matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches \|\| document\.documentElement\.dataset\.motion === 'reduce';/);
  assert.match(builderJs, /if\s*\(\s*reduce\s*\)\s*\{\s*app\.classList\.add\('is-in',\s*'is-compact'\);\s*\}/);
  assert.doesNotMatch(builderJs, /document\.documentElement\.classList\.add\('is-in',\s*'is-compact'\)/);
});

test("Racing UI: API error states", () => {
  assert.match(builderJs, /if\(res\.status===503\) return \{ error: "Racing data is currently unavailable\. Please try again later\." \};/);
  assert.match(builderJs, /if\(res\.status===400\) return \{ error: "Greyhounds aren't listed\. Gallops and harness only\." \};/);
});

test("Racing UI: next-to-go keeps painting when isConnected is unset", () => {
  assert.match(builderJs, /if\(list\.isConnected === false\) return;/);
  assert.doesNotMatch(builderJs, /if\s*\(\s*!list\.isConnected\s*\)\s*return;/);
});

test("Racing UI: opening prices only — no flucs, no odds polling", () => {
  assert.match(builderJs, /<em>Opening<\/em><span>Win<\/span><span>Place<\/span>/);
  assert.match(builderJs, /function racingOpeningWin/);
  assert.match(builderJs, /opening_win/);
  assert.match(builderJs, /addLeg\(\{ custom:true, desc:desc, price:locked \}\)/);
  assert.doesNotMatch(builderJs, /flucs/i);
  assert.doesNotMatch(builderJs, /setInterval\([^)]*fetchRacingApi/);
  assert.doesNotMatch(builderJs, /setInterval\([^)]*\/api\/racing/);
  assert.match(builderJs, /racingTimer = setInterval\(tickRacingCountdown, 1000\)/);
  assert.match(builderJs, /\.time-badge\[data-time\]/);
});

test("Racing UI: results still show placings and dividends", () => {
  assert.match(builderJs, /Placings/);
  assert.match(builderJs, /function racingDividend/);
  assert.match(builderJs, /racingDividend\(r, rn, "win"\)/);
  assert.match(builderJs, /racingDividend\(r, rn, "place"\)/);
});

test("Racing lists do not use .gcards (Apex hides those on builder step 0)", () => {
  const racing = builderJs.slice(builderJs.indexOf("async function loadNextToGo"));
  assert.match(racing, /class="race-list"/);
  assert.doesNotMatch(racing, /class="gcards"/);
  assert.doesNotMatch(racing, /class="gcard /);
  assert.match(apexCss, /#builder\[data-apex-step="0"\] \.gcards\{display:none\}/);
  assert.match(apexCss, /#builder \.race-list/);
});

test("Racing CSS stays under #race-app so tray chips are untouched", () => {
  const racing = apexCss.slice(apexCss.indexOf("/* Racing (scoped"));
  assert.match(racing, /#race-app/);
  assert.match(racing, /\.race-card/);
  assert.match(racing, /\.race-row/);
  assert.doesNotMatch(racing, /(?:^|\n)\.card\s*\{/);
  assert.doesNotMatch(racing, /(?:^|\n)\.chip\s*\{/);
  assert.doesNotMatch(racing, /(?:^|\n)\.row\s*\{/);
  assert.doesNotMatch(racing, /(?:^|\n)\.glow\s*\{/);
  assert.match(racing, /prefers-reduced-motion:\s*reduce/);
});

test("Racing UI: meetings ask TipBot for category T or H plus today's date", () => {
  assert.match(builderJs, /"\/api\/racing\/meetings\?category="\+cat\+"&date="/);
  assert.match(builderJs, /\["T","H"\]/);
  assert.match(builderJs, /rn\.fixed/);
  assert.doesNotMatch(builderJs, /"win_odds"/);
});

test("Racing entry points: Home tile, deep links, and lazy placeholders", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /function homeRacingTile\(srv\)/);
  assert.match(html, /if\(list\.length\) ov\.appendChild\(homeRacingTile\(list\[0\]\)\);/);
  assert.match(html, /if\(m\[2\]==="build" && m\[3\]==="racing"\) return openRacingBuilder\(gid,nm\), true;/);
  // Racing views render inside #builder, which panel() already lists.
  const list = JSON.parse(html.match(/const panel=p=>\{for\(const x of (\[[^\]]*\])\)/)[1]);
  assert.ok(list.includes("builder"));
  // The Home strip is a one-shot read: no polling.
  const tile = html.slice(html.indexOf("function homeRacingTile"), html.indexOf("let STATS_WINDOW"));
  assert.doesNotMatch(tile, /setInterval|setTimeout/);
});
