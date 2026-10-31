// node --test tests/   Build → Import from screenshot: several screenshots become separate tips in a review list.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const TEXT = path.join(__dirname, "fixtures", "slips", "text");
const SRC = fs.readFileSync(path.join(__dirname, "..", "assets", "slip-ocr-ui.js"), "utf8");

function el(id) {
  return { id, innerHTML: "", textContent: "", hidden: false, value: "", files: null, onclick: null, onchange: null, style: {}, querySelectorAll: () => [], querySelector: () => null, addEventListener() {}, setAttribute() {}, getAttribute: () => null };
}

function harness() {
  const els = {};
  const get = (id) => els[id] || (els[id] = el(id));
  const real = require("../assets/slip-ocr.js");
  const Ocr = Object.assign({}, real, {
    recognizeImage: async (_T, file) => ({ text: file.text, lines: [] }),
    loadSportFixtures: async () => [],
  });
  const toasts = [];
  const win = {
    TBSlipOcr: Ocr, Tesseract: {},
    TD: { loaded: {}, version: "t", load: async () => {}, src: () => "" },
    Image: class { set src(_u) { this.naturalWidth = 10; this.naturalHeight = 10; setImmediate(() => this.onload()); } },
    URL: { createObjectURL: (f) => "blob:" + (f && f.name), revokeObjectURL: () => {} },
    document: {
      getElementById: (id) => {
        if (id === "builder") {
          const b = get("builder");
          b.querySelectorAll = () => (b._btns = [...b.innerHTML.matchAll(/<button[^>]*data-act="(\w+)" data-i="(\d+)"[^>]*>/g)].map((m) => (
            { getAttribute: (k) => (k === "data-act" ? m[1] : m[2]) })));
          return b;
        }
        if (id === "slip-batch") return /id="slip-batch"/.test(get("builder").innerHTML) ? get(id) : null;
        return els[id] || (/^(slip-|f_)/.test(id) && !/^slip-batch/.test(id) && id !== "slip-paste-zone" ? get(id) : (els[id] || null));
      },
      createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,AA" }),
      addEventListener() {}, head: { appendChild() {} }, querySelectorAll: () => [], querySelector: () => null,
    },
    panel: () => {}, toast: (m) => toasts.push(m), navNote: () => {}, buildTipsShown: () => true,
    openSportsBuilder: () => {}, guildFeature: () => true, getToken: () => "",
    setImmediate,
  };
  win.$ = (id) => win.document.getElementById(id);
  win.esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  win.window = win;
  vm.createContext(win);
  vm.runInContext(SRC, win);
  return { win, els, get, toasts };
}

function file(name) {
  return { name, type: "image/png", size: 10, text: fs.readFileSync(path.join(TEXT, name), "utf8") };
}

test("the screenshot input takes several files", () => {
  assert.match(SRC, /id="slip-file" type="file" accept="image\/\*" multiple/);
});

test("several screenshots become one review row each, every row opens its own review", async () => {
  const h = harness();
  await h.win.openSlipImport("g1", "Server");
  const input = h.els["slip-file"];
  input.files = ["nba-maxey-rebounds-under-plusline.txt", "nba-flemings-points-under-plusline.txt",
    "nba-jaquez-points-rebounds-plus.txt", "nba-allen-pra-under.txt"].map(file);
  input.onchange();
  for (let i = 0; i < 400 && !/left to schedule/.test(h.els.builder.innerHTML); i++) await new Promise((r) => setTimeout(r, 5));
  const html = h.els.builder.innerHTML;
  assert.match(html, /Import 4 screenshots/);
  assert.equal((html.match(/class="slip-batch-row"/g) || []).length, 4);
  assert.match(html, /Maxey Under 4\.5 Rebounds/);
  assert.match(html, /Kingston Flemings Under 7\.5 Points/);
  assert.match(html, /Jaime Jaquez Jr\./);
  assert.match(html, /Jarrett Allen Under 24\.5/);
  assert.match(html, /4 left to schedule/);
  assert.equal((html.match(/Review &amp; schedule/g) || []).length, 4);

  // Open the third row: the review screen shows that slip's own fields, editable.
  const btns = h.els.builder._btns;
  btns.find((b) => b.getAttribute("data-act") === "open" && b.getAttribute("data-i") === "2").onclick();
  const review = h.els.builder.innerHTML;
  assert.match(review, /Review imported slip/);
  assert.match(review, /id="slip-odds"[^>]*value="1\.86"/);
  assert.match(review, /id="slip-book" value="bet365"/);
  assert.equal(h.els["slip-retry"].textContent, "Back to batch");

  // Back returns to the list with every row still there; Remove drops one.
  h.els["slip-back"].onclick();
  assert.equal((h.els.builder.innerHTML.match(/class="slip-batch-row"/g) || []).length, 4);
  h.els.builder._btns.find((b) => b.getAttribute("data-act") === "remove" && b.getAttribute("data-i") === "0").onclick();
  assert.equal((h.els.builder.innerHTML.match(/class="slip-batch-row"/g) || []).length, 3);
  assert.match(h.els.builder.innerHTML, /3 left to schedule/);
});

test("one screenshot still goes straight to its review", async () => {
  const h = harness();
  await h.win.openSlipImport("g1", "Server");
  h.els["slip-file"].files = [file("nba-allen-pra-under.txt")];
  h.els["slip-file"].onchange();
  for (let i = 0; i < 400 && !/Review imported slip/.test(h.els.builder.innerHTML); i++) await new Promise((r) => setTimeout(r, 5));
  assert.match(h.els.builder.innerHTML, /Review imported slip/);
  assert.doesNotMatch(h.els.builder.innerHTML, /slip-batch-row/);
});
