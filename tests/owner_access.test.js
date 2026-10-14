// node --test tests/   Owner-only Access panel: groups, badges, add/remove payloads, gating.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const OA = require("../assets/owner-access.js");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const src = fs.readFileSync(path.join(root, "assets/owner-access.js"), "utf8");

const sample = {
  ok: true,
  admins: [{ id: "111111111111111111", name: "Ada", avatar: "https://cdn.example/a.png", source: "role", last_seen: "2026-10-14T01:00:00Z" }],
  mods: [{ id: "222222222222222222", name: "Bea", avatar: "", source: "manual", last_seen: null }],
  followers: [{ user_id: "333333333333333333", name: "Cy", avatar: "https://cdn.example/c.png", source: "permission", last_seen: "2026-10-01T01:00:00Z" }]
};

test("the list payload becomes admins, mods and followers", () => {
  const groups = OA.groupsFrom(sample);
  assert.deepEqual(groups.map((g) => g.key), ["admins", "mods", "followers"]);
  assert.equal(groups[1].removable, true);
  assert.equal(groups[0].removable, false);
  assert.equal(groups[2].entries[0].id, "333333333333333333");
  assert.equal(groups[2].entries[0].source, "permission");
  const nested = OA.groupsFrom({ groups: { admins: sample.admins, mods: [], followers: [] } });
  assert.equal(nested[0].entries[0].name, "Ada");
  assert.equal(nested[1].entries.length, 0);
  const listed = OA.groupsFrom({ groups: [
    { key: "mods", label: "Mods", entries: sample.mods },
    { key: "followers", label: "Followers", people: sample.followers }
  ] });
  assert.equal(listed[0].removable, true);
  assert.equal(listed[1].entries[0].name, "Cy");
});

test("each entry renders a source badge, and only mods can be removed", () => {
  const view = { phase: "ready", groups: OA.groupsFrom(sample), hitsPhase: "idle", message: "", busy: false };
  const body = OA.groupsHtml(view);
  assert.match(body, /oa-badge-role[^>]*>Role</);
  assert.match(body, /oa-badge-manual[^>]*>Manual</);
  assert.match(body, /oa-badge-permission[^>]*>Permission</);
  assert.match(body, /Not seen yet/);
  assert.equal((body.match(/Remove mod/g) || []).length, 1);
  assert.match(body, /data-group="admins"/);
  assert.match(body, /data-group="followers"/);
  assert.doesNotMatch(body.slice(0, body.indexOf('data-group="mods"')), /Remove mod/);
});

test("loading, missing and empty states have their own copy", () => {
  assert.match(OA.groupsHtml({ phase: "loading" }), /Loading access…/);
  assert.match(OA.groupsHtml({ phase: "missing" }), /latest deploy/);
  assert.match(OA.groupsHtml({ phase: "error" }), /Couldn’t load access/);
  const empty = OA.groupsHtml({ phase: "ready", groups: OA.groupsFrom({ admins: [], mods: [], followers: [] }) });
  assert.match(empty, /No admins yet/);
  assert.match(empty, /No mods yet/);
  assert.match(empty, /No followers yet/);
  const panel = OA.panelHtml({ phase: "ready", groups: OA.groupsFrom({ admins: [], mods: [], followers: [] }), hitsPhase: "idle", message: "", busy: false });
  assert.match(panel, /id="oa-search"/);
  assert.match(panel, /id="oa-uid"/);
  assert.match(panel, /id="oa-assign"/);
  assert.match(panel, />Add mod</);
  assert.match(OA.hitsHtml({ hitsPhase: "ready", hits: [] }), /No members match/);
  assert.match(OA.hitsHtml({ hitsPhase: "loading" }), /Searching…/);
});

test("add and remove send the TipBot bodies, and search reads member rows", () => {
  assert.deepEqual(OA.addPayload("9", "222222222222222222", true), {
    guild_id: "9", user_id: "222222222222222222", assign_role: true
  });
  assert.deepEqual(OA.removePayload("9", "222222222222222222", false), {
    guild_id: "9", user_id: "222222222222222222", remove_role: false
  });
  assert.equal(OA.validUserId("222222222222222222"), true);
  assert.equal(OA.validUserId("nope"), false);
  assert.equal(OA.validUserId(""), false);
  const people = OA.membersFrom({ members: [{ id: "444444444444444444", name: "Dee", avatar: "javascript:alert(1)" }] });
  assert.equal(people[0].avatar, "");
  assert.equal(OA.membersFrom({ results: [{ user_id: "555555555555555555", display_name: "Eve" }] })[0].name, "Eve");
  assert.equal(OA.PATHS.list, "/api/owner/access");
  assert.equal(OA.PATHS.mod, "/api/owner/access/mod");
  assert.equal(OA.PATHS.search, "/api/owner/access/members");
});

test("the panel uses the same owner gate as the other owner-only server tools", () => {
  assert.equal(OA.allowed({ ops: true, viewAs: null }), true);
  assert.equal(OA.allowed({ ops: true }), true);
  assert.equal(OA.allowed({ ops: true, viewAs: { guild_id: "1" } }), false);
  assert.equal(OA.allowed({ ops: false, viewAs: null }), false);
  assert.equal(OA.allowed(null), false);
  assert.match(html, /const isAdmin=STATE\.ops===true&&!STATE\.viewAs;/);
  assert.match(html, /const accessTab=isAdmin\?'<button class="tab" id="stab-access">Access<\/button>':''/);
  assert.match(html, /if\(tab==="access"\)\{\s*if\(!\(STATE\.ops===true&&!STATE\.viewAs\)\)\{ body\.innerHTML=""; return; \}/);
  assert.match(html, /TBOwnerAccess\.mount\(\$\("access-box"\)/);
  assert.match(html, /allowed:ownerSettingsAllowed/);
  assert.match(html, /<script src="\.\/assets\/owner-access\.js\?v=/);
  assert.match(src, /\/api\/owner\/access\?guild_id=/);
  assert.match(src, /assign_role/);
  assert.match(src, /remove_role/);
  assert.match(src, /\/api\/owner\/access\/members\?guild_id=/);
});

test("shipped access UI has no secret terms", async () => {
  const { scanText } = await import("../scripts/build-public.mjs");
  assert.deepEqual(scanText("assets/owner-access.js", src), []);
});
