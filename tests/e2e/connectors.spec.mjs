import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const EXT = `
window.TBOwner = {
  adminHtml: function(){ return ""; },
  bindAdmin: function(){},
  ensureSettingsMarkup: function(){},
  paintSignup: function(){},
  wireSignup: function(){},
  paintOps: function(){},
  clearOps: function(){},
};
window.TBConnectors = {
  mount: function(el){ el.innerHTML = '<div id="cx-client-marker">Saved feed</div>'; }
};
`;

function connectors() {
  return [
    {
      id: "c-feed",
      type: "feed",
      tipster_name: "Desk feed",
      enabled: true,
      api_key_last4: "aa11",
      has_api_key: true,
      alerts_enabled: false,
      alert_failure_threshold: 3,
      alert_quiet_minutes: 60,
    },
    {
      id: "c-json",
      type: "json",
      tipster_name: "JSON feed",
      endpoint_url: "https://feeds.example.com/tips",
      auth_style: "bearer",
      cursor_param: "since",
      field_map: {
        tips: "$.tips",
        next_cursor: "$.next_since",
        external_id: "$.id",
        event: "$.event",
        selection: "$.selection",
        market: "$.market",
        odds: "$.odds",
        units: "$.units",
        bookie: "$.bookie",
        confidence: "$.confidence",
        event_start: "$.event_start",
        sport: "$.sport",
        status: "$.status",
      },
      enabled: false,
      api_key_last4: "k9qm",
      has_api_key: true,
      poll_interval_seconds: 60,
      post_mode: "replace",
      skip_past_events: true,
      alerts_enabled: false,
      alert_failure_threshold: 3,
      alert_quiet_minutes: 60,
    },
  ];
}

function statsFor(id, period) {
  const week = period === "week";
  return {
    ok: true,
    period: period,
    wins: week ? 10 : 4,
    losses: week ? 3 : 2,
    voids: 1,
    strike_rate: week ? 0.769 : 0.667,
    profit_units: week ? 8.5 : 3.5,
    roi: week ? 0.4 : 0.25,
    average_odds: week ? 2.8 : 2.4,
    confidence: [
      { label: "High", wins: week ? 7 : 3, losses: 0, voids: 0, strike_rate: 1, profit_units: 4.2 },
      { label: "Low", wins: 1, losses: 2, voids: 1, strike_rate: 0.333, profit_units: -0.7 },
    ],
    mismatches: 1,
    mismatch_items: [{ summary: "Sample R2", client: "won", ours: "lost" }],
    best: { summary: "Sample R1 · Runner", odds: 4.5, profit_units: 3.5, result: "won" },
    worst: { summary: "Sample R3 · Other", odds: 1.6, profit_units: -1, result: "lost" },
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

test.describe("connector stats, alerts, generic JSON", () => {
  let server;
  let base;
  test.beforeAll(async () => {
    server = await startSite();
    base = `http://127.0.0.1:${server.address().port}/`;
  });
  test.afterAll(async () => { if (server) server.close(); });

  async function install(page, { ops = true, ext = true } = {}) {
    const bag = { gets: [], posts: [], stats: [], dry: [], assets: [] };
    page.on("request", (req) => {
      if (req.url().includes("connector-panel.js")) bag.assets.push(req.url());
    });
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
        await route.fulfill({ status: ext && ops ? 200 : 404, contentType: "text/javascript", body: ext && ops ? EXT : "", headers: cors });
        return;
      }
      const method = route.request().method();
      let body = {};
      if (method === "POST" || method === "DELETE") {
        try { body = JSON.parse(route.request().postData() || "{}"); } catch { body = {}; }
        bag.posts.push({ path: parsed.pathname, body });
        if (parsed.pathname.endsWith("/dry-run")) bag.dry.push(body);
      } else {
        bag.gets.push(parsed.pathname + parsed.search);
      }
      const statsMatch = parsed.pathname.match(/^\/api\/connectors\/([^/]+)\/stats$/);
      let payload = { ok: true, games: [], tips: [] };
      let status = 200;
      if (statsMatch) {
        const id = decodeURIComponent(statsMatch[1]);
        const period = parsed.searchParams.get("period") || "day";
        bag.stats.push({ id, period });
        payload = statsFor(id, period);
      } else if (parsed.pathname === "/api/connectors" && method === "GET") {
        payload = { ok: true, guild_id: "1", connectors: connectors() };
      } else if (parsed.pathname.endsWith("/dry-run")) {
        payload = {
          ok: true,
          count: 1,
          posted: 0,
          preview: [{ game: "Sample R1", selection: { number: 4, name: "Runner" }, bet_type: "Win", odds: 3.4, confidence: "High" }],
          embeds: [{ title: "Sample R1", description: "High", author: { name: "JSON feed" } }],
        };
      } else if (method === "POST" && parsed.pathname.indexOf("/api/connectors") === 0) {
        payload = Object.assign({ ok: true, id: body.id || "c-new" }, body, { api_key: undefined, api_key_last4: "k9qm", has_api_key: true });
      } else if (parsed.pathname === "/api/servers") {
        payload = { role: ops ? "owner" : "mod", ops: !!ops, servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 100, won: 7, lost: 4, profit_units: 6.2, roi: 42, queued: 0 }], follower_servers: [] };
      } else if (parsed.pathname === "/api/server") {
        payload = { settings: { guild_id: "1", display_name: "Test", enabled: 1, can_admin: true, unit_size: 100 }, stats: { won: 7, lost: 4, push: 1, profit_units: 6.2, roi: 42.8, queued: 0, strike_rate: 58, followers: 3, settled: 12, staked_units: 14.5 }, tips: { settled: [], queued: [] }, months: [], month: "" };
      } else if (parsed.pathname === "/api/terms/status") payload = { ok: true, version: "1.0", accepted: true };
      else if (parsed.pathname === "/api/me") payload = { ok: true, ops: !!ops };
      await route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(payload) });
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

  async function openConnectors(page) {
    const hd = page.locator("#settings-panel > .panel-hd");
    if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
    await page.locator("#stab-connectors").click();
    await page.waitForSelector("#cpx", { timeout: 15000 });
  }

  test("day, week, alerts, and a live JSON dry run at 390px", async ({ page }) => {
    const bag = await install(page, { ops: true, ext: true });
    const errors = await boot(page);
    await openConnectors(page);
    await expect(page.locator("#cx-client-marker")).toHaveText("Saved feed");
    const card = page.locator('.cpx-card[data-id="c-json"]');
    await expect(card.locator(".cpx-stats-body")).toContainText("4 W · 2 L · 1 void");
    await expect(card.locator(".cpx-stats-body")).toContainText("66.7%");
    await expect(card.locator(".cpx-stats-body")).toContainText("+3.5u");
    await expect(card.locator(".cpx-stats-body")).toContainText("25%");
    await expect(card.locator(".cpx-stats-body")).toContainText("2.40");
    await expect(card.locator(".cpx-stats-body")).toContainText("High");
    await expect(card.locator(".cpx-stats-body")).toContainText("Mismatches");
    await expect(card.locator(".cpx-stats-body")).toContainText("client won");
    await expect(card.locator(".cpx-stats-body")).toContainText("Best");
    await expect(card.locator(".cpx-stats-body")).toContainText("Sample R1");
    await expect(card.locator(".cpx-stats-body")).toContainText("Worst");
    await expect(card.getByRole("tab", { name: "Day" })).toHaveAttribute("aria-selected", "true");
    const dayStats = bag.stats.filter((s) => s.id === "c-json" && s.period === "day");
    expect(dayStats.length).toBeGreaterThan(0);

    await card.locator(".cpx-stats").scrollIntoViewIfNeeded();
    await card.locator(".cpx-stats").screenshot({ path: path.join(SHOTS, "connectors_stats_day_390.png") });

    await card.getByRole("tab", { name: "Week" }).click();
    await expect(card.locator(".cpx-stats-body")).toContainText("10 W · 3 L · 1 void");
    await expect(card.getByRole("tab", { name: "Week" })).toHaveAttribute("aria-selected", "true");
    expect(bag.stats.some((s) => s.id === "c-json" && s.period === "week")).toBe(true);
    await card.getByRole("tab", { name: "Month" }).click();
    await expect.poll(() => bag.stats.some((s) => s.id === "c-json" && s.period === "month")).toBe(true);
    await card.getByRole("tab", { name: "All time" }).click();
    await expect.poll(() => bag.stats.some((s) => s.id === "c-json" && s.period === "all")).toBe(true);

    const sw = card.locator("[data-alert-on]");
    await expect(sw).toHaveAttribute("aria-checked", "false");
    await sw.click();
    await expect(sw).toHaveText("On");
    await card.locator('[data-k="threshold"]').fill("5");
    await card.locator('[data-k="quiet"]').fill("15");
    await card.locator(".cpx-alerts").screenshot({ path: path.join(SHOTS, "connectors_alerts_390.png") });
    await card.locator('[data-act="save-alerts"]').click();
    await expect(card.locator('[data-msg="alerts"]')).toHaveText("Saved.");
    const alertPost = bag.posts.find((p) => p.path === "/api/connectors/c-json" && p.body.alerts_enabled === true);
    expect(alertPost).toBeTruthy();
    expect(alertPost.body.guild_id).toBe("1");
    expect(alertPost.body.alert_failure_threshold).toBe(5);
    expect(alertPost.body.alert_quiet_minutes).toBe(15);
    expect(alertPost.body.enabled).toBeUndefined();

    await expect(card.locator('[data-k="endpoint"]')).toHaveValue("https://feeds.example.com/tips");
    await expect(card.locator('[data-k="auth_style"]')).toHaveValue("bearer");
    await expect(card.locator('[data-k="cursor_param"]')).toHaveValue("since");
    await expect(card.locator('[data-path="event"]')).toHaveValue("$.event");
    await expect(card.locator("[data-preview]")).toContainText("Nothing was posted.");
    await expect(card.locator("[data-preview]")).toContainText("Sample R1");
    await card.locator('[data-path="event"]').fill("$.race.name");
    await expect.poll(() => bag.dry.some((d) => d.field_map && d.field_map.event === "$.race.name")).toBe(true);
    const preview = bag.dry.filter((d) => d.field_map && d.field_map.event === "$.race.name").pop();
    expect(preview.auth_style).toBe("bearer");
    expect(preview.cursor_param).toBe("since");
    expect(preview.endpoint_url).toBe("https://feeds.example.com/tips");
    expect(preview.guild_id).toBe("1");
    await expect(card.locator("[data-preview]")).toContainText("Sample R1 · #4 Runner · Win · @3.40");
    await card.locator(".cpx-json").scrollIntoViewIfNeeded();
    await card.locator(".cpx-json").screenshot({ path: path.join(SHOTS, "connectors_json_preview_390.png") });

    const box = await card.locator(".cpx-stats").boundingBox();
    expect(box.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
    expect(bag.assets.length).toBeGreaterThan(0);
  });

  test("a non-owner never sees the tab or calls the connector routes", async ({ page }) => {
    const bag = await install(page, { ops: false });
    const errors = await boot(page);
    const hd = page.locator("#settings-panel > .panel-hd");
    if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
    await expect(page.locator("#stab-connectors")).toHaveCount(0);
    await expect(page.locator("#cpx")).toHaveCount(0);
    expect(bag.gets.filter((p) => p.indexOf("/api/connectors") === 0)).toEqual([]);
    expect(bag.assets).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("stats still render when the client script is missing", async ({ page }) => {
    const bag = await install(page, { ops: true, ext: false });
    const errors = await boot(page);
    await openConnectors(page);
    await expect(page.locator("#cx-client-marker")).toHaveCount(0);
    await expect(page.locator('.cpx-card[data-id="c-feed"] .cpx-stats-body')).toContainText("4 W · 2 L · 1 void");
    await expect(page.locator('.cpx-card[data-id="c-feed"] .cpx-json')).toHaveCount(0);
    await expect(page.locator('.cpx-card[data-id="c-json"] .cpx-json')).toBeVisible();
    expect(bag.stats.some((s) => s.id === "c-feed" && s.period === "day")).toBe(true);
    expect(errors).toEqual([]);
  });
});
