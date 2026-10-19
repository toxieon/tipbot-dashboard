// node --test tests/   Tip channel tiers render in Settings → Channels and save on /api/channels.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "assets", "tip-tiers.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const T = require(path.join(root, "assets", "tip-tiers.js"));

function sample() {
  return {
    ok: true,
    channels: [
      { id: "111", name: "tips", type: 0 },
      { id: "222", name: "afl-plays", type: "guild_text" },
      { id: "333", name: "general", type: 0 },
      { id: "444", name: "voice-chat", type: 2 },
      { id: "555", name: "recaps", type: 0 }
    ],
    outputs: [
      { key: "tips", label: "Tips", channel_id: "111", group: "Posts" },
      { key: "afl", label: "AFL", channel_id: "222", group: "Routing" },
      { key: "nrl", label: "NRL", channel_id: "", group: "Routing" },
      { key: "recaps", label: "Recaps", channel_id: "555", group: "Posts" }
    ],
    daily_free_limit: 2,
    tip_channel_tiers: { "111": "free", "222": "Premium", "999": "nope" }
  };
}

test("the card lists the tips channel and routed channels, and can add any text channel", () => {
  const st = T.tierState(sample());
  assert.deepEqual(st.listed.map((c) => c.id), ["111", "222"]);
  assert.equal(st.listed[0].name, "tips");
  assert.equal(st.listed[1].name, "afl-plays");
  assert.deepEqual(st.tip_channel_tiers, { "111": "free", "222": "premium" });
  assert.equal(st.daily_free_limit, 2);
  assert.deepEqual(st.all.map((c) => c.id), ["111", "222", "333", "555"]);
  const card = T.tierHtml(st);
  assert.match(card, /<h3>Tip channel tiers<\/h3>/);
  assert.match(card, /data-tt-limit[^>]*value="2"/);
  assert.match(card, /data-tt-id="111"/);
  assert.match(card, /data-tt-id="222"/);
  assert.match(card, />#tips</);
  assert.match(card, />#afl-plays</);
  assert.match(card, />Off</);
  assert.match(card, />Free</);
  assert.match(card, />Premium</);
  assert.match(card, /Sydney time/);
  assert.match(card, /data-tt-pick/);
  assert.match(card, /<option value="333">#general<\/option>/);
  assert.match(card, /data-tt-save/);
  assert.doesNotMatch(card, /data-tt-id="555"/);
  assert.doesNotMatch(card, /data-tt-id="999"/);
  assert.doesNotMatch(card, /voice-chat/);
  assert.doesNotMatch(card, /<option value="111">/);

  const fromMap = T.tierState({
    channels: sample().channels,
    mapping: { tips: "111", afl: "222", recaps: "555" },
    tips_channel_id: "111",
    daily_free_limit: "",
    tip_channel_tiers: { "333": "premium" }
  });
  assert.deepEqual(fromMap.listed.map((c) => c.id), ["111", "222", "333"]);
  assert.equal(fromMap.daily_free_limit, null);
  const empty = T.tierState({ channels: [{ id: "333", name: "general" }], outputs: [], daily_free_limit: null, tip_channel_tiers: {} });
  assert.deepEqual(empty.listed, []);
  assert.match(T.tierHtml(empty), /Pick any channel/);
  assert.match(T.tierHtml(empty), /<option value="333">#general<\/option>/);
});

test("save posts guild_id, daily_free_limit and tip_channel_tiers", () => {
  const section = {
    querySelector(sel) {
      if (sel === "[data-tt-limit]") return { value: "4" };
      return null;
    },
    querySelectorAll(sel) {
      if (sel === "[data-tt-id]") {
        return [
          { getAttribute: () => "111", querySelector: () => ({ value: "free" }) },
          { getAttribute: () => "222", querySelector: () => ({ value: "" }) },
          { getAttribute: () => "333", querySelector: () => ({ value: "premium" }) }
        ];
      }
      return [];
    }
  };
  const prev = T.tierState(sample());
  const next = T.readTiers(section, prev);
  assert.equal(next.daily_free_limit, 4);
  assert.deepEqual(next.tip_channel_tiers, { "111": "free", "333": "premium" });
  assert.deepEqual(T.tierBody("9", next), {
    guild_id: "9",
    daily_free_limit: 4,
    tip_channel_tiers: { "111": "free", "333": "premium" }
  });
  const blank = T.readTiers({
    querySelector: () => ({ value: "  " }),
    querySelectorAll: () => []
  }, prev);
  assert.equal(blank.daily_free_limit, null);
  assert.deepEqual(T.tierBody("9", blank), { guild_id: "9", daily_free_limit: null, tip_channel_tiers: {} });
  assert.equal(Object.keys(T.tierBody("9", next)).length, 3);
  assert.equal(T.channelsPath("a b"), "/api/channels?guild_id=a%20b");
});

function box(controls) {
  return {
    isConnected: true,
    innerHTML: "",
    querySelector(sel) {
      if (sel === "[data-tt-limit]") return controls.limit;
      if (sel === "[data-tt-save]") return controls.save;
      if (sel === "[data-tt-msg]") return controls.msg;
      if (sel === "[data-tt-pick]") return controls.pick;
      if (sel === "[data-tt-add]") return controls.add;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === "[data-tt-id]") return controls.groups;
      return [];
    }
  };
}

test("the Channels tab mounts the card and save sends the payload", async () => {
  const channelsAt = html.indexOf('if(tab==="channels")');
  const permsAt = html.indexOf('if(tab==="perms")');
  const block = html.slice(channelsAt, permsAt);
  assert.ok(channelsAt >= 0 && permsAt > channelsAt);
  assert.match(block, /id="tip-tiers-box"/);
  assert.match(block, /TBTipTiers\.mount\(\$\("tip-tiers-box"\)/);
  assert.match(block, /can_admin!==false/);
  assert.match(block, /canEdit:true/);
  assert.match(html, /<script src="\.\/assets\/tip-tiers\.js\?v=__TD_VERSION__"><\/script>/);
  assert.doesNotMatch(html, /<script[^>]+connector-post\.js/);
  const post = fs.readFileSync(path.join(root, "assets", "connector-post.js"), "utf8");
  assert.doesNotMatch(post, /Tip channel tiers|tip_channel_tiers|daily_free_limit|data-cp-tier/);

  const calls = [];
  const controls = {
    limit: { value: "2" },
    msg: { textContent: "", classList: { add() {}, remove() {} } },
    save: {},
    add: {},
    pick: { value: "" },
    groups: [
      { getAttribute: () => "111", querySelector: () => ({ value: "free" }) },
      { getAttribute: () => "222", querySelector: () => ({ value: "premium" }) }
    ]
  };
  const el = box(controls);
  let resolveGet;
  const gate = new Promise((r) => { resolveGet = r; });
  T.mount(el, {
    gid: "42",
    api: async (path, opts) => {
      calls.push({ path, opts: opts || null });
      if (!opts) {
        await gate;
        return { ok: true, status: 200, json: async () => sample() };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true, daily_free_limit: 4, tip_channel_tiers: { "111": "free", "333": "premium" } }) };
    }
  });
  assert.match(el.innerHTML, /Loading/);
  resolveGet();
  await new Promise((r) => setTimeout(r, 0));
  assert.match(el.innerHTML, /Tip channel tiers/);
  assert.match(el.innerHTML, /data-tt-id="111"/);
  assert.match(el.innerHTML, />#afl-plays</);
  assert.equal(calls[0].path, "/api/channels?guild_id=42");
  assert.equal(calls[0].opts, null);
  controls.limit.value = "4";
  controls.groups = [
    { getAttribute: () => "111", querySelector: () => ({ value: "free" }) },
    { getAttribute: () => "222", querySelector: () => ({ value: "" }) },
    { getAttribute: () => "333", querySelector: () => ({ value: "premium" }) }
  ];
  controls.pick.value = "333";
  controls.add.onclick();
  assert.match(el.innerHTML, /data-tt-id="333"/);
  assert.match(el.innerHTML, />#general</);
  await controls.save.onclick();
  const postCall = calls.find((c) => c.opts && c.opts.method === "POST");
  assert.equal(postCall.path, "/api/channels");
  assert.equal(postCall.opts.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(postCall.opts.body), {
    guild_id: "42",
    daily_free_limit: 4,
    tip_channel_tiers: { "111": "free", "333": "premium" }
  });
  assert.match(el.innerHTML, /data-tt-msg/);
  assert.equal(controls.msg.textContent, "Saved");

  const hidden = box(controls);
  const seen = [];
  T.mount(hidden, { gid: "1", canEdit: false, api: async (p) => { seen.push(p); return { ok: true, json: async () => ({}) }; } });
  assert.equal(hidden.innerHTML, "");
  assert.deepEqual(seen, []);
});

test("the public build ships the card and the guard accepts it", async () => {
  const { build, scanText, ASSET_DENY } = await import("../scripts/build-public.mjs");
  assert.equal(ASSET_DENY.has("assets/tip-tiers.js"), false);
  assert.deepEqual(scanText("assets/tip-tiers.js", src), []);
  for (const phrase of ["owner", "ops", "connector", "Connectors", "Post settings", "God mode", "Debug menu"]) {
    assert.equal(src.toLowerCase().includes(phrase.toLowerCase()), false, phrase);
  }
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), "tipdash-tiers-"));
  try {
    const result = build({ root, dist });
    const rel = "assets/tip-tiers.js";
    assert.ok(result.files.includes(rel));
    const shipped = fs.readFileSync(path.join(dist, rel), "utf8");
    assert.match(shipped, /Tip channel tiers/);
    assert.match(shipped, /tip_channel_tiers/);
    assert.match(shipped, /daily_free_limit/);
    assert.match(fs.readFileSync(path.join(dist, "index.html"), "utf8"), /TBTipTiers\.mount/);
    assert.equal(fs.existsSync(path.join(dist, "assets/connector-post.js")), false);
  } finally {
    fs.rmSync(dist, { recursive: true, force: true });
  }
});
