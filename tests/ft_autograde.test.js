// node --test tests/   Full-time auto-grade: AFL stays on /api/auto-push; NFL and NBA/WNBA
// are their own switches (feat.auto_push_ft_nfl / feat.auto_push_ft_nba), default off.
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
