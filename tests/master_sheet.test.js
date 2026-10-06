// node --test tests/   Master confirms/sheets open on top of the page and take focus.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("master page is not a scroll container, so fixed sheets are not trapped behind it", () => {
  const html = read("master/index.html");
  assert.match(html, /@supports \(overflow:clip\)\{html,body\{overflow-x:clip\}\}/);
  assert.match(html, /Turn forwarding "\+\(b\.checked\?"on":"off"\)\+" for this server\?/);
  assert.match(html, /if\(window\.TBSheet && typeof window\.TBSheet\.confirm==="function"\) return window\.TBSheet\.confirm\(o\);/);
});

function makeEl(tag) {
  const node = {
    tagName: String(tag).toUpperCase(), id: "", className: "", textContent: "",
    children: [], parentNode: null, attributes: {}, dataset: {}, style: {}, popoverShown: false
  };
  Object.defineProperty(node, "firstChild", {get() { return node.children[0] || null; }});
  Object.defineProperty(node, "lastChild", {get() { return node.children[node.children.length - 1] || null; }});
  Object.defineProperty(node, "innerHTML", {
    get() { return node._html || ""; },
    set(v) {
      node._html = String(v);
      node.children = parseHTML(String(v));
      node.children.forEach((c) => { c.parentNode = node; });
      stamp(node, node.ownerDocument);
    }
  });
  node.classList = {
    add() {}, remove() {},
    contains: (c) => node.className.split(/\s+/).includes(c)
  };
  node.setAttribute = (k, v) => { node.attributes[k] = String(v); if (k === "id") node.id = String(v); };
  node.getAttribute = (k) => (k in node.attributes ? node.attributes[k] : null);
  node.removeAttribute = (k) => { delete node.attributes[k]; };
  node.appendChild = (c) => { c.parentNode = node; node.children.push(c); return c; };
  node.removeChild = (c) => { node.children = node.children.filter((x) => x !== c); c.parentNode = null; };
  node.addEventListener = () => {};
  node.removeEventListener = () => {};
  node.getBoundingClientRect = () => ({height: 120, width: 400, top: 0, left: 0, bottom: 120, right: 400});
  node.focus = () => { node.ownerDocument.activeElement = node; };
  node.showPopover = () => {
    if (node.getAttribute("popover") == null) throw new Error("not a popover");
    node.popoverShown = true;
  };
  node.hidePopover = () => { node.popoverShown = false; };
  node.matches = (sel) => sel === ":popover-open" ? node.popoverShown : false;
  node.contains = (n) => n === node || node.children.some((c) => c.contains && c.contains(n));
  node.querySelectorAll = (sel) => {
    const out = [];
    (function walk(n) {
      for (const c of n.children || []) {
        if (selMatch(c, sel)) out.push(c);
        walk(c);
      }
    })(node);
    return out;
  };
  node.querySelector = (sel) => node.querySelectorAll(sel)[0] || null;
  return node;
}
function selMatch(node, sel) {
  if (sel.startsWith(".")) return (node.className || "").split(/\s+/).includes(sel.slice(1));
  const attr = sel.match(/^\[([^\]]+)="([^"]*)"\]$/);
  return !!(attr && node.attributes && node.attributes[attr[1]] === attr[2]);
}
function applyAttrs(node, raw) {
  const re = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(raw))) {
    node.attributes[m[1]] = m[2];
    if (m[1] === "class") node.className = m[2];
    if (m[1] === "id") node.id = m[2];
  }
}
function parseHTML(html) {
  const roots = [];
  const stack = [{children: roots}];
  const re = /<([a-zA-Z0-9]+)([^>]*)>|<\/[a-zA-Z0-9]+>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      const node = makeEl(m[1]);
      applyAttrs(node, m[2] || "");
      stack[stack.length - 1].children.push(node);
      const self = /\/\s*$/.test(m[2] || "") || /^(input|br|hr|img|meta|link)$/i.test(m[1]);
      if (!self) stack.push({el: node, children: node.children});
    } else if (m[0].startsWith("</")) {
      if (stack.length > 1) stack.pop();
    } else if (m[3]) {
      const t = makeEl("#text");
      t.textContent = m[3];
      stack[stack.length - 1].children.push(t);
    }
  }
  return roots;
}
function stamp(n, doc) {
  if (!n || !doc) return;
  n.ownerDocument = doc;
  for (const c of n.children || []) stamp(c, doc);
}
function findId(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children || []) {
    const f = findId(c, id);
    if (f) return f;
  }
  return null;
}

test("TBSheet.confirm opens above the page and focuses the confirm button", () => {
  const document = {
    readyState: "complete", activeElement: null,
    createElement: (tag) => {
      const n = makeEl(tag);
      n.ownerDocument = document;
      return n;
    },
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => []
  };
  document.documentElement = makeEl("html");
  document.head = makeEl("head");
  document.body = makeEl("body");
  document.head.ownerDocument = document;
  document.body.ownerDocument = document;
  document.getElementById = (id) => findId(document.head, id) || findId(document.body, id);
  const ctx = {
    document, setTimeout, clearTimeout,
    matchMedia: (q) => ({matches: /min-width:\s*641/.test(q) || /prefers-reduced-motion:\s*reduce/.test(q), addEventListener() {}, removeEventListener() {}}),
    requestAnimationFrame: (f) => setTimeout(f, 16), cancelAnimationFrame: clearTimeout,
    performance: {now: () => 0}
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(read("assets/tb-motion.js"), ctx);
  const pending = ctx.TBSheet.confirm({title: "Turn forwarding on for this server?", confirmLabel: "Turn on"});
  assert.equal(typeof pending.then, "function");
  const sheet = document.body.children.find((n) => String(n.className).includes("tbs-root"));
  assert.ok(sheet, "sheet is on the page");
  assert.equal(sheet.getAttribute("popover"), "manual");
  assert.equal(sheet.popoverShown, true, "sheet is in the top layer");
  assert.equal(sheet.style.zIndex, "1000");
  const css = document.getElementById("tbs-css").textContent;
  assert.match(css, /\.tbs-root\{[^}]*z-index:1000/);
  assert.equal(document.activeElement && document.activeElement.getAttribute("data-act"), "ok");
  const body = sheet.querySelector(".tbs-body");
  assert.match(body.innerHTML, /Turn forwarding on for this server\?/);
  assert.match(body.innerHTML, />Turn on</);
});
