// node --test tests/   Horses under Stats: last two days of placings from GET /api/racing/results.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();
const H = require("../assets/horse-results.js");
const R = require("../assets/racing-legs.js");
const S = require("../assets/stats.js");

const NOW = Date.parse("2026-10-10T04:00:00Z");

function payload() {
  return {
    meetings: [
      {
        track: "Wagga",
        state: "NSW",
        date: "2026-10-10",
        races: [{
          number: 2,
          name: "Country",
          distance: 1200,
          start_time: "2026-10-10T07:00:00Z",
          condition: "Soft 5",
          runners: [
            { position: 1, horse_name: "Late Night", number: 4, barrier: 2, jockey: "A", trainer: "B", opening_win_price: 3.5, margin: 0, colours: "#222222, #eeeeee" }
          ]
        }]
      },
      {
        track: "Flemington",
        state: "VIC",
        date: "2026-10-10",
        category: "T",
        races: [{
          number: 7,
          name: "Mackinnon",
          distance: 2000,
          start_time: "2026-10-10T05:00:00Z",
          condition: "Good 4",
          runners: [
            { position: 3, horse: "Bronze Bill", number: 3, barrier: 5, jockey: "J", trainer: "T", opening_win: 8, margin: 1.2, colours: "sienna, wheat" },
            { position: 1, horse_name: "Gold Run", number: 1, barrier: 3, jockey: "J Smith", trainer: "T Brown", opening_win_price: 2.4, margin: "", silk_url: "https://example.com/s.png", colours: "navy, gold" },
            { scratched: true, horse_name: "Out Cold", number: 6, barrier: 6, jockey: "J", trainer: "T" },
            { position: 4, name: "Rest", number: 5, barrier: 4, jockey: "J", trainer: "T", opening_win: 12, margin: "3L" },
            { position: 2, horse_name: "Silver Lane", number: 2, barrier: 1, jockey: "J", trainer: "T", opening_win: 6, margin: 0.5 }
          ]
        }]
      },
      {
        track: "Randwick",
        state: "NSW",
        date: "2026-10-09",
        races: [{
          number: 1,
          name: "Sprint",
          distance: "1100m",
          start_time: "2026-10-09T03:00:00Z",
          condition: "Good 4",
          runners: [{ position: 1, horse_name: "Harbour", number: 5, opening_win_price: 3, margin: 0 }]
        }]
      },
      {
        track: "Old Cup",
        state: "VIC",
        date: "2026-10-07",
        races: [{ number: 1, name: "Old", distance: 1000, start_time: "2026-10-07T03:00:00Z", runners: [{ position: 1, horse_name: "Ancient", number: 1 }] }]
      },
      {
        track: "Dapto",
        state: "NSW",
        date: "2026-10-10",
        category: "G",
        races: [{ number: 1, name: "Greys", runners: [{ position: 1, horse_name: "Zoom", number: 1 }] }]
      }
    ]
  };
}

function shown() {
  return H.visibleMeetings(H.parseMeetings(payload()), NOW);
}

test("meetings sort newest first, with major tracks ahead on the same day", () => {
  const names = shown().map((m) => m.track);
  assert.deepEqual(names, ["Flemington", "Wagga", "Randwick"]);
  assert.equal(shown()[0].major, true);
  assert.equal(shown()[1].major, false);
});

test("the window is today and yesterday in Sydney, and greyhounds are left out", () => {
  const days = H.windowDays(NOW);
  assert.equal(days.today, "2026-10-10");
  assert.equal(days.yesterday, "2026-10-09");
  assert.equal(H.inWindow("2026-10-08", NOW), false);
  assert.equal(H.inWindow("2026-10-07", NOW), false);
  const names = H.parseMeetings(payload()).map((m) => m.track);
  assert.ok(names.includes("Old Cup"));
  assert.ok(!names.includes("Dapto"));
  assert.ok(!shown().some((m) => m.track === "Old Cup"));
});

test("runners finish in order, with scratched horses last", () => {
  const race = shown()[0].races[0];
  assert.deepEqual(race.runners.map((r) => r.name), ["Gold Run", "Silver Lane", "Bronze Bill", "Rest", "Out Cold"]);
  assert.equal(race.runners[4].scratched, true);
  assert.equal(race.distance, 2000);
  assert.equal(race.condition, "Good 4");
});

test("finishing order highlights 1st 2nd 3rd, greys out scratches, and reuses the silk chip", () => {
  const all = shown();
  const html = H.render({ view: "ready", all: all, q: "", day: "", track: "", open: {}, now: NOW, reduced: true });
  assert.match(html, /data-reduced="1"/);
  assert.match(html, /hr-row--1/);
  assert.match(html, /hr-row--2/);
  assert.match(html, /hr-row--3/);
  assert.match(html, />1st</);
  assert.match(html, />2nd</);
  assert.match(html, />3rd</);
  assert.match(html, /hr-row--out/);
  assert.match(html, />SCR</);
  assert.match(html, /2\.40/);
  assert.match(html, /0\.5L/);
  const chip = R.silkChipHtml({ number: 1, silk_url: "https://example.com/s.png", name: "Gold Run" });
  assert.match(chip, /class="silk"/);
  assert.match(chip, /<img src="https:\/\/example\.com\/s\.png"/);
  assert.match(chip, /<b>1<\/b>/);
  assert.match(html, /class="silk"/);
  assert.match(html, /<b>1<\/b>/);
  assert.match(html, /https:\/\/example\.com\/s\.png/);
  const colour = R.silkChipHtml({ number: 4, colours: "#222222, #eeeeee" });
  assert.match(colour, /class="silk"/);
  assert.match(colour, /#222222/);
  assert.match(colour, /<b>4<\/b>/);
  assert.equal(R.silkInnerHtml({ silk_url: "https://example.com/s.png" }), '<img src="https://example.com/s.png" alt="">');
});

test("track, day and horse-name filters narrow the list without dropping the field", () => {
  const all = shown();
  const wagga = H.filterMeetings(all, { track: "wagga" });
  assert.deepEqual(wagga.map((m) => m.track), ["Wagga"]);
  const yday = H.filterMeetings(all, { day: "2026-10-09" });
  assert.deepEqual(yday.map((m) => m.track), ["Randwick"]);
  const found = H.filterMeetings(all, { q: "gold" });
  assert.equal(found.length, 1);
  assert.equal(found[0].track, "Flemington");
  assert.equal(found[0].races[0].runners.length, 5);
  const html = H.render({ view: "ready", all: all, q: "gold", day: "", track: "", open: {}, now: NOW });
  assert.match(html, /<mark>Gold<\/mark>/);
  assert.match(html, /hr-row--hit/);
  assert.match(html, /Silver Lane/);
  const none = H.render({ view: "ready", all: all, q: "zzzz", day: "", track: "", open: {}, now: NOW });
  assert.match(none, /No races match that filter/);
});

test("incremental results merge by meeting and race, and since is sent on refresh", () => {
  const base = H.parseMeetings(payload()).filter((m) => m.track === "Flemington");
  const extra = H.parseMeetings({
    meetings: [{
      track: "Flemington",
      state: "VIC",
      date: "2026-10-10",
      races: [
        {
          number: 7,
          name: "Mackinnon",
          distance: 2000,
          start_time: "2026-10-10T05:00:00Z",
          runners: [{ position: 1, horse_name: "Gold Run", number: 1, margin: "nose" }]
        },
        {
          number: 8,
          name: "Cup",
          distance: 3200,
          start_time: "2026-10-10T06:00:00Z",
          runners: [{ position: 1, horse_name: "Stayer", number: 9 }]
        }
      ]
    }]
  });
  const merged = H.mergeMeetings(base, extra);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].races.map((r) => r.number), [7, 8]);
  assert.equal(merged[0].races[0].runners[0].margin, "nose");
  assert.equal(H.resultsPath(null), "/api/racing/results");
  assert.equal(H.resultsPath("2026-10-10T04:00:00.000Z"), "/api/racing/results?since=" + encodeURIComponent("2026-10-10T04:00:00.000Z"));
});

test("a missing endpoint is Results coming soon, not an error", () => {
  assert.match(H.comingSoonHtml(false), /Results coming soon/);
  assert.doesNotMatch(H.comingSoonHtml(false), /class="err"/);
  assert.match(H.errorHtml("Couldn't load horse results."), /Try again/);
  assert.match(H.cssText(), /min-height:44px/);
  assert.match(H.cssText(), /prefers-reduced-motion:reduce/);
  assert.ok(H.REFRESH_MS >= 120000 && H.REFRESH_MS <= 300000);
});

test("Stats links to Horses and the dashboard keeps the TipBot API base", () => {
  const empty = S.render(S.compute([], { window: "7", now: NOW }), {});
  assert.match(empty, /id="ds-horses"/);
  assert.match(empty, />Horses</);
  assert.match(S.errorHtml("x"), /id="ds-horses"/);
  assert.match(S.cssText(), /\.ds-horses\{[^}]*min-height:44px/);
  assert.match(html, /if\(m\[0\]==="stats" && m\[1\]==="horses"\) return openHorseResults\(\), true;/);
  assert.match(html, /if\(m\[0\]==="stats"\) return openStats\(\), true;/);
  assert.match(html, /onHorses: openHorseResults/);
  assert.match(html, new RegExp('<script src="\\./assets/horse-results\\.js\\?v=' + version.replace(/\./g, "\\.") + '"></script>'));
  assert.match(html, /const API="https:\/\/afl-tipster-bot\.onrender\.com";/);
  assert.doesNotMatch(html, /const API="";/);
  assert.doesNotMatch(html, /href="#\/stats"/);
  const src = fs.readFileSync(path.join(root, "assets", "horse-results.js"), "utf8");
  assert.doesNotMatch(src, /console\.(log|debug|info|warn|error|trace)\s*\(/);
  assert.doesNotMatch(src, /\/api\/ops|owner-tools|God mode|Debug menu/);
  const builder = fs.readFileSync(path.join(root, "assets", "builder.js"), "utf8");
  assert.match(builder, /TBRacingLegs\.silkInnerHtml/);
});

let mountChain = Promise.resolve();
function serialMount(name, fn) {
  let release;
  const gate = new Promise((r) => { release = r; });
  const prev = mountChain;
  mountChain = gate;
  test(name, async () => {
    await prev;
    try { await fn(); }
    finally { release(); }
  });
}

function fakeEl() {
  return {
    hidden: false,
    innerHTML: "",
    ownerDocument: { activeElement: null, scrollingElement: { scrollTop: 0 } },
    querySelector(sel) {
      if (sel === "#hr-app") return this.hidden ? null : {};
      if (sel === "#hr-list") return { innerHTML: "" };
      if (sel === "#hr-q") return { value: "", focus() {}, setSelectionRange() {}, selectionStart: 0, selectionEnd: 0 };
      if (sel === "#hr-status") return { textContent: "" };
      if (sel === "#hr-back" || sel === "#hr-retry") return {};
      return null;
    },
    querySelectorAll() { return []; }
  };
}

serialMount("404 paints Results coming soon and does not schedule a refresh", async () => {
  const calls = [];
  const el = fakeEl();
  await H.mount(el, {
    now: () => NOW,
    intervalMs: 50,
    api: async (path) => {
      calls.push(path);
      return { status: 404, ok: false, json: async () => ({}) };
    }
  });
  assert.match(el.innerHTML, /Results coming soon/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "/api/racing/results");
  H.stop();
});

serialMount("while the page is open, refresh uses ?since", async () => {
  let tick = null;
  const calls = [];
  const el = fakeEl();
  await H.mount(el, {
    now: () => NOW,
    intervalMs: H.REFRESH_MS,
    setInterval(fn) { tick = fn; return 1; },
    clearInterval() { tick = null; },
    api: async (path) => {
      calls.push(path);
      return { status: 200, ok: true, json: async () => payload() };
    }
  });
  assert.equal(calls[0], "/api/racing/results");
  assert.match(el.innerHTML, /Flemington/);
  assert.equal(typeof tick, "function");
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1], "/api/racing/results?since=" + encodeURIComponent(new Date(NOW).toISOString()));
  H.stop();
  assert.equal(tick, null);
});
