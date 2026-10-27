// Server card picture: server icon, else owner avatar, else monogram. CDN only.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const GP = require("../assets/guild-profile.js");

const GID = "100000000000000001";
const ICON = "https://cdn.discordapp.com/icons/" + GID + "/abc123.png?size=128";
const OWNER = "https://cdn.discordapp.com/avatars/200000000000000002/def456.png?size=128";

test("1. the server icon wins when the server has one", () => {
  const row = { guild_id: GID, display_name: "Alpha Hub", icon_url: ICON, owner_avatar_url: OWNER };
  assert.deepEqual(GP.avatarSources(row), [ICON, OWNER]);
  assert.equal(GP.avatarSources(row)[0], ICON);
});

test("2. the owner avatar is used when there is no server icon", () => {
  const row = { guild_id: GID, display_name: "Alpha Hub", icon_url: null, owner_avatar_url: OWNER };
  assert.deepEqual(GP.avatarSources(row), [OWNER]);
  assert.deepEqual(GP.avatarSources({ guild_id: GID, owner_avatar_url: OWNER }), [OWNER]);
});

test("3. neither picture means the monogram", () => {
  assert.deepEqual(GP.avatarSources({ guild_id: GID, display_name: "Alpha Hub" }), []);
  assert.deepEqual(GP.avatarSources(null), []);
  assert.equal(GP.initials("Alpha Hub"), "AH");
});

test("a picture that fails to load falls to the next one, then the monogram", () => {
  const srcs = [ICON, OWNER];
  assert.equal(GP.nextSource(srcs, 0), OWNER);
  assert.equal(GP.nextSource(srcs, 1), "");
  assert.equal(GP.nextSource([OWNER], 0), "");
  assert.equal(GP.nextSource([], 0), "");
});

test("only https cdn.discordapp.com images are used", () => {
  const bad = [
    "http://cdn.discordapp.com/a.png",
    "https://media.discordapp.net/a.png",
    "https://cdn.discordapp.com.evil.example/a.png",
    "https://evil.example/cdn.discordapp.com/a.png",
    "https://cdn.discordapp.com@evil.example/a.png",
    "https://user:pw@cdn.discordapp.com/a.png",
    "https://cdn.discordapp.com:8443/a.png",
    "//cdn.discordapp.com/a.png",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "https://cdn.discordapp.com/a.png#x",
    "https://cdn.discordapp.com/a b.png",
    "https://cdn.discordapp.com\\@evil.example/a.png",
    "", null, undefined, 42,
  ];
  for (const url of bad) {
    assert.equal(GP.cdnUrl(url), "", String(url));
    assert.deepEqual(GP.avatarSources({ guild_id: GID, icon_url: url, owner_avatar_url: url }), [], String(url));
  }
  assert.equal(GP.cdnUrl(ICON), ICON);
  // A hash alone is built into a cdn URL, but a hash that is a path or URL is not.
  assert.equal(GP.guildIconUrl({ guild_id: GID, icon: "abc123" }), "https://cdn.discordapp.com/icons/" + GID + "/abc123.png");
  assert.equal(GP.guildIconUrl({ guild_id: GID, icon: "../x" }), "");
  assert.equal(GP.guildIconUrl({ guild_id: GID, icon: "https://evil.example/x.png" }), "");
});

test("a fresh list keeps the owner avatar it already had when the new row has none", () => {
  const prev = { guild_id: GID, owner_avatar_url: OWNER, owner_id: "200000000000000002" };
  const fresh = { guild_id: GID, display_name: "Alpha Hub" };
  GP.keepMissingIdentity(fresh, prev);
  assert.equal(fresh.owner_avatar_url, OWNER);
  const cached = { guild_id: GID, owner_avatar_url: OWNER };
  assert.equal(GP.applyIdentity(cached, { owner_avatar_url: OWNER.replace("def456", "new789") }), true);
  assert.match(cached.owner_avatar_url, /new789/);
});

// Run the page's own card code: serverAvatarHtml and the load-error handler.
function pageCode() {
  const a = HTML.indexOf("  function serverAvatarSources(row){");
  const b = HTML.indexOf("  function patchBootIdentity");
  assert.ok(a > 0 && b > a, "card picture code not found in index.html");
  return HTML.slice(a, b);
}

function load() {
  let handler = null;
  const sandbox = {
    window: { GuildProfile: GP },
    GuildProfile: GP,
    esc: (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"),
    guildName: GP.guildName,
    document: {
      addEventListener(type, fn, capture) { if (type === "error" && capture === true) handler = fn; },
      createElement(tag) {
        return { tag, className: "", attrs: {}, textContent: "", setAttribute(k, v) { this.attrs[k] = v; } };
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(pageCode(), sandbox);
  assert.equal(typeof handler, "function", "error handler is installed in the capture phase");
  return { html: (row, label, large) => vm.runInContext("serverAvatarHtml", sandbox)(row, label, large), handler };
}

function fakeImg(html) {
  const get = (k) => (html.match(new RegExp(" " + k + '="([^"]*)"')) || [])[1];
  const img = {
    tagName: "IMG", className: get("class"), src: get("src"), replaced: null,
    attrs: { "data-srcs": get("data-srcs"), "data-i": get("data-i"), "data-init": get("data-init") },
    classList: { contains: (c) => img.className.split(" ").includes(c) },
    getAttribute: (k) => (k in img.attrs ? img.attrs[k] : null),
    setAttribute: (k, v) => { img.attrs[k] = v; },
    replaceWith: (n) => { img.replaced = n; },
  };
  return img;
}

test("the card renders a circular lazy image with the rules from the brief", () => {
  const { html } = load();
  const out = html({ guild_id: GID, display_name: "Alpha Hub", icon_url: ICON, owner_avatar_url: OWNER }, "x", false);
  assert.match(out, /^<img class="s-av"/);
  assert.ok(out.includes('src="' + ICON.replace(/&/g, "&amp;") + '"'));
  assert.match(out, /width="36" height="36"/);
  assert.match(out, /loading="lazy"/);
  assert.match(out, /referrerpolicy="no-referrer"/);
  assert.match(html({ guild_id: GID, owner_avatar_url: OWNER }, "x", true), /class="s-av lg" src="https:\/\/cdn\.discordapp\.com\/avatars\//);
  assert.equal(html({ guild_id: GID, display_name: "Alpha Hub" }, "x", false), '<span class="s-av" aria-hidden="true">AH</span>');
  assert.equal(html({ guild_id: GID, display_name: "Alpha Hub", icon_url: "https://evil.example/a.png" }, "x", false),
    '<span class="s-av" aria-hidden="true">AH</span>');
  assert.ok(/\.s-av\{[^}]*border-radius:999px/.test(HTML), "the picture keeps the circular monogram size");
});

test("on a load error the card tries the owner avatar, then falls back to the monogram", () => {
  const { html, handler } = load();
  const img = fakeImg(html({ guild_id: GID, display_name: "Alpha Hub", icon_url: ICON, owner_avatar_url: OWNER }, "x", false));
  handler({ target: img });
  assert.equal(img.src, OWNER);
  assert.equal(img.replaced, null);
  handler({ target: img });
  assert.equal(img.replaced.tag, "span");
  assert.equal(img.replaced.className, "s-av");
  assert.equal(img.replaced.textContent, "AH");

  const single = fakeImg(html({ guild_id: GID, display_name: "Alpha Hub", icon_url: ICON }, "x", true));
  handler({ target: single });
  assert.equal(single.replaced.className, "s-av lg");
  assert.equal(single.replaced.textContent, "AH");

  const other = { tagName: "IMG", classList: { contains: () => false }, getAttribute: () => null };
  assert.doesNotThrow(() => handler({ target: other }));
});
