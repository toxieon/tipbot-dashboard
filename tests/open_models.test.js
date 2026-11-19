// node --test tests/   Open Models: owner menu row, fragment address, no query value.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const HTML = read("index.html");
const SRC = read("assets/open-models.js");
const APEX = read("assets/theme-apex.css");
const M = require("../assets/open-models.js");

const ORIGIN = "https://www.neilldata.com";
const MODELS_PATH = "/models/";

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
  assert.ok(href.length > 0);
  const hashAt = href.indexOf("#");
  assert.ok(hashAt > 0);
  assert.equal(href.slice(0, hashAt), ORIGIN + MODELS_PATH);
  assert.equal(href.slice(hashAt), "#t=" + encodeURIComponent(token));
  const url = new URL(href);
  assert.equal(url.origin, ORIGIN);
  assert.equal(url.pathname, MODELS_PATH);
  assert.equal(url.search, "");
  assert.equal(url.searchParams.toString(), "");
  assert.equal(decodeURIComponent(url.hash.slice(3)), token);
  assert.equal(href.indexOf("?"), -1);
  assert.equal(href.slice(0, hashAt).indexOf(token), -1);
}

test("the address keeps the session value in the fragment only", () => {
  assert.equal(M.ORIGIN, ORIGIN);
  assert.equal(M.PATH, MODELS_PATH);
  assert.equal(M.modelsUrl(""), "");
  assert.equal(M.modelsUrl(null), "");
  assert.equal(M.modelsUrl(undefined), "");
  for (const token of ["abc", "a b/?#&=+", "https://evil.example/steal?x=1", "100%", "t.abc.def"]) {
    assertFragment(M.modelsUrl(token), token);
  }
});

test("the row is created only for the owner when a session value exists", () => {
  const box = menu();
  const doc = { createElement: node, createElementNS: (_ns, tag) => node(tag) };
  assert.equal(M.paint(box, { owner: false, token: "abc", doc: doc }), null);
  assert.equal(findId(box, M.ITEM_ID), null);
  assert.equal(itemText(box).indexOf("Open Models"), -1);

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
  assert.match(itemText(el), /Open Models/);
  assert.equal(el.getAttribute("class"), "dd-item");
  const icon = el.children[0].children[0];
  assert.equal(icon.getAttribute("class"), "dd-ico");
  assert.match(icon.children[0].getAttribute("d"), /M4 19h16/);
  assertFragment(el.getAttribute("href"), token);
  assert.equal(el.search, "");

  const again = M.paint(box, { owner: true, token: "next", doc: doc });
  assert.equal(again, el);
  assert.equal(box.children.filter((child) => child.id === M.ITEM_ID).length, 1);
  assertFragment(el.getAttribute("href"), "next");

  assert.equal(M.paint(box, { owner: false, token: "next", doc: doc }), null);
  assert.equal(findId(box, M.ITEM_ID), null);
  assert.equal(itemText(box).indexOf("Open Models"), -1);

  M.paint(box, { owner: true, token: "next", doc: doc });
  assert.equal(M.paint(box, { owner: true, token: "", doc: doc }), null);
  assert.equal(findId(box, M.ITEM_ID), null);
});

test("the page uses the same owner check and does not bake the row into the markup", () => {
  assert.doesNotMatch(HTML, /id="dd-open-models"/);
  assert.doesNotMatch(HTML, /neilldata\.com/);
  assert.match(HTML, /<script src="\.\/assets\/open-models\.js\?v=__TD_VERSION__"><\/script>/);
  assert.match(HTML, /function paintOpenModels\(\)\{/);
  assert.match(HTML, /TBOpenModels\.paint\(\$\("dropdown"\), \{ owner: ownerSettingsAllowed\(\), token: getToken\(\) \}\)/);
  assert.match(HTML, /function paintOwnerSettingsEntry\(\)\{ const ok=ownerSettingsAllowed\(\); for\(const id of \["dd-extra-settings","dd-predictor"\]\)\{ const e=\$\(id\); if\(e\) e\.hidden=!ok; \} paintOpenModels\(\); \}/);
  assert.match(HTML, /function syncGlobalSession\(\)\{[\s\S]*paintOpenModels\(\);/);
  assert.match(HTML, /\.dd-item-main\{display:inline-flex;align-items:center;gap:8px;min-width:0\}/);
  assert.match(HTML, /\.dd-ico\{width:16px;height:16px;flex:none;display:block\}/);
  assert.match(APEX, /html\[data-theme="apex"\] \.dd-ico\{[\s\S]*?stroke:currentColor/);
  assert.match(APEX, /html\[data-theme="apex"\] \.dd-item-main\{display:inline-flex/);
  assert.doesNotMatch(SRC, /https:\/\/neilldata\.com\/models/);
  assert.match(SRC, /https:\/\/www\.neilldata\.com\/models\//);
  assert.doesNotMatch(SRC, /console\.(?:log|debug|info|warn|error|trace)\s*\(/);
  assert.doesNotMatch(SRC, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);
  assert.doesNotMatch(SRC, /localStorage\.setItem|sessionStorage/);
  assert.equal(bannedHit(SRC), "");
  assert.equal(bannedHit(APEX), "");
  const fn = HTML.slice(HTML.indexOf("function paintOpenModels"), HTML.indexOf("function paintOwnerSettingsEntry"));
  assert.equal(bannedHit(fn), "");
});

test("reading the session value does not throw when storage is missing", () => {
  assert.equal(M.readToken({ getItem: () => null }), "");
  assert.equal(M.readToken({ getItem: () => "" }), "");
  assert.equal(M.readToken({ getItem: () => "abc" }), "abc");
  assert.equal(M.readToken({ getItem: () => { throw new Error("blocked"); } }), "");
});

// ── Open Black Book: owner row next to Open Models ─────────────────────────
test("the Black Book address is the fixed page with the session value in the fragment only", () => {
  assert.equal(M.BLACKBOOK_PATH, "/blackbook/");
  assert.equal(M.blackbookUrl(""), "");
  assert.equal(M.blackbookUrl(null), "");
  for (const token of ["abc", "a b/?#&=+", "https://evil.example/steal?x=1", "100%", "t.abc.def"]) {
    const href = M.blackbookUrl(token);
    assert.equal(href.split("#")[0], ORIGIN + "/blackbook/");
    assert.equal(href.slice(href.indexOf("#")), "#t=" + encodeURIComponent(token));
    assert.equal(new URL(href).search, "");
  }
});

test("the Black Book row is owner only, sits right after Open Models, and leaves with the owner", () => {
  const box = menu();
  const doc = { createElement: node, createElementNS: (_ns, tag) => node(tag) };
  assert.equal(M.paintBlackBook(box, { owner: false, token: "abc", doc: doc }), null);
  assert.equal(M.paintBlackBook(box, { owner: true, token: "", doc: doc }), null);
  assert.equal(itemText(box).indexOf("Open Black Book"), -1);

  const models = M.paint(box, { owner: true, token: "tok", doc: doc });
  const book = M.paintBlackBook(box, { owner: true, token: "tok", doc: doc });
  assert.ok(models && book);
  assert.deepEqual(box.children.map((c) => c.id || c.className), ["dd-label", M.ITEM_ID, M.BLACKBOOK_ITEM_ID, "dd-logout"]);
  assert.equal(book.getAttribute("target"), "_blank");
  assert.equal(book.getAttribute("rel"), "noopener noreferrer");
  assert.equal(book.getAttribute("referrerpolicy"), "no-referrer");
  assert.match(itemText(book), /Open Black Book/);
  assert.equal(book.getAttribute("href"), ORIGIN + "/blackbook/#t=tok");
  assert.equal(book.search, "");
  assert.equal(models.getAttribute("href"), ORIGIN + "/models/#t=tok");

  // Painting again does not add a second row.
  M.paintBlackBook(box, { owner: true, token: "next", doc: doc });
  assert.equal(box.children.filter((c) => c.id === M.BLACKBOOK_ITEM_ID).length, 1);
  assert.equal(book.getAttribute("href"), ORIGIN + "/blackbook/#t=next");

  // Black Book painted first, then Models: the order is still Models, Black Book.
  const flipped = menu();
  M.paintBlackBook(flipped, { owner: true, token: "tok", doc: doc });
  M.paint(flipped, { owner: true, token: "tok", doc: doc });
  assert.deepEqual(flipped.children.map((c) => c.id || c.className), ["dd-label", M.ITEM_ID, M.BLACKBOOK_ITEM_ID, "dd-logout"]);

  // Not the owner (or view-as, or no session value): the row is removed, Models too.
  assert.equal(M.paintBlackBook(box, { owner: false, token: "next", doc: doc }), null);
  assert.equal(findId(box, M.BLACKBOOK_ITEM_ID), null);
  assert.ok(findId(box, M.ITEM_ID));
});

test("the page paints the Black Book row from the same owner check", () => {
  assert.doesNotMatch(HTML, /id="dd-open-blackbook"/);
  assert.match(HTML, /TBOpenModels\.paintBlackBook\(\$\("dropdown"\), \{ owner: ownerSettingsAllowed\(\), token: getToken\(\) \}\)/);
  assert.doesNotMatch(SRC, /https:\/\/neilldata\.com\/blackbook/);
  assert.match(SRC, /https:\/\/www\.neilldata\.com\/blackbook\//);
  assert.equal(bannedHit(SRC), "");
});

test("child lookups work on a live DOM collection, which has no indexOf", () => {
  assert.doesNotMatch(SRC, /kids\.indexOf\(/);
  assert.match(SRC, /Array\.prototype\.indexOf\.call\(kids, models\)/);
});
