const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const builderJs = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
const apexCss = fs.readFileSync(path.join(root, "assets/theme-apex.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const R = require("../assets/racing-legs.js");

test("Racing UI: category gating is gallops T and harness H only", () => {
  assert.match(builderJs, /const RACING_ALLOWED = \{ T:true, H:true \}/);
  assert.match(builderJs, /Gallops/);
  assert.match(builderJs, /Harness/);
  assert.doesNotMatch(builderJs, /Greys/);
  assert.doesNotMatch(builderJs, /category=G/);
  assert.match(builderJs, /Greyhounds aren't listed\. Gallops and harness only\./);
});

test("Racing UI: hero sits in a scroll backdrop wrapper", () => {
  assert.match(builderJs, /race-hero-bg/);
  assert.match(builderJs, /if\s*\(\s*category\s*===\s*'T'\s*\)\s*\{[\s\S]*race-hero-bg/);
  assert.match(apexCss, /#race-app \.race-hero-bg/);
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
  assert.doesNotMatch(builderJs, /openCustom\([^)]*Racing/);
  assert.doesNotMatch(builderJs, /addLeg\(\{ custom:true, desc:desc, price:locked \}\)/);
  assert.doesNotMatch(builderJs, /flucs/i);
  assert.doesNotMatch(builderJs, /setInterval\([^)]*fetchRacingApi/);
  assert.doesNotMatch(builderJs, /setInterval\([^)]*\/api\/racing/);
  assert.match(builderJs, /racingTimer = setInterval\(tickRacingCountdown, 1000\)/);
  assert.match(builderJs, /\.time-badge\[data-time\]/);
});

test("Racing legs: build contract for win, place and top-N", () => {
  const race = { id: "evt-1", race_number: 8, name: "Stakes" };
  const runner = {
    number: 2,
    name: "Absconding",
    fixed: { win: 2.4, place: 1.25, top_3: 1.05 },
    silk_url: "https://example.com/s2.png",
  };
  const win = R.buildLeg({ race, runner, meetingName: "Randwick", betType: "win" });
  assert.equal(win.kind, "racing");
  assert.equal(win.event_id, "evt-1");
  assert.equal(win.race_number, 8);
  assert.equal(win.meeting_name, "Randwick");
  assert.equal(win.runner_number, 2);
  assert.equal(win.runner_name, "Absconding");
  assert.equal(win.bet_type, "win");
  assert.equal(win.opening_price, 2.4);
  assert.equal(win.silk_url, "https://example.com/s2.png");
  assert.equal(typeof win.colours, "string");
  assert.match(win.colours, /,/);
  assert.equal(typeof win.event_id, "string");

  const place = R.buildLeg({ race, runner, meetingName: "Randwick", betType: "place" });
  assert.equal(place.bet_type, "place");
  assert.equal(place.opening_price, 1.25);

  const top = R.buildLeg({ race, runner, meetingName: "Randwick", betType: "top_n", n: 3 });
  assert.equal(top.bet_type, "top_n");
  assert.equal(top.n, 3);
  assert.equal(top.opening_price, 1.05);
});

test("Racing places: top-N range follows field size", () => {
  assert.deepEqual(R.topNRange(1), []);
  assert.deepEqual(R.topNRange(4), [2, 3, 4]);
  assert.deepEqual(R.topNRange(12), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("Racing multi tray: combined opening odds multiply leg prices", () => {
  const legs = [
    { kind: "racing", opening_price: 2.5, bet_type: "win" },
    { kind: "racing", opening_price: 1.8, bet_type: "place" },
    { custom: true, price: 2 },
  ];
  assert.equal(R.combinedOpeningOdds(legs), 9);
  assert.match(builderJs, /trayCombinedOddsHtml/);
  assert.match(builderJs, /combinedOpeningOdds/);
});

test("Racing track map: major tracks only", () => {
  assert.equal(R.trackKey("Randwick"), "randwick");
  assert.equal(R.trackKey("Rosehill Gardens"), "rosehill");
  assert.equal(R.trackKey("Ballarat"), null);
  assert.match(R.trackMapSvg("Flemington"), /Flemington/);
  assert.equal(R.trackMapSvg("Geelong"), "");
});

test("Racing post feature-detect: rejection copy, never Custom fallback", () => {
  assert.match(builderJs, /isRacingRejection/);
  assert.match(builderJs, /setRacingPostSupported\(false\)/);
  assert.match(builderJs, /coming soon/);
  assert.match(builderJs, /function addRacingLeg/);
  assert.ok(R.isRacingRejection({ error: "Unknown kind racing" }, ""));
  assert.ok(!R.isRacingRejection({ error: "db busy" }, ""));
});

test("Racing settings: Show extra places pref in the gear menu", () => {
  assert.match(html, /id="dd-racing-places-on"/);
  assert.match(html, /Show extra places/);
  assert.match(html, /tipdash_racing_extra_places/);
});

test("TB.gameId counts racing legs by event_id for multis", () => {
  assert.match(html, /if\(leg\.kind==='racing'\)\{ var re=id\(leg\.event_id\)/);
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
  assert.match(racing, /prefers-reduced-motion:\s*reduce/);
});

test("Racing UI: meetings ask TipBot for category T or H plus today's date", () => {
  assert.match(builderJs, /"\/api\/racing\/meetings\?category="\+cat\+"&date="/);
  assert.match(builderJs, /\["T","H"\]/);
  assert.match(builderJs, /rn\.fixed/);
  assert.doesNotMatch(builderJs, /"win_odds"/);
});

test("Racing entry points: Home tile, deep links, and lazy placeholders", () => {
  assert.match(html, /function homeRacingTile\(srv\)/);
  assert.match(html, /function racingBuildServer\(/);
  assert.match(html, /if\(racingSrv\) ov\.appendChild\(homeRacingTile\(racingSrv\)\);/);
  assert.match(html, /if\(m\[2\]==="build" && m\[3\]==="racing"\) return openRacingBuilder\(gid,nm\), true;/);
  const list = JSON.parse(html.match(/const panel=p=>\{for\(const x of (\[[^\]]*\])\)/)[1]);
  assert.ok(list.includes("builder"));
  const tile = html.slice(html.indexOf("function homeRacingTile"), html.indexOf("let STATS_WINDOW"));
  assert.doesNotMatch(tile, /setInterval|setTimeout/);
});
