// node --test tests/   /welcome/ product showcase (public preview).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "welcome/index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/site/site.css"), "utf8");
const js = fs.readFileSync(path.join(root, "assets/site/welcome-showcase.js"), "utf8");

const banned = [/forward/i, /mirror/i, /\bmaster\b/i, /consensus/i, /owner-tools/, /\/api\/ops/, /custom-games/, /ops:/];

test("welcome preview showcases Apex product areas", () => {
  assert.match(html, /Example screens/);
  assert.match(html, /Stats/);
  assert.match(html, /Opening/);
  assert.match(html, /guernsey/i);
  assert.match(html, /multi/i);
  assert.match(html, /data-apex-variant/);
  assert.match(html, /Swipe-back/);
  assert.match(css, /\.phone-screen/);
  assert.match(js, /TBAflGuernseys/);
});

test("welcome avoids banned public strings and nav Home markup", () => {
  assert.doesNotMatch(html, />Home</);
  for (const re of banned) {
    assert.doesNotMatch(html, re, re.toString());
    assert.doesNotMatch(js, re, re.toString());
  }
  assert.doesNotMatch(js, /console\./);
});

test("welcome loads guernsey helper without console", () => {
  assert.match(html, /afl-guernseys\.js/);
  assert.match(html, /welcome-showcase\.js/);
});
