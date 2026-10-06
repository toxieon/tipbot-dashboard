// node --test tests/   0.43.6: tipster form dots and streak, only when the API sends form.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const FB = require("../assets/form-badges.js");
const RP = require("../assets/req-pool.js");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const version = fs.readFileSync(path.join(root, "VERSION"), "utf8").trim();

function dots(htmlStr){
  return [...htmlStr.matchAll(/background:(var\(--(?:win|loss|muted)\))/g)].map((m) => m[1]);
}

test("absent or empty form renders nothing", () => {
  assert.equal(FB.render(null), "");
  assert.equal(FB.render(undefined), "");
  assert.equal(FB.render([]), "");
  assert.equal(FB.render({}), "");
  assert.equal(FB.render({last10: [], streak: {type: null, n: 0}, hot: false}), "");
  assert.equal(FB.render({last10: ["X", ""], streak: {type: "W", n: 0}, hot: false}), "");
  assert.equal(FB.render({streak: {type: null, n: 4}}), "");
  assert.equal(FB.render({streak: {type: "W", n: Infinity}}), "");
});

test("dots are newest-left, at most 10, win/loss/push-void", () => {
  const htmlStr = FB.render({last10: ["W", "L", "P", "win", "loss", "push", "V", "VOID"], hot: false});
  assert.deepEqual(dots(htmlStr), [
    "var(--win)", "var(--loss)", "var(--muted)",
    "var(--win)", "var(--loss)", "var(--muted)", "var(--muted)", "var(--muted)",
  ]);
  assert.equal((htmlStr.match(/tb-form-dot/g) || []).length, 8);
  const long = FB.render({last10: ["W", "W", "W", "W", "W", "W", "W", "W", "W", "W", "L"]});
  assert.deepEqual(dots(long), Array(10).fill("var(--win)"));
  const skip = FB.render({last10: ["W", "nope", "L"]});
  assert.deepEqual(dots(skip), ["var(--win)", "var(--loss)"]);
});

test("hot pill is 🔥 nT; otherwise a quiet streak when n>0", () => {
  const hot = FB.render({last10: ["W", "W", "W"], streak: {type: "W", n: 3}, hot: true});
  assert.match(hot, /class="tb-form-hot"[^>]*>🔥 3W</);
  assert.doesNotMatch(hot, /tb-form-streak/);
  const quiet = FB.render({last10: ["L", "L"], streak: {type: "l", n: "2"}, hot: false});
  assert.match(quiet, /class="tb-form-streak"[^>]*>L2</);
  assert.doesNotMatch(quiet, /🔥/);
  const one = FB.render({streak: {type: "L", n: 1.9}});
  assert.match(one, />L1</);
  assert.equal(FB.render({streak: {type: "W", n: 0}}), "");
  const bare = FB.render({hot: true});
  assert.match(bare, />🔥</);
  assert.doesNotMatch(bare, /tb-form-streak/);
});

test("one accessible name: last 10 letters, streak words, hot", () => {
  const hot = FB.render({last10: ["W", "W", "L"], streak: {type: "W", n: 3}, hot: true});
  assert.match(hot, /role="img"/);
  assert.match(hot, /aria-label="Last 10: W W L Streak 3 wins Hot"/);
  assert.match(hot, /aria-hidden="true"/);
  const loss = FB.render({streak: {type: "L", n: 1}});
  assert.match(loss, /aria-label="Streak 1 loss"/);
  assert.doesNotMatch(loss, /Last 10/);
  const wins = FB.render({streak: {type: "W", n: 2}});
  assert.match(wins, /aria-label="Streak 2 wins"/);
});

test("tipster list keeps API order, skips empty form, escapes names", () => {
  assert.equal(FB.renderList(null), "");
  assert.equal(FB.renderList([]), "");
  const htmlStr = FB.renderList([
    {user_id: "1", name: "Cold", form: {last10: ["L"], streak: {type: "L", n: 1}}},
    {user_id: "2", name: "No form"},
    {user_id: "3", name: '<b>Hot & "A"</b>', form: {last10: ["W"], streak: {type: "W", n: 3}, hot: true}},
    {user_id: "9", form: {hot: true}},
  ]);
  const names = [...htmlStr.matchAll(/tb-form-name">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(names, ["Cold", "&lt;b&gt;Hot &amp; &quot;A&quot;&lt;/b&gt;", "9"]);
  assert.ok(htmlStr.indexOf("Cold") < htmlStr.indexOf("Hot"));
  assert.match(htmlStr, /class="tb-form-list"/);
});

test("the page loads the helper at this version and paints the four surfaces", () => {
  assert.match(html, new RegExp('<script src="\\./assets/form-badges\\.js\\?v=' + version.replace(/\./g, "\\.") + '"></script>'));
  assert.match(html, /FormBadges\.render\(t\.form\)/);
  assert.match(html, /FormBadges\.render\(featured\.form\)/);
  assert.match(html, /FormBadges\.render\(f\.form\)/);
  const profile = html.slice(html.indexOf("function renderFollowerView"), html.indexOf("async function openFollowerAllView"));
  const detail = html.slice(html.indexOf("function renderDetail"), html.indexOf("function mountScheduled"));
  assert.match(profile, /FormBadges\.render\(d\.form\)/);
  assert.match(detail, /FormBadges\.render\(d\.form\)/);
  const rollup = html.slice(html.indexOf("function renderFollowerAllView"), html.indexOf("function followersCacheKey"));
  assert.doesNotMatch(rollup, /FormBadges/);
  assert.doesNotMatch(html, /formArr/);
});

test("server page asks for tipster form only when form is present, through the DB queue", () => {
  const detail = html.slice(html.indexOf("function renderDetail"), html.indexOf("function mountScheduled"));
  const load = html.slice(html.indexOf("async function loadTipsterForm"), html.indexOf("function renderDetail"));
  assert.match(detail, /const formOn=d\.form!=null&&typeof d\.form==="object"&&!Array\.isArray\(d\.form\)/);
  assert.match(detail, /formOn\?'<div id="tipster-form-slot"><\/div>':''/);
  assert.match(detail, /if\(formOn&&s\.guild_id!=null\) loadTipsterForm\(s\.guild_id\)/);
  assert.match(load, /api\("\/api\/tipster-form\?guild_id="/);
  assert.match(load, /gen!==TIPSTER_FORM_GEN/);
  assert.match(load, /FormBadges\.renderList/);
  assert.doesNotMatch(load, /fetch\(/);
  assert.doesNotMatch(load, /toast\(/);
  assert.equal(RP.dbSlotExempt("/api/tipster-form?guild_id=1"), false);
});
