import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

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

test.describe("global flags", () => {
  let server;
  let base;
  test.beforeAll(async () => {
    server = await startSite();
    base = `http://127.0.0.1:${server.address().port}/`;
  });
  test.afterAll(async () => { if (server) server.close(); });

  async function install(page, { ops = false, flags = null, me = null, configStatus = 200 } = {}) {
    const bag = {
      posts: [],
      gets: [],
      flags: Object.assign({ marketplace_enabled: true, build_tips_enabled: true }, flags || {})
    };
    const meFlags = me || {};
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
      if (method === "POST") {
        let body = {};
        try { body = JSON.parse(route.request().postData() || "{}"); } catch { body = {}; }
        bag.posts.push({ path: parsed.pathname, body });
        if (parsed.pathname === "/api/owner/global-flags") {
          if (typeof body.marketplace_enabled === "boolean") bag.flags.marketplace_enabled = body.marketplace_enabled;
          if (typeof body.build_tips_enabled === "boolean") bag.flags.build_tips_enabled = body.build_tips_enabled;
          await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ ok: true, ...bag.flags }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ ok: true }) });
        return;
      }
      bag.gets.push(parsed.pathname);
      if (parsed.pathname === "/api/config" && configStatus !== 200) {
        await route.fulfill({ status: configStatus, contentType: "application/json", headers: cors, body: JSON.stringify({ ok: false }) });
        return;
      }
      let payload = { ok: true, games: [], tips: [] };
      if (parsed.pathname === "/api/servers") {
        payload = { role: ops ? "owner" : "mod", ops: !!ops, servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 100, won: 7, lost: 4, profit_units: 6.2, roi: 42, queued: 0 }], follower_servers: [] };
      } else if (parsed.pathname === "/api/server") {
        payload = { settings: { guild_id: "1", display_name: "Test", enabled: 1, can_admin: true, unit_size: 100 }, stats: { won: 7, lost: 4, push: 1, profit_units: 6.2, roi: 42.8, queued: 0, strike_rate: 58, followers: 3, settled: 12, staked_units: 14.5 }, tips: { settled: [], queued: [] }, months: [], month: "" };
      } else if (parsed.pathname === "/api/terms/status") payload = { ok: true, version: "1.0", accepted: true };
      else if (parsed.pathname === "/api/me") payload = Object.assign({ ok: true, ops: !!ops }, meFlags);
      else if (parsed.pathname === "/api/config") payload = Object.assign({ ok: true }, bag.flags);
      else if (parsed.pathname === "/api/owner/global-flags") payload = Object.assign({ ok: true }, bag.flags);
      else if (parsed.pathname === "/api/feature-flags") payload = { ok: true, flags: {}, labels: {}, keys: [] };
      else if (parsed.pathname === "/api/auto-recap") payload = { ok: true, settings: {}, outputs: [], channels: [] };
      await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(payload) });
    });
    return bag;
  }

  async function boot(page, hash) {
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem("tipbot_token", "t." + btoa(JSON.stringify({ exp: 4102444800 })) + ".x");
      localStorage.setItem("tipbot_auth_epoch", "2");
      localStorage.setItem("tipbot_theme", "apex");
      localStorage.removeItem("tipdash_boot_v1");
    });
    await page.goto(base + (hash || ""), { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#overview .scard", { timeout: 20000 });
    return errors;
  }

  async function noOverflow(page) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  }

  test("owner toggles Global and still sees Marketplace and Build, marked off for users", async ({ page }) => {
    const bag = await install(page, { ops: true, flags: { marketplace_enabled: true, build_tips_enabled: true } });
    const errors = await boot(page);
    await page.locator("#gear").click();
    await page.locator("#dd-owner-settings").click();
    await expect(page.locator("#os-global")).toContainText("Global");
    await expect(page.locator("#os-global")).toContainText("Marketplace");
    await expect(page.locator("#os-global")).toContainText("Build your own tips");
    await expect(page.locator("#gf-msg")).not.toHaveText("Loading…");
    await expect(page.locator('[data-gf="marketplace_enabled"]')).toBeChecked();
    await expect(page.locator('[data-gf="build_tips_enabled"]')).toBeChecked();
    await noOverflow(page);
    await page.locator("#settings").screenshot({ path: path.join(SHOTS, "global-flags-settings.png") });

    await page.locator('[data-gf="marketplace_enabled"]').uncheck();
    await expect(page.locator("#gf-msg")).toHaveText("Saved.");
    await page.locator('[data-gf="build_tips_enabled"]').uncheck();
    await expect(page.locator("#gf-msg")).toHaveText("Saved.");
    await expect(page.locator('[data-gf-badge="marketplace_enabled"]')).toBeVisible();
    await expect(page.locator('[data-gf-badge="build_tips_enabled"]')).toHaveText("Off for users");
    const saved = bag.posts.filter((p) => p.path === "/api/owner/global-flags");
    expect(saved.some((p) => p.body.marketplace_enabled === false && p.body.build_tips_enabled === false)).toBe(true);
    expect(saved.every((p) => !("guild_id" in p.body))).toBe(true);

    await page.locator("#os-back").click();
    await page.waitForSelector("#overview .scard", { timeout: 20000 });
    await page.locator("#gear").click();
    await expect(page.locator("#dd-marketplace")).toBeVisible();
    await expect(page.locator("#dd-marketplace-badge")).toHaveText("Off for users");
    await page.locator("#dropdown").screenshot({ path: path.join(SHOTS, "global-flags-menu.png") });
    await page.locator("#dd-marketplace").click();
    await expect(page.locator("#marketplace")).toContainText("Marketplace");
    await expect(page.locator("#marketplace")).toContainText("Off for users");
    await page.locator("#mp-back").click();
    await page.locator("#overview .scard").filter({ hasText: "Test" }).click();
    await page.waitForSelector("#detail h1", { timeout: 20000 });
    await expect(page.locator('.apex-tabs [data-apex-nav="build"]')).toBeVisible();
    await expect(page.locator('.apex-tabs [data-apex-nav="build"] .gf-badge')).toHaveText("Off for users");
    await expect(page.locator("#buildbtn")).toBeVisible();
    await expect(page.locator("#buildbtn")).toContainText("Off for users");
    await noOverflow(page);
    await page.screenshot({ path: path.join(SHOTS, "global-flags-nav.png") });
    expect(errors).toEqual([]);
  });

  test("a non-owner loses Marketplace and Build when the public config turns them off", async ({ page }) => {
    const bag = await install(page, {
      ops: false,
      flags: { marketplace_enabled: false, build_tips_enabled: false },
      me: { marketplace_enabled: true, build_tips_enabled: true }
    });
    const errors = await boot(page, "#/marketplace");
    await expect(page.locator("#marketplace")).toBeHidden();
    await expect(page.locator("#builder")).toBeHidden();
    await page.locator("#gear").click();
    await expect(page.locator("#dd-logout")).toBeVisible();
    await expect(page.locator("#dd-marketplace")).toBeHidden();
    await expect(page.locator("#dd-owner-settings")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.locator("#dropdown")).toBeHidden();
    await page.locator("#overview .scard").filter({ hasText: "Test" }).click();
    await page.waitForSelector("#detail h1", { timeout: 20000 });
    await expect(page.locator('.apex-tabs [data-apex-nav="home"]')).toBeVisible();
    await expect(page.locator('.apex-tabs [data-apex-nav="build"]')).toHaveCount(0);
    await expect(page.locator(".apex-tabs")).toHaveClass(/apex-tabs-nobuild/);
    await expect(page.locator("#buildbtn")).toBeHidden();
    await expect(page.locator("#custombtn")).toBeHidden();
    await noOverflow(page);
    await page.screenshot({ path: path.join(SHOTS, "global-flags-hidden.png") });
    expect(bag.gets.filter((p) => p === "/api/owner/global-flags")).toEqual([]);
    expect(bag.gets).toContain("/api/config");
    expect(errors).toEqual([]);

    await page.evaluate(() => {
      history.pushState(null, "", "#/s/1/build");
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    });
    await expect(page.locator("#builder")).toBeHidden();
    await expect(page.locator("#overview")).toBeVisible();
    await page.evaluate(() => {
      history.pushState(null, "", "#/marketplace");
      window.dispatchEvent(new PopStateEvent("popstate", { state: {} }));
    });
    await expect(page.locator("#marketplace")).toBeHidden();
    await expect(page.locator("#overview")).toBeVisible();
  });

  test("a non-owner reads the flags from /api/me when public config is missing", async ({ page }) => {
    const bag = await install(page, {
      ops: false,
      configStatus: 404,
      me: { marketplace_enabled: false, build_tips_enabled: false }
    });
    const errors = await boot(page);
    await page.locator("#gear").click();
    await expect(page.locator("#dd-marketplace")).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(page.locator("#dropdown")).toBeHidden();
    await page.locator("#overview .scard").filter({ hasText: "Test" }).click();
    await page.waitForSelector("#detail h1", { timeout: 20000 });
    await expect(page.locator('.apex-tabs [data-apex-nav="build"]')).toHaveCount(0);
    await expect(page.locator("#buildbtn")).toBeHidden();
    expect(bag.gets).toContain("/api/me");
    expect(bag.gets).toContain("/api/config");
    expect(bag.gets.filter((p) => p === "/api/owner/global-flags")).toEqual([]);
    expect(errors).toEqual([]);
  });
});
