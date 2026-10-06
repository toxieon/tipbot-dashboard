// node --test tests/   Full-time auto-grade: AFL stays on /api/auto-push; NFL and NBA/WNBA
// are their own switches (feat.auto_push_ft_nfl / feat.auto_push_ft_nba), default off.
// A 503/db_busy, failed, or missing-flag read retries, then stays unknown (not off)
// and cannot be saved until the real state has loaded.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const start = html.indexOf("/*__FT_GRADE__*/");
const end = html.indexOf("/*__FT_GRADE_END__*/");
assert.ok(start > 0 && end > start, "ft-grade helper block missing");
const ctx = {esc: (s) => String(s == null ? "" : s)};
vm.createContext(ctx);
vm.runInContext(html.slice(start + "/*__FT_GRADE__*/".length, end), ctx);
vm.runInContext(html.slice(html.indexOf("function ftGradeSwitchHtml"), html.indexOf("function setFtSwitch")), ctx);
const read = (expr) => vm.runInContext(expr, ctx);
const plain = (v) => JSON.parse(JSON.stringify(v));
ctx.FT_GRADE_TOGGLES = read("FT_GRADE_TOGGLES");
ctx.FT_GRADE_ENV_NOTE = read("FT_GRADE_ENV_NOTE");

const AFL = "feat.auto_push_ft";
const NFL = "feat.auto_push_ft_nfl";
const NBA = "feat.auto_push_ft_nba";

test("settings switches are AFL, then NFL, then NBA/WNBA, all role=switch and off unless the server says so", () => {
  const specs = Array.from(ctx.FT_GRADE_TOGGLES);
  assert.deepEqual(specs.map((t) => t.key), [AFL, NFL, NBA]);
  assert.deepEqual(specs.map((t) => t.label), [
    "Auto-grade AFL at full time",
    "Auto-grade NFL at full time",
    "Auto-grade NBA/WNBA at full time",
  ]);
  const row = ctx.ftGradeSwitchHtml(ctx.FT_GRADE_TOGGLES[1], false);
  assert.match(row, /class="switch"/);
  assert.match(row, /class="toggle"/);
  assert.match(row, /role="switch"/);
  assert.match(row, /aria-checked="false"/);
  assert.match(row, /id="autopush-nfl-toggle"/);
  assert.match(row, /Auto-grade NFL at full time/);
  assert.doesNotMatch(row, /class="toggle on"/);
  const on = ctx.ftGradeSwitchHtml(ctx.FT_GRADE_TOGGLES[0], true);
  assert.match(on, /class="toggle on"/);
  assert.match(on, /aria-checked="true"/);
  assert.match(html, /id="ft-grade-switches"/);
  assert.match(html, /id="autopush-env"/);
  assert.match(html, /FT_GRADE_TOGGLES\.map\(function\(spec\)/);
});

test("AFL still posts only to /api/auto-push; NFL and NBA post only their own flag", () => {
  const afl = plain(ctx.ftGradeWrite("99", AFL, false));
  assert.equal(afl.path, "/api/auto-push");
  assert.deepEqual(afl.body, {guild_id: "99", enabled: false, auto_push_ft: false});
  assert.equal(afl.body.flags, undefined);

  const nfl = plain(ctx.ftGradeWrite("99", NFL, true));
  assert.equal(nfl.path, "/api/feature-flags");
  assert.deepEqual(nfl.body, {guild_id: "99", flags: {[NFL]: true}});
  assert.deepEqual(Object.keys(nfl.body.flags), [NFL]);

  const nba = plain(ctx.ftGradeWrite("99", NBA, false));
  assert.deepEqual(nba.body.flags, {[NBA]: false});
  assert.deepEqual(Object.keys(nba.body.flags), [NBA]);
  assert.match(html, /ftGradeWrite\(gid, spec\.key, want\)/);
});

test("a missing flag is not treated as on, and a false flag stays off", () => {
  assert.equal(ctx.ftGradeFromFlags({}, NFL), null);
  assert.equal(ctx.ftGradeFromFlags({[NFL]: false}, NFL), false);
  assert.equal(ctx.ftGradeFromFlags({[NFL]: 0}, NFL), false);
  assert.equal(ctx.ftGradeFromFlags({[NFL]: true}, NFL), true);
  assert.equal(ctx.ftGradeFromFlags({[AFL]: true}, NFL), null);
  assert.equal(ctx.ftGradeFromAutoPush({ok: true, auto_push_ft: false}), false);
  assert.equal(ctx.ftGradeFromAutoPush({ok: true, enabled: 1}), true);
  assert.equal(ctx.ftGradeFromAutoPush({ok: true}), null);
});

test("the feature list keeps registry order and uses the Auto-grade labels", () => {
  const keys = [
    "feat.livestats_auto_ft",
    AFL, NFL, NBA,
    "feat.master_feed",
  ];
  const labels = {
    [AFL]: "Auto-push AFL results at full time",
    [NFL]: "Auto-push NFL results at full time",
    [NBA]: "Auto-push NBA and WNBA results at full time",
    "feat.master_feed": "Forward to master server",
  };
  const shown = keys.map((k) => ctx.ftGradeLabel(k, labels[k]));
  assert.deepEqual(shown, [
    "feat.livestats_auto_ft",
    "Auto-grade AFL at full time",
    "Auto-grade NFL at full time",
    "Auto-grade NBA/WNBA at full time",
    "Forward to master server",
  ]);
  assert.match(html, /keys\.forEach\(k=>\{/);
  assert.match(html, /ftGradeLabel\(k, labels\[k\]\)/);
  assert.doesNotMatch(html, /keys\.sort\(/);
  const flags = {[AFL]: false, [NFL]: false, [NBA]: false, "feat.master_feed": true};
  const checked = keys.map((k) => flags[k] !== false && flags[k] !== 0);
  assert.deepEqual(checked.slice(1, 4), [false, false, false]);
});

test("NFL and NBA note the server env switch, and show it when the API includes it", () => {
  const note = ctx.FT_GRADE_ENV_NOTE;
  assert.match(note, /ESPN_AUTO_PUSH_FT/);
  assert.match(note, /ESPN_AUTO_PUSH_FT_NBA/);
  assert.match(note, /won't grade if that's off/);
  assert.equal(ctx.ftGradeEnvText({flags: {}}), note);
  assert.equal(ctx.ftGradeEnvState({flags: {}}, NFL), null);
  const withEnv = ctx.ftGradeEnvText({env: {ESPN_AUTO_PUSH_FT: false, ESPN_AUTO_PUSH_FT_NBA: true}});
  assert.match(withEnv, /Server env: NFL off, NBA\/WNBA on\./);
  assert.match(ctx.ftGradeRowNote({espn_auto_push_ft: 1}, NFL), /ESPN_AUTO_PUSH_FT/);
  assert.match(ctx.ftGradeRowNote({espn_auto_push_ft: 1}, NFL), /Server env is on/);
  assert.equal(ctx.ftGradeRowNote({}, AFL), "");
  assert.match(ctx.ftGradeRowNote({}, NBA), /ESPN_AUTO_PUSH_FT_NBA/);
  assert.match(html, /ftGradeRowNote\(d, k\)/);
});

test("the guild column toggle handler does not own the full-time switches", () => {
  assert.match(html, /b\.id==="autopush-nfl-toggle"/);
  assert.match(html, /b\.id==="autopush-nba-toggle"/);
  assert.match(html, /b\.dataset\.ftGrade/);
});

function res(status, body) {
  return {status, ok: status >= 200 && status < 300, json: async () => body};
}
function shown(slot) {
  return slot.status === "on" ? true : (slot.status === "off" ? false : null);
}
function scripted(routes) {
  const n = {auto: 0, flags: 0};
  const waits = [];
  const api = async (path) => {
    const key = String(path).startsWith("/api/feature-flags") ? "flags" : "auto";
    const seq = routes[key];
    const step = seq[Math.min(n[key], seq.length - 1)];
    n[key] += 1;
    if (step.gate) await step.gate;
    return res(step.status, step.body);
  };
  return {api, n, waits, sleep: async (ms) => { waits.push(ms); }};
}

test("503 then success shows ON", async () => {
  const flagsOn = {ok: true, flags: {[NFL]: true, [NBA]: 1}};
  const script = scripted({
    auto: [{status: 200, body: {ok: true, enabled: false, auto_push_ft: 0}}],
    flags: [
      {status: 503, body: {error: "db_busy", retry_after: 2}},
      {status: 200, body: flagsOn},
    ],
  });
  const panel = await ctx.ftGradeLoadPanel({
    api: script.api, sleep: script.sleep, gid: "1",
    server: {auto_push_ft: 0, auto_push_ft_nfl: 0, auto_push_ft_nba: 0},
  });
  assert.equal(panel.nfl.status, "on");
  assert.equal(panel.nba.status, "on");
  assert.equal(panel.nfl.on, true);
  assert.equal(panel.nfl.unknown, false);
  assert.equal(panel.nfl.off, false);
  assert.equal(ctx.ftGradeCanSave(panel.nfl.loaded), true);
  assert.deepEqual(script.waits, [2000]);
  assert.equal(script.n.flags, 2);
  const row = ctx.ftGradeSwitchHtml(ctx.FT_GRADE_TOGGLES[1], shown(panel.nfl));
  assert.match(row, /class="toggle on"/);
  assert.match(row, /aria-checked="true"/);
  assert.match(row, /data-ft-loaded="1"/);
  assert.match(row, /data-ft-state="on"/);
  assert.doesNotMatch(row, /disabled/);
});

test("persistent failure shows unknown (not off) and blocks saving", async () => {
  const script = scripted({
    auto: [{status: 503, body: {error: "db_busy", retry_after: 2}}],
    flags: [{status: 503, body: {error: "db_busy", retry_after: 2}}],
  });
  const posts = [];
  const panel = await ctx.ftGradeLoadPanel({api: script.api, sleep: script.sleep, gid: "1"});
  for (const slot of [panel.afl, panel.nfl, panel.nba]) {
    assert.equal(slot.status, "unknown");
    assert.equal(slot.on, false);
    assert.equal(slot.off, false);
    assert.equal(slot.unknown, true);
    assert.equal(ctx.ftGradeCanSave(slot.loaded), false);
    const row = ctx.ftGradeSwitchHtml(
      ctx.FT_GRADE_TOGGLES[slot === panel.afl ? 0 : (slot === panel.nfl ? 1 : 2)],
      shown(slot));
    assert.match(row, /data-ft-state="unknown"/);
    assert.match(row, /disabled/);
    assert.match(row, /data-ft-loaded="0"/);
    assert.doesNotMatch(row, /class="toggle on"/);
    assert.doesNotMatch(row, /data-ft-state="off"/);
  }
  assert.equal(panel.note, read("FT_GRADE_LOAD_NOTE"));
  assert.match(panel.note, /Couldn't load, retry/);
  assert.equal(script.n.flags, read("FT_GRADE_LOAD_TRIES"));
  assert.equal(script.n.auto, read("FT_GRADE_LOAD_TRIES"));
  assert.equal(script.waits.length, (read("FT_GRADE_LOAD_TRIES") - 1) * 2);
  // The click handler refuses to POST until the real state is loaded.
  assert.match(html, /if\(!ftGradeCanSave\(btn\.dataset\.ftLoaded\)\) return;/);
  function click(loaded) {
    if (!ctx.ftGradeCanSave(loaded)) return;
    posts.push(loaded);
  }
  click(panel.nfl.loaded);
  click("0");
  assert.deepEqual(posts, []);
  click("1");
  assert.deepEqual(posts, ["1"]);
  assert.match(html, /id="autopush-load"/);
  assert.match(html, /Couldn't load, retry/);
});

test("a missing key isn't on", async () => {
  const script = scripted({
    auto: [{status: 200, body: {ok: true}}],
    flags: [{status: 200, body: {ok: true, flags: {"feat.other": true}}}],
  });
  const panel = await ctx.ftGradeLoadPanel({
    api: script.api, sleep: script.sleep, gid: "1",
    server: {auto_push_ft_nfl: 0, auto_push_ft_nba: 0},
  });
  assert.equal(ctx.ftGradeFromFlags({}, NFL), null);
  assert.equal(ctx.ftGradeFromFlags({flags: {}}, NFL), null);
  assert.equal(panel.nfl.on, false);
  assert.equal(panel.nba.on, false);
  assert.equal(panel.afl.on, false);
  assert.notEqual(panel.nfl.status, "on");
  assert.notEqual(panel.nba.status, "on");
  assert.notEqual(panel.afl.status, "on");
  assert.equal(panel.nfl.status, "unknown");
  assert.equal(panel.nba.status, "unknown");
  assert.equal(panel.afl.status, "unknown");
  assert.equal(panel.nfl.off, false);
  assert.equal(ctx.ftGradeCanSave(panel.nfl.loaded), false);
  assert.equal(panel.note, read("FT_GRADE_LOAD_NOTE"));
  assert.equal(script.n.flags, read("FT_GRADE_LOAD_TRIES"));
  const row = ctx.ftGradeSwitchHtml(ctx.FT_GRADE_TOGGLES[1], shown(panel.nfl));
  assert.doesNotMatch(row, /class="toggle on"/);
  assert.match(row, /data-ft-state="unknown"/);
});

test("a late auto-push response does not paint NFL or NBA off", async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const seen = [];
  const script = scripted({
    auto: [{status: 200, body: {ok: true, enabled: false, auto_push_ft: 0}, gate}],
    flags: [{status: 200, body: {ok: true, flags: {[NFL]: true, [NBA]: 1}}}],
  });
  const pending = ctx.ftGradeLoadPanel({
    api: script.api, sleep: script.sleep, gid: "9",
    server: {auto_push_ft_nfl: 0, auto_push_ft_nba: 0, auto_push_ft: 1},
    onApply(s) { seen.push({afl: s.afl.status, nfl: s.nfl.status, nba: s.nba.status}); },
  });
  let panel;
  try {
    for (let i = 0; i < 5 && !seen.some((s) => s.nfl === "on"); i++) {
      await new Promise((r) => setImmediate(r));
    }
    assert.ok(seen.some((s) => s.nfl === "on" && s.nba === "on" && s.afl === "unknown"));
    release();
    panel = await pending;
  } finally {
    release();
  }
  assert.equal(panel.afl.status, "off");
  assert.equal(panel.nfl.status, "on");
  assert.equal(panel.nba.status, "on");
  assert.ok(seen.every((s) => s.nfl !== "off" && s.nba !== "off"));
  const loader = html.slice(html.indexOf("async function loadAutoPushState"), html.indexOf("/* ---------- FOLLOWERS"));
  assert.match(loader, /ftGradeLoadPanel/);
  assert.match(loader, /gen!==ftGradeGen/);
  assert.doesNotMatch(loader, /s\[field\]===(?:true|1)/);
});
