const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
function load() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, "assets/emoji-picker.js"), "utf8"), ctx);
  return ctx.window.TBEmojiPicker;
}
const EID = "1234567890123456789";

test("parses static, animated, legacy and unicode values", () => {
  const P = load();
  assert.deepStrictEqual({ ...P.parse(`<:tick:${EID}>`) }, { custom: true, animated: false, name: "tick", id: EID, token: `<:tick:${EID}>` });
  assert.strictEqual(P.parse(`<a:party:${EID}>`).animated, true);
  assert.strictEqual(P.parse(`tick:${EID}`).token, `<:tick:${EID}>`);
  assert.strictEqual(P.parse("🫡").custom, false);
  assert.strictEqual(P.parse(""), null);
});

test("preview uses the CDN gif for animated and png for static", () => {
  const P = load();
  assert.match(P.preview(`<a:party:${EID}>`), new RegExp(`emojis/${EID}\\.gif`));
  assert.match(P.preview(`<:tick:${EID}>`), new RegExp(`emojis/${EID}\\.png`));
  assert.strictEqual(P.preview("🔥"), "🔥");
});

test("grid offers server emojis (with tokens) plus standard ones, and flags a deleted saved emoji", () => {
  const P = load();
  const html = P.gridHtml([
    { id: EID, name: "tick", animated: false, token: `<:tick:${EID}>`, url: `https://cdn.discordapp.com/emojis/${EID}.png` },
    { id: "999999999999999999", name: "party", animated: true, token: "<a:party:999999999999999999>" },
  ], "<:gone:111111111111111111>");
  assert.ok(html.includes(`data-v="&lt;:tick:${EID}&gt;"`));
  assert.ok(html.includes('data-v="&lt;a:party:999999999999999999&gt;"'));
  assert.ok(html.includes('data-v="🫡"'));
  assert.match(html, /isn't in this server any more/);
  assert.doesNotMatch(P.gridHtml([], "🔥"), /any more/);
});

test("index wires the picker, loads the script, and the input fits long animated tokens", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /assets\/emoji-picker\.js\?v=/);
  assert.match(html, /TBEmojiPicker\.mount\(\{input:\$\("femoji"\)/);
  assert.match(html, /id="femoji"[^>]*maxlength="96"/);
  const js = fs.readFileSync(path.join(root, "assets/emoji-picker.js"), "utf8");
  assert.match(js, /\/api\/guild-emojis\?guild_id=/);
});
