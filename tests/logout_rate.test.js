// node --test tests/   Log out hits POST /api/logout; api() backs off on 429 with Retry-After.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(path.join(__dirname, ".."), "index.html"), "utf8");

test("Log out clears the session after POST /api/logout", () => {
  assert.match(html, /\$\("dd-logout"\)\.onclick=async\(\)=>\{/);
  assert.match(html, /await api\("\/api\/logout",\{method:"POST"/);
  assert.match(html, /clearToken\(\);[\s\S]*renderLogin\(\)/);
});

test("apiRequest retries 429 with Retry-After and shows a warn toast once", () => {
  const start = html.indexOf("async function apiRequest(path,opts)");
  const end = html.indexOf("async function load()", start);
  const fn = html.slice(start, end);
  assert.match(fn, /if\(r\.status===429 && attempt<maxAttempts\)/);
  assert.match(fn, /r\.headers\.get\("Retry-After"\)/);
  assert.match(fn, /toast\("TipBot is busy — slowing down for a moment\.","warn"/);
});
