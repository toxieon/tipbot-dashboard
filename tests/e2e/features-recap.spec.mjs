import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import os from "node:os";
import { mkdirSync } from "node:fs";
const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const EXT = `
window.TBOwner = {
  adminHtml: function(s, sw) {
    return '<div class="panel" id="adminpanel" data-sec="admin-tools">'
      + '<div class="panel-hd" id="admintoggle"><div class="panel-hd-main"><h3 style="margin:0">Admin Tools</h3></div><span class="panel-caret">▸</span></div>'
      + '<div class="panel-body"><div class="switches">' + (sw || "") + '</div>'
      + '<div id="featuresbody">'
      + '<div class="panel-hd" id="featurestoggle" role="button" tabindex="0" aria-expanded="false"><div class="panel-hd-main"><h3 style="margin:0">Features</h3></div><span class="panel-caret">▸</span></div>'
      + '<div id="features-box"></div>'
      + '</div></div></div>';
  },
  bindAdmin: function(s) {
    var el = document.getElementById("featuresbody");
    var hd = document.getElementById("featurestoggle");
    var box = document.getElementById("features-box");
    if (typeof TDSec !== "undefined" && el && hd) {
      TDSec.bind(el, hd, {
        id: "features",
        body: box,
        hideBody: true,
        onToggle: function(open) { if (open && typeof loadFeatures === "function") loadFeatures(s.guild_id); }
      });
    }
  },
  ensureSettingsMarkup: function(){},
  paintSignup: function(){},
  wireSignup: function(){},
  paintOps: function(){},
  clearOps: function(){},
};
`;

function flagPayload() {
  const flags = { "feat.daily_recap": false, "feat.sport_routing": true, "feat.item_001": false };
  const labels = { "feat.daily_recap": "Daily recaps", "feat.sport_routing": "Sport routing", "feat.item_001": "Another switch" };
  return { ok: true, flags, labels, keys: ["feat.daily_recap", "feat.sport_routing", "feat.item_001"] };
}

function freshRecap() {
  return {
    ok: true,
    settings: {
      channel_key: "recaps",
      skip_empty: true,
      daily: { enabled: false, hour: 9, minute: 0 },
      weekly: { enabled: false, hour: 9, minute: 0, weekday: 0 },
      monthly: { enabled: false, hour: 9, minute: 0, day: 1 },
    },
    outputs: [{ key: "recaps", label: "Recaps" }],
    channels: [],
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

test.describe("features recaps", () => {
  let server;
  let base;
  test.beforeAll(async () => {
    server = await startSite();
    base = `http://127.0.0.1:${server.address().port}/`;
  });
  test.afterAll(async () => { if (server) server.close(); });

  async function install(page, { ops, flagDelay = 0, previewStatus = 200, recapStatus = 200, hold = null } = {}) {
    const bag = { posts: [], gets: [], recap: freshRecap(), flags: flagPayload() };
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (!url.includes("afl-tipster-bot.onrender.com")) { await route.continue(); return; }
      const parsed = new URL(url);
      const origin = route.request().headers().origin || "*";
      const cors = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers": "authorization,content-type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      };
      if (route.request().method() === "OPTIONS") { await route.fulfill({ status: 204, headers: cors }); return; }
      const slow = parsed.pathname === "/api/feature-flags" || parsed.pathname === "/api/auto-recap" || parsed.pathname === "/api/auto-recap/preview";
      if (hold && route.request().method() === "GET" && (parsed.pathname === "/api/feature-flags" || parsed.pathname === "/api/auto-recap")) await hold;
      if (slow && flagDelay) await new Promise((r) => setTimeout(r, flagDelay));
      if (parsed.pathname === "/api/ops/ext.js") {
        await route.fulfill({ status: ops ? 200 : 404, contentType: "text/javascript", body: ops ? EXT : "", headers: cors });
        return;
      }
      if (route.request().method() === "POST") {
        let body = {};
        try { body = JSON.parse(route.request().postData() || "{}"); } catch { body = {}; }
        bag.posts.push({ path: parsed.pathname, body, status: parsed.pathname === "/api/auto-recap/preview" ? previewStatus : (parsed.pathname === "/api/auto-recap" ? recapStatus : 200) });
        if (parsed.pathname === "/api/auto-recap" && recapStatus === 200) {
          bag.recap = { ok: true, settings: Object.assign({}, bag.recap.settings, body), outputs: bag.recap.outputs, channels: [] };
        }
        if (parsed.pathname === "/api/feature-flags") bag.flags = { ok: true, flags: Object.assign({}, bag.flags.flags, body.flags || {}), labels: bag.flags.labels, keys: bag.flags.keys };
        const status = parsed.pathname === "/api/auto-recap/preview" ? previewStatus : (parsed.pathname === "/api/auto-recap" ? recapStatus : 200);
        const payload = parsed.pathname === "/api/auto-recap/preview"
          ? (status === 404 ? { ok: false, error: "not found" } : { ok: true, message: "Preview sent." })
          : (parsed.pathname === "/api/auto-recap" ? (status === 404 ? { ok: false } : { ok: true }) : { ok: true, flags: (body && body.flags) || {} });
        await route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(payload) });
        return;
      }
      bag.gets.push(parsed.pathname);
      let payload = { ok: true, games: [], tips: [] };
      if (parsed.pathname === "/api/servers") {
        payload = { role: ops ? "owner" : "mod", ops: !!ops, servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 100, won: 7, lost: 4, profit_units: 6.2, roi: 42, queued: 0 }], follower_servers: [] };
      } else if (parsed.pathname === "/api/server") {
        payload = { settings: { guild_id: "1", display_name: "Test", enabled: 1, can_admin: true, unit_size: 100 }, stats: { won: 7, lost: 4, push: 1, profit_units: 6.2, roi: 42.8, queued: 0, strike_rate: 58, followers: 3, settled: 12, staked_units: 14.5 }, tips: { settled: [], queued: [] }, months: [], month: "" };
      } else if (parsed.pathname === "/api/terms/status") payload = { ok: true, version: "1.0", accepted: true };
      else if (parsed.pathname === "/api/me") payload = { ok: true, ops: !!ops };
      else if (parsed.pathname === "/api/feature-flags") payload = bag.flags;
      else if (parsed.pathname === "/api/auto-recap") payload = bag.recap;
      else if (parsed.pathname === "/api/guild-emojis") payload = { ok: true, emojis: [
        { id: "1234567890123456789", name: "tick", animated: false, url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", token: "<:tick:1234567890123456789>" },
        { id: "1234567890123456790", name: "party_parrot_long_name", animated: true, url: "data:image/gif;base64,R0lGODlhAQABAAAAACw=", token: "<a:party_parrot_long_name:1234567890123456790>" },
      ] };
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

  async function openFeatures(page) {
    await page.waitForSelector("#featurestoggle", { state: "attached" });
    if ((await page.getAttribute("#admintoggle", "aria-expanded")) !== "true") await page.click("#admintoggle");
    await page.locator("#featurestoggle").scrollIntoViewIfNeeded();
  }

  test("cold open shows a shell immediately; a warm open paints checkboxes without waiting", async ({ page }) => {
    let release;
    const hold = new Promise((r) => { release = r; });
    await install(page, { ops: true, hold });
    const client = await page.context().newCDPSession(page);
    await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const errors = await boot(page);
    await openFeatures(page);
    const cold = await page.evaluate(() => {
      const box = document.getElementById("features-box");
      const t0 = performance.now();
      document.getElementById("featurestoggle").click();
      return {
        ms: performance.now() - t0,
        shell: !!box.querySelector(".feat-shell"),
        n: box.querySelectorAll(".feat-cb").length,
      };
    });
    expect(cold.shell).toBe(true);
    expect(cold.n).toBe(0);
    expect(cold.ms).toBeLessThan(100);
    release();
    await page.waitForSelector("#features-box .feat-cb", { timeout: 15000 });
    await page.evaluate(() => {
      const hd = document.getElementById("featurestoggle");
      if (hd.getAttribute("aria-expanded") === "true") hd.click();
      document.getElementById("features-box").innerHTML = "";
    });
    const warm = await page.evaluate(() => {
      const t0 = performance.now();
      document.getElementById("featurestoggle").click();
      return { ms: performance.now() - t0, n: document.querySelectorAll("#features-box .feat-cb").length };
    });
    expect(warm.n).toBeGreaterThanOrEqual(1);
    expect(warm.ms).toBeLessThan(300);
    expect(errors).toEqual([]);
  });

  test("Daily, Weekly and Monthly save together and survive a reload", async ({ page }) => {
    const bag = await install(page, { ops: true });
    const errors = await boot(page);
    await openFeatures(page);
    await page.click("#featurestoggle");
    await page.waitForSelector("#recap-group .recap-cb");
    const periods = page.locator("#recap-group .recap-cb");
    await expect(periods).toHaveCount(3);
    for (const key of ["daily", "weekly", "monthly"]) {
      await expect(page.locator(`#recap-group .recap-cb[data-period="${key}"]`)).not.toBeChecked();
    }
    await expect(page.locator('.feat-cb[data-k="feat.daily_recap"]')).toHaveCount(0);
    await expect(page.locator("#recap-skip")).toBeChecked();
    await page.locator('.recap-cb[data-period="weekly"]').check();
    await page.locator("#feat-enable-all").click();
    await expect(page.locator('.recap-cb[data-period="daily"]')).toBeChecked();
    await expect(page.locator('.feat-cb[data-k="feat.sport_routing"]')).toBeChecked();
    await page.locator("#feat-disable-all").click();
    await expect(page.locator('.recap-cb[data-period="weekly"]')).not.toBeChecked();
    await expect(page.locator('.feat-cb[data-k="feat.sport_routing"]')).not.toBeChecked();
    await page.locator('.recap-cb[data-period="daily"]').check();
    await page.locator("#feat-save").click();
    await expect(page.locator("#feat-msg")).toHaveText("✓ saved", { timeout: 10000 });
    const recapPost = bag.posts.find((p) => p.path === "/api/auto-recap");
    expect(recapPost.body.guild_id).toBe("1");
    expect(recapPost.body.daily.enabled).toBe(true);
    expect(recapPost.body.weekly.enabled).toBe(false);
    expect(recapPost.body.monthly.enabled).toBe(false);
    expect(recapPost.body.daily.hour).toBe(9);
    expect(recapPost.body.weekly.weekday).toBe(0);
    expect(recapPost.body.monthly.day).toBe(1);
    expect(recapPost.body.channel_key).toBe("recaps");
    expect(recapPost.body.skip_empty).toBe(true);
    const flagPost = bag.posts.find((p) => p.path === "/api/feature-flags");
    expect(flagPost.body.flags["feat.daily_recap"]).toBe(true);
    expect(flagPost.body.flags["feat.sport_routing"]).toBe(false);
    await page.locator('.recap-preview[data-k="daily"]').click();
    await expect(page.locator("#recap-msg")).toHaveText("Preview sent.");
    const preview = bag.posts.find((p) => p.path === "/api/auto-recap/preview");
    expect(preview.body).toEqual({ guild_id: "1", kind: "daily" });

    const shotDir = SHOTS;
    await page.locator("#recap-group").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shotDir, "features_recaps_390.png") });
    const box = await page.locator("#recap-group").boundingBox();
    expect(box.width).toBeLessThanOrEqual(390);

    await page.reload({ waitUntil: "domcontentloaded" });
    const card = page.locator("#overview .scard").filter({ hasText: "Test" });
    await Promise.race([
      page.locator("#featurestoggle").waitFor({ state: "attached", timeout: 20000 }),
      card.waitFor({ state: "visible", timeout: 20000 }),
    ]);
    if (await card.isVisible()) await card.click();
    await openFeatures(page);
    if ((await page.getAttribute("#featurestoggle", "aria-expanded")) !== "true") await page.click("#featurestoggle");
    await expect(page.locator('.recap-cb[data-period="daily"]')).toBeChecked({ timeout: 10000 });
    await expect(page.locator('.recap-cb[data-period="weekly"]')).not.toBeChecked();
    await expect(page.locator('.recap-cb[data-period="monthly"]')).not.toBeChecked();
    expect(errors).toEqual([]);
  });

  test("Settings general has no recap block, and a non-owner never gets the feature list", async ({ page }) => {
    const bag = await install(page, { ops: false });
    const errors = await boot(page);
    await expect(page.locator("#featurestoggle")).toHaveCount(0);
    await expect(page.locator("#adminpanel")).toHaveCount(0);
    expect(bag.gets.filter((p) => p === "/api/feature-flags" || p === "/api/auto-recap")).toEqual([]);
    await page.locator("#settings-panel .panel-hd").click();
    await page.waitForSelector("#femoji");
    await expect(page.locator("#auto-recap-slot")).toHaveCount(0);
    await expect(page.locator("#settings-body")).not.toContainText("Auto recaps");
    await expect(page.locator("#recap-group")).toHaveCount(0);
    expect(bag.gets.filter((p) => p === "/api/auto-recap")).toEqual([]);
    expect(errors).toEqual([]);
    await page.locator("#settings-panel").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, "settings_no_recaps_390.png") });
  });

  test("follow emoji picker offers server (incl. animated) and standard emojis and saves the token", async ({ page }) => {
    const bag = await install(page, { ops: false });
    const errors = await boot(page);
    await page.locator("#settings-panel .panel-hd").click();
    await page.waitForSelector("#femoji-pick");
    await page.click("#femoji-pick");
    const cells = page.locator("#femoji-panel .ep-cell");
    await expect(cells.first()).toBeVisible();
    await expect(page.locator('#femoji-panel .ep-cell[data-v="🫡"]')).toHaveCount(1);
    await page.locator('#femoji-panel .ep-cell[data-v="<a:party_parrot_long_name:1234567890123456790>"]').click();
    await expect(page.locator("#femoji")).toHaveValue("<a:party_parrot_long_name:1234567890123456790>");
    await page.click("#femoji-save");
    await expect.poll(() => bag.posts.filter((x) => x.path === "/api/follow-emoji").map((x) => x.body.emoji)).toEqual(["<a:party_parrot_long_name:1234567890123456790>"]);
    expect(errors).toEqual([]);
  });

  test("a 404 preview is not treated as sent", async ({ page }) => {
    await install(page, { ops: true, previewStatus: 404 });
    await boot(page);
    await openFeatures(page);
    await page.click("#featurestoggle");
    await page.locator('.recap-preview[data-k="weekly"]').click();
    await expect(page.locator("#recap-msg")).toHaveText("Admins only.");
  });
});
