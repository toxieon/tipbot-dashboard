// node --test tests/   A server page never shows another server's connectors.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const S = require(path.join(root, "assets", "owner-server.js"));

function el(attrs) {
  const node = {
    attrs: Object.assign({}, attrs || {}),
    children: [],
    innerHTML: "",
    isConnected: true,
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
  };
  return node;
}

test("stop ends the old page's panels", () => {
  let stopped = 0;
  const client = { _cxStop() { stopped += 1; } };
  const push = { _psStop() { stopped += 1; } };
  const detail = el();
  detail.querySelector = function (sel) { return sel === "[data-cx-client]" ? client : sel === "[data-cx-push]" ? push : null; };
  S.stop(detail);
  assert.equal(stopped, 2);
  S.stop(null);
});

test("a ctx for another server is refused", () => {
  const detail = el({ "data-guild-id": "222" });
  assert.equal(S.sameServer({ gid: "222", detail: detail }), true);
  assert.equal(S.sameServer({ gid: "111", detail: detail }), false);
  assert.equal(S.sameServer({ gid: "", detail: detail }), false);
  assert.equal(S.sameServer({ gid: "111", detail: el() }), true);
});

test("attach and render do nothing for a stale server", () => {
  const body = el();
  body.innerHTML = "old";
  let asked = 0;
  const detail = el({ "data-guild-id": "222" });
  detail.querySelector = function (sel) { asked += 1; return sel === "#settings-body" ? body : null; };
  S.attach({ owner: true, gid: "111", detail: detail });
  assert.equal(asked, 0, "a stale attach never touches the page");
  S.renderConnectors({ owner: true, gid: "111", detail: detail });
  assert.equal(body.innerHTML, "");
});

test("the server page stamps its id, stops old panels, and ignores a late owner-tools load", () => {
  assert.match(html, /\$\("detail"\)\.setAttribute\("data-guild-id", String\(s\.guild_id\)\)/);
  assert.match(html, /TBOwnerServer\.stop\(\$\("detail"\)\)/);
  const start = html.indexOf("if(isAdmin) loadOwnerServer().then(function(){");
  assert.ok(start > 0);
  const block = html.slice(start, start + 400);
  assert.match(block, /if\(gen!==DETAIL_RENDER_GEN\) return;/);
});
