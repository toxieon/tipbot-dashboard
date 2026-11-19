// node --test tests/   Open Black Book: owner menu row, fragment address, no query value.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const HTML = read("index.html");
const SRC = read("assets/open-blackbook.js");
const APEX = read("assets/theme-apex.css");
const M = require("../assets/open-blackbook.js");

const ORIGIN = "https://www.neilldata.com";
const BB_PATH = "/blackbook/";

function word(parts) {
  return parts.join("");
}

function bannedHit(text) {
  const needles = [word(["ops", ":"]), word(["for", "ward"]), word(["con", "nector"])];
  const lower = String(text).toLowerCase();
  for (const needle of needles) {
    if (lower.indexOf(needle.toLowerCase()) !== -1) return needle;
  }
  return "";
}

function node(tag) {
  const el = {
    tagName: String(tag || "div").toUpperCase(),
    id: "",
    className: "",
    children: [],
    parentNode: null,
    attrs: {},
    textContent: "",
    style: {},
    setAttribute(name, value) {
      this.attrs[name] = String(value);
      if (name === "id") this.id = String(value);
      if (name === "class") this.className = String(value);
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    removeAttribute(name) { delete this.attrs[name]; },
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    insertBefore(child, before) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      const at = this.children.indexOf(before);
      if (at < 0) this.children.push(child);
      else this.children.splice(at, 0, child);
      return child;
    },
    removeChild(child) {
      const at = this.children.indexOf(child);
      if (at >= 0) this.children.splice(at, 1);
      child.parentNode = null;
      return child;
    },
    querySelector(sel) {
      const id = sel.charAt(0) === "#" ? sel.slice(1) : "";
      const walk = (n) => {
        if (id && n.id === id) return n;
        for (const child of n.children) {
          const hit = walk(child);
          if (hit) return hit;
        }
        return null;
      };
      return walk(this);
    },
  };
  Object.defineProperty(el, "search", {
    get() {
      const href = this.attrs.href || "";
      try { return new URL(href).search; } catch (e) { return ""; }
    },
  });
  return el;
}

function menu() {
  const box = node("div");
  box.id = "dropdown";
  const label = node("div");
  label.className = "dd-label";
  label.textContent = "Settings";
  const logout = node("div");
  logout.id = "dd-logout";
  logout.textContent = "Log out";
  box.appendChild(label);
  box.appendChild(logout);
  return box;
}

function itemText(el) {
  if (!el) return "";
  return el.textContent + el.children.map(itemText).join("");
}

function findId(el, id) {
  if (!el) return null;
  if (el.id === id) return el;
  for (const child of el.children || []) {
    const hit = findId(child, id);
    if (hit) return hit;
  }
  return null;
}

function assertFragment(href, token) {
  assert.equal(typeof href, "string");
  const hashAt = href.indexOf("#");
  assert.ok(hashAt > 0);
  assert.equal(href.slice(0, hashAt), ORIGIN + BB_PATH);
  assert.equal(href.slice(hashAt), "#t=" + encodeURIComponent(token));
  const url = new URL(href);
  assert.equal(url.origin, ORIGIN);
  assert.equal(url.pathname, BB_PATH);
  assert.equal(url.search, "");
  assert.equal(decodeURIComponent(url.hash.slice(3)), token);
  assert.equal(href.indexOf("?"), -1);
  assert.equal(href.slice(0, hashAt).indexOf(token), -1);
}

const doc = { createElement: node, createElementNS: (_ns, tag) => node(tag) };

test("the address is the fixed Black Book page with the session value in the fragment only", () => {
  assert.equal(M.ORIGIN, ORIGIN);
  assert.equal(M.PATH, BB_PATH);
  assert.equal(M.blackbookUrl(""), "");
  assert.equal(M.blackbookUrl(null), "");
  assert.equal(M.blackbookUrl(undefined), "");
  for (const token of ["abc", "a b/?#&=+", "https://evil.example/steal?x=1", "100%", "t.abc.def"]) {
    assertFragment(M.blackbookUrl(token), token);
  }
});

test("the row is created only for the owner when a session value exists", () => {
  const box = menu();
  assert.equal(M.paint(box, { owner: false, token: "abc", doc: doc }), null);
  assert.equal(findId(box, M.ITEM_ID), null);
  assert.equal(M.paint(box, { owner: true, token: "", doc: doc }), null);
  assert.equal(M.paint(box, { owner: true, token: null, doc: doc }), null);
  assert.equal(findId(box, M.ITEM_ID), null);

  const token = "sess ion/?#";
  const el = M.paint(box, { owner: true, token: token, doc: doc });
  assert.ok(el);
  assert.equal(el, findId(box, M.ITEM_ID));
  assert.equal(box.children[0].className, "dd-label");
  assert.equal(box.children[1], el);
  assert.equal(box.children[2].id, "dd-logout");
  assert.equal(el.getAttribute("target"), "_blank");
  assert.equal(el.getAttribute("rel"), "noopener noreferrer");
  assert.equal(el.getAttribute("referrerpolicy"), "no-referrer");
  assert.match(itemText(el), /Open Black Book/);
  assert.doesNotMatch(itemText(box), /Open Models/);
  assertFragment(el.getAttribute("href"), token);
  assert.equal(el.search, "");

  assert.equal(M.paint(box, { owner: true, token: "next", doc: doc }), el);
  assert.equal(box.children.filter((child) => child.id === M.ITEM_ID).length, 1);
  assertFragment(el.getAttribute("href"), "next");

  assert.equal(M.paint(box, { owner: false, token: "next", doc: doc }), null);
  assert.equal(findId(box, M.ITEM_ID), null);
  M.paint(box, { owner: true, token: "next", doc: doc });
  assert.equal(M.paint(box, { owner: true, token: "", doc: doc }), null);
  assert.equal(findId(box, M.ITEM_ID), null);
});

test("it works on a live DOM children collection, which has no indexOf or splice", () => {
  const box = menu();
  const real = box.children;
  // An HTMLCollection is array-like: length and indexes, no array methods.
  const collection = () => {
    const live = { length: real.length };
    real.forEach((child, at) => { live[at] = child; });
    return live;
  };
  // The page's DOM methods work on the real list; the module only sees the collection.
  Object.defineProperty(box, "children", { get: collection });
  box.insertBefore = (child, before) => {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = box;
    const at = real.indexOf(before);
    if (at < 0) real.push(child); else real.splice(at, 0, child);
    return child;
  };
  box.removeChild = (child) => {
    const at = real.indexOf(child);
    if (at >= 0) real.splice(at, 1);
    child.parentNode = null;
    return child;
  };
  const el = M.paint(box, { owner: true, token: "tok", doc: doc });
  assert.ok(el);
  assert.equal(real.indexOf(el), 1);
  assert.equal(real[2].id, "dd-logout");
  assert.equal(M.paint(box, { owner: false, token: "tok", doc: doc }), null);
  assert.equal(real.filter((child) => child.id === M.ITEM_ID).length, 0);
  assert.doesNotMatch(SRC, /\.indexOf\(\s*(?:models|kids)/);
});

test("the page paints the row from the same owner check and does not bake it into the markup", () => {
  assert.doesNotMatch(HTML, /id="dd-open-blackbook"/);
  assert.doesNotMatch(HTML, /neilldata\.com/);
  assert.match(HTML, /<script src="\.\/assets\/open-blackbook\.js\?v=__TD_VERSION__"><\/script>/);
  assert.match(HTML, /function paintOpenBlackBook\(\)\{/);
  assert.match(HTML, /TBOpenBlackBook\.paint\(\$\("dropdown"\), \{ owner: ownerSettingsAllowed\(\), token: getToken\(\) \}\)/);
  assert.match(HTML, /function paintOwnerSettingsEntry\(\)\{[^\n]*paintOpenBlackBook\(\); \}/);
  assert.match(HTML, /function syncGlobalSession\(\)\{[\s\S]*paintOpenBlackBook\(\);/);
  assert.match(HTML, /\.dd-item-main\{display:inline-flex;align-items:center;gap:8px;min-width:0\}/);
  assert.match(APEX, /html\[data-theme="apex"\] \.dd-ico\{[\s\S]*?stroke:currentColor/);
  assert.doesNotMatch(SRC, /https:\/\/neilldata\.com\/blackbook/);
  assert.match(SRC, /https:\/\/www\.neilldata\.com\/blackbook\//);
  assert.doesNotMatch(SRC, /models/i);
  assert.doesNotMatch(SRC, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  assert.doesNotMatch(SRC, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
  assert.doesNotMatch(SRC, /localStorage\.setItem|sessionStorage/);
  assert.equal(bannedHit(SRC), "");
  assert.equal(bannedHit(APEX), "");
  const fn = HTML.slice(HTML.indexOf("function paintOpenBlackBook"), HTML.indexOf("function paintOwnerSettingsEntry"));
  assert.equal(bannedHit(fn), "");
});

test("reading the session value does not throw when storage is missing", () => {
  assert.equal(M.readToken({ getItem: () => null }), "");
  assert.equal(M.readToken({ getItem: () => "" }), "");
  assert.equal(M.readToken({ getItem: () => "abc" }), "abc");
  assert.equal(M.readToken({ getItem: () => { throw new Error("blocked"); } }), "");
});
