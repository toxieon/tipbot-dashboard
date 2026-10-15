// node --test tests/schedule_note.test.js
// Schedule tip: an error or TipBot soft warning is shown once.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const builder = fs.readFileSync(path.join(root, "assets/builder.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const admin = fs.readFileSync(path.join(root, "assets/admin.js"), "utf8");

const WARN = "Couldn't match a player id for Emanuel Wilson — saved the name to grade later";

function extractFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  if (start < 0) throw new Error("missing " + name);
  let i = src.indexOf("{", start);
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error("unclosed " + name);
}

function loadFns() {
  const ctx = {
    esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
      }[c]));
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(
    [extractFn(builder, "scheduleWarnings"), extractFn(builder, "armScheduleNote"), extractFn(builder, "scheduleNoteHtml"), extractFn(builder, "reportScheduleError")].join("\n"),
    ctx
  );
  return ctx;
}

test("soft player-id warning collapses to one sentence", () => {
  const ctx = loadFns();
  const once = ctx.scheduleWarnings({
    ok: true,
    message: "queued",
    warnings: [WARN, WARN, WARN.toUpperCase()],
    warning: WARN,
  });
  assert.equal(once, WARN);
  assert.equal(ctx.scheduleWarnings({ warnings: [WARN, "Couldn't match a player id for Bo Nix — saved the name to grade later"] }),
    WARN + " Couldn't match a player id for Bo Nix — saved the name to grade later");
  assert.equal(ctx.scheduleWarnings({ ok: true, message: "queued" }), "");
  assert.equal(ctx.scheduleWarnings(null), "");
});

test("yellow note is the warning once, escaped, and not an error", () => {
  const ctx = loadFns();
  ctx.armScheduleNote("42", WARN + "  ");
  const note = ctx.scheduleNoteHtml("42");
  assert.equal((note.match(/id="schedulenote"/g) || []).length, 1);
  assert.match(note, /class="tbwarn"/);
  assert.doesNotMatch(note, /class="err"/);
  assert.match(note, /Emanuel Wilson — saved the name to grade later/);
  assert.equal(ctx.scheduleNoteHtml("99"), "");
  ctx.armScheduleNote("42", 'Couldn\'t match a player id for A<b> — saved the name to grade later');
  const escaped = ctx.scheduleNoteHtml("42");
  assert.match(escaped, /A&lt;b&gt;/);
  assert.doesNotMatch(escaped, /A<b>/);
  ctx.__tbScheduleNote.until = Date.now() - 1;
  assert.equal(ctx.scheduleNoteHtml("42"), "");
  assert.equal(ctx.__tbScheduleNote, null);
});

test("an empty warning clears a previous note", () => {
  const ctx = loadFns();
  ctx.armScheduleNote("7", WARN);
  ctx.armScheduleNote("7", "");
  assert.equal(ctx.scheduleNoteHtml("7"), "");
});

test("schedule errors are written to the error line only", () => {
  const ctx = loadFns();
  const el = { className: "tbwarn", textContent: "" };
  const seen = [];
  ctx.reportScheduleError(el, { fail(label) { seen.push(label); } }, WARN);
  assert.equal(el.className, "err");
  assert.equal(el.textContent, WARN);
  assert.deepEqual(seen, [""]);
});

test("Build schedule does not repeat the sentence in the progress label", () => {
  const schedule = builder.slice(builder.indexOf("async function doSchedule"), builder.indexOf("function compareCacheKey"));
  assert.match(schedule, /const warn=scheduleWarnings\(j\)/);
  assert.match(schedule, /prog\.ok\("Tip scheduled"\)/);
  assert.match(schedule, /armScheduleNote\(BUILD\.guildId, warn\)/);
  assert.match(schedule, /reportScheduleError\(\$\("scherr"\), prog, m\)/);
  assert.doesNotMatch(schedule, /prog\.fail\(m\)/);
  assert.doesNotMatch(schedule, /prog\.fail\(warn\)/);
  assert.doesNotMatch(schedule, /prog\.fail\(tipFields\.error\)/);
  assert.doesNotMatch(schedule, /textContent=m/);
  assert.doesNotMatch(builder, /prog\.fail\(msg/);
  assert.doesNotMatch(builder, /prog\.fail\(note\)/);
  const detail = html.slice(html.indexOf("async function renderDetail(d)"), html.indexOf("function mountScheduled"));
  assert.equal((detail.match(/scheduleNoteHtml\(/g) || []).length, 1);
  assert.match(html, /fail:function\(label\)\{ finish\("err", label==null \? "Couldn't schedule\." : String\(label\), false\); \}/);
  assert.match(html, /\.submit-prog-label:empty\{display:none/);
});

test("owner paste-sheet progress text is unchanged", () => {
  assert.match(admin, /prog\.fail\("API pending deploy"\)/);
  assert.match(admin, /prog\.fail\(im\)/);
  assert.doesNotMatch(admin, /scheduleWarnings|armScheduleNote|scheduleNoteHtml/);
});
