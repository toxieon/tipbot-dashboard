import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const AV = "data:image/gif;base64,R0lGODlhAQABAIAAAAUEAAH/yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function people() {
  return {
    admins: [
      { id: "111111111111111111", name: "Ada Admin", avatar: AV, source: "role", last_seen: "2026-10-14T00:00:00Z" }
    ],
    mods: [
      { id: "222222222222222222", name: "Bea Mod", avatar: AV, source: "manual", last_seen: null }
    ],
    followers: [
      { id: "333333333333333333", name: "Cy Follower", avatar: "", source: "permission", last_seen: "2026-10-12T00:00:00Z" }
    ]
  };
}

function startSite() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      const file = url.pathname === "/" ? "/index.html" : url.pathname;
      const fp = path.join(root, file.replace(/^\//, ""));
      try {
        const data = readFileSync(fp);
        const ext = path.extname(fp);
        const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("no");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });

test.describe("owner access panel", () => {
  let server;
  let base;
  test.beforeAll(async () => {
    server = await startSite();
    base = `http://127.0.0.1:${server.address().port}/`;
  });
  test.afterAll(async () => { if (server) server.close(); });

  async function install(page, { ops = true, access = null, empty = false, hold = null, search = null } = {}) {
    const bag = { posts: [], dels: [], gets: [], access: access || (empty ? { admins: [], mods: [], followers: [] } : people()) };
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (!url.includes("afl-tipster-bot.onrender.com")) { await route.continue(); return; }
      const parsed = new URL(url);
      const origin = route.request().headers().origin || "*";
      const cors = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "authorization,content-type",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      };
      if (route.request().method() === "OPTIONS") { await route.fulfill({ status: 204, headers: cors }); return; }
      if (parsed.pathname === "/api/ops/ext.js") {
        await route.fulfill({ status: 404, contentType: "text/javascript", body: "", headers: cors });
        return;
      }
      const method = route.request().method();
      if (method === "POST" || method === "DELETE") {
        let body = {};
        try { body = JSON.parse(route.request().postData() || "{}"); } catch { body = {}; }
        const slot = method === "DELETE" ? bag.dels : bag.posts;
        slot.push({ path: parsed.pathname, body });
        if (parsed.pathname === "/api/owner/access/mod" && body.user_id) {
          if (method === "POST") {
            bag.access.mods = bag.access.mods.concat([{ id: body.user_id, name: "New Mod", avatar: AV, source: "manual", last_seen: null }]);
          } else {
            bag.access.mods = bag.access.mods.filter((m) => m.id !== body.user_id);
          }
        }
        const payload = parsed.pathname === "/api/owner/access/mod"
          ? { ok: true, message: method === "DELETE" ? "Mod removed." : "Mod added.", ...bag.access }
          : { ok: true };
        await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(payload) });
        return;
      }
      if (hold && method === "GET" && parsed.pathname === "/api/owner/access") await hold;
      bag.gets.push(parsed.pathname + parsed.search);
      let payload = { ok: true, games: [], tips: [] };
      if (parsed.pathname === "/api/servers") {
        payload = { role: ops ? "owner" : "mod", ops: !!ops, servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 100, won: 7, lost: 4, profit_units: 6.2, roi: 42, queued: 0 }], follower_servers: [] };
      } else if (parsed.pathname === "/api/server") {
        payload = { settings: { guild_id: "1", display_name: "Test", enabled: 1, can_admin: true, unit_size: 100 }, stats: { won: 7, lost: 4, push: 1, profit_units: 6.2, roi: 42.8, queued: 0, strike_rate: 58, followers: 3, settled: 12, staked_units: 14.5 }, tips: { settled: [], queued: [] }, months: [], month: "" };
      } else if (parsed.pathname === "/api/terms/status") payload = { ok: true, version: "1.0", accepted: true };
      else if (parsed.pathname === "/api/me") payload = { ok: true, ops: !!ops };
      else if (parsed.pathname === "/api/owner/access") payload = { ok: true, ...bag.access };
      else if (parsed.pathname === "/api/owner/access/members") {
        const q = (parsed.searchParams.get("q") || "").toLowerCase();
        const members = search || [
          { id: "444444444444444444", name: "Dee Search", avatar: AV },
          { id: "555555555555555555", name: "Eve Other", avatar: "" }
        ];
        payload = { ok: true, members: members.filter((m) => m.name.toLowerCase().includes(q) || m.id.includes(q)) };
      } else if (parsed.pathname === "/api/feature-flags") payload = { ok: true, flags: {}, labels: {}, keys: [] };
      else if (parsed.pathname === "/api/auto-recap") payload = { ok: true, settings: {}, outputs: [], channels: [] };
      await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(payload) });
    });
    return bag;
  }

  async function boot(page) {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem("tipbot_token", "t." + btoa(JSON.stringify({ exp: 4102444800 })) + ".x");
      localStorage.setItem("tipbot_auth_epoch", "2");
      localStorage.setItem("tipbot_theme", "apex");
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator("#overview .scard").filter({ hasText: "Test" }).click();
    await page.waitForSelector("#settings-panel", { timeout: 20000 });
    return errors;
  }

  async function openAccess(page) {
    const hd = page.locator("#settings-panel .panel-hd");
    if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
    await page.locator("#stab-access").click();
  }

  async function noOverflow(page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  }

  test("owner sees grouped lists, badges, search, add and a confirmed remove", async ({ page }) => {
    const bag = await install(page, { ops: true });
    const errors = await boot(page);
    await openAccess(page);
    await expect(page.locator("#oa-groups")).toContainText("Ada Admin");
    await expect(page.locator('[data-group="admins"] .oa-badge')).toHaveText("Role");
    await expect(page.locator('[data-group="mods"] .oa-badge')).toHaveText("Manual");
    await expect(page.locator('[data-group="followers"] .oa-badge')).toHaveText("Permission");
    await expect(page.locator('[data-group="mods"]')).toContainText("Not seen yet");
    await expect(page.locator(".oa-remove")).toHaveCount(1);
    await expect(page.locator('[data-group="admins"] .oa-remove')).toHaveCount(0);
    await expect(page.locator('[data-group="followers"] .oa-remove')).toHaveCount(0);
    await noOverflow(page);
    await page.locator("#access-box").scrollIntoViewIfNeeded();
    await page.locator("#settings-panel").screenshot({ path: path.join(SHOTS, "owner-access-list.png") });

    await page.locator("#oa-search").fill("dee");
    await expect(page.locator(".oa-hit")).toContainText("Dee Search");
    await page.locator("#oa-hits").screenshot({ path: path.join(SHOTS, "owner-access-search.png") });
    await page.locator(".oa-hit").click();
    await expect(page.locator("#oa-uid")).toHaveValue("444444444444444444");
    await page.locator("#oa-assign").check();
    await page.locator("#oa-add-btn").click();
    await expect(page.locator("#oa-msg")).toContainText("Mod added.");
    await expect(page.locator('[data-group="mods"]')).toContainText("New Mod");
    expect(bag.posts.some((p) => p.path === "/api/owner/access/mod" && p.body.user_id === "444444444444444444" && p.body.assign_role === true && p.body.guild_id === "1")).toBe(true);

    await page.locator(".oa-remove").first().click();
    await expect(page.locator(".tbs-card")).toContainText("Remove Bea Mod as a mod?");
    await page.locator("#oa-remove-role").check();
    await page.screenshot({ path: path.join(SHOTS, "owner-access-remove.png"), fullPage: false });
    await page.locator('.tbs-card [data-act="ok"]').click();
    await expect(page.locator("#oa-msg")).toContainText("Mod removed.");
    await expect(page.locator('[data-group="mods"]')).not.toContainText("Bea Mod");
    expect(bag.dels.some((p) => p.path === "/api/owner/access/mod" && p.body.user_id === "222222222222222222" && p.body.remove_role === true)).toBe(true);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test("loading and empty states", async ({ page }) => {
    let release;
    const hold = new Promise((r) => { release = r; });
    await install(page, { ops: true, hold, empty: true });
    const errors = await boot(page);
    await openAccess(page);
    await expect(page.locator("#oa-groups")).toContainText("Loading access…");
    await page.locator("#access-box").scrollIntoViewIfNeeded();
    await page.locator("#settings-panel").screenshot({ path: path.join(SHOTS, "owner-access-loading.png") });
    release();
    await expect(page.locator("#oa-groups")).toContainText("No mods yet.");
    await expect(page.locator("#oa-groups")).toContainText("No followers yet.");
    await expect(page.locator("#oa-groups")).toContainText("No admins yet.");
    await expect(page.locator(".oa-remove")).toHaveCount(0);
    await noOverflow(page);
    await page.locator("#settings-panel").screenshot({ path: path.join(SHOTS, "owner-access-empty.png") });
    expect(errors).toEqual([]);
  });

  test("a non-owner never sees Access and never calls the owner route", async ({ page }) => {
    const bag = await install(page, { ops: false });
    const errors = await boot(page);
    const hd = page.locator("#settings-panel .panel-hd");
    if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
    await expect(page.locator("#stab-general")).toBeVisible();
    await expect(page.locator("#stab-access")).toHaveCount(0);
    expect(bag.gets.some((g) => g.startsWith("/api/owner/access"))).toBe(false);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });
});
