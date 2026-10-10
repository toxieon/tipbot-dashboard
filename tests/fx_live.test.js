// node --test tests/   Live FX assets (race + AFL cartoons).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const racePath = path.join(root, "assets/fx/race-running.js");
const aflPath = path.join(root, "assets/fx/afl-match.js");
const labPath = path.join(root, "labs/fx-live/index.html");
const SECRET_RE = /forward|mirror|master|consensus|owner-tools|\/api\/ops|custom-games|ops:/gi;
const CONSOLE_RE = /console\.(?:log|debug|info|warn|error|trace)\s*\(/;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function scanFile(rel, text) {
  assert.doesNotMatch(text, CONSOLE_RE, rel + " must not use console.*");
  const hits = text.match(SECRET_RE);
  assert.equal(hits, null, rel + " must not contain banned strings: " + (hits || []).join(", "));
}

function makeDom() {
  const nodes = [];
  function el(tag) {
    const node = {
      tagName: String(tag).toUpperCase(),
      children: [],
      attributes: {},
      style: { cssText: "" },
      className: "",
      parentNode: null,
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        const i = this.children.indexOf(child);
        if (i >= 0) this.children.splice(i, 1);
        child.parentNode = null;
      },
      setAttribute(k, v) {
        this.attributes[k] = v;
      },
      getAttribute(k) {
        return this.attributes[k];
      },
      querySelector() {
        return null;
      },
    };
    nodes.push(node);
    return node;
  }
  const document = {
    visibilityState: "visible",
    createElement(tag) {
      return el(tag);
    },
    createElementNS(_ns, tag) {
      const node = el(tag);
      node.setAttribute = function (k, v) {
        this.attributes[k] = v;
      };
      node.innerHTML = "";
      Object.defineProperty(node, "innerHTML", {
        set(v) {
          this._html = v;
        },
        get() {
          return this._html || "";
        },
      });
      return node;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  let rafId = 0;
  const timers = new Map();
  const window = {
    TBLiveFx: undefined,
    document,
    requestAnimationFrame(fn) {
      rafId += 1;
      const id = rafId;
      timers.set(id, fn);
      return id;
    },
    cancelAnimationFrame(id) {
      timers.delete(id);
    },
    performance: { now: () => 1000 },
    matchMedia(q) {
      return { matches: q.indexOf("reduce") >= 0 && window.__reduce === true, media: q };
    },
  };
  window.Date = Date;
  return { window, timers };
}

function loadFx(dom) {
  const ctx = vm.createContext({
    window: dom.window,
    document: dom.window.document,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    performance: dom.window.performance,
    matchMedia: dom.window.matchMedia.bind(dom.window),
    Date: dom.window.Date,
    setTimeout,
    clearTimeout,
  });
  vm.runInContext(fs.readFileSync(racePath, "utf8"), ctx, { filename: "race-running.js" });
  vm.runInContext(fs.readFileSync(aflPath, "utf8"), ctx, { filename: "afl-match.js" });
  return dom.window.TBLiveFx;
}

test("fx assets exist and stay clean", () => {
  assert.ok(fs.existsSync(racePath));
  assert.ok(fs.existsSync(aflPath));
  assert.ok(fs.existsSync(labPath));
  scanFile("assets/fx/race-running.js", read("assets/fx/race-running.js"));
  scanFile("assets/fx/afl-match.js", read("assets/fx/afl-match.js"));
  const lab = read("labs/fx-live/index.html");
  scanFile("labs/fx-live/index.html", lab);
  assert.match(lab, /race-running\.js/);
  assert.match(lab, /afl-match\.js/);
  assert.match(lab, /TBLiveFx\.race/);
  assert.match(lab, /TBLiveFx\.afl/);
});

test("TBLiveFx exposes race, afl and stop", () => {
  const dom = makeDom();
  const Fx = loadFx(dom);
  assert.equal(typeof Fx.race, "function");
  assert.equal(typeof Fx.afl, "function");
  assert.equal(typeof Fx.stop, "function");
  const mount = dom.window.document.createElement("div");
  Fx.race(mount, [{ number: 3, colours: "red,blue" }]);
  assert.ok(mount.children.length > 0);
  assert.equal(mount.children[0].className, "tb-fx-race");
  Fx.stop();
  assert.equal(mount.children.length, 0);
  Fx.afl(mount, ["#111", "#eee"], ["#222", "#ccc"]);
  assert.ok(mount.children.some((c) => c.className === "tb-fx-afl"));
  Fx.stop();
});

test("reduced motion paints a static frame", () => {
  const dom = makeDom();
  dom.window.__reduce = true;
  const Fx = loadFx(dom);
  const mount = dom.window.document.createElement("div");
  Fx.race(mount, [{ number: 1, colours: "#a,#b" }, { number: 2, colours: "#c,#d" }]);
  function htmlDump(node) {
    let s = node._html || "";
    for (const c of node.children || []) s += htmlDump(c);
    return s;
  }
  assert.match(htmlDump(mount), />\s*1\s*</);
  Fx.stop();
  Fx.afl(mount, { primary: "#003", secondary: "#fff" }, { primary: "#600", secondary: "#fcc" });
  Fx.stop();
});
