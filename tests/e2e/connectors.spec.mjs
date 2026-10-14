import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const SHOTS = process.env.E2E_SHOTS_DIR || path.join(os.tmpdir(), "tipdash-e2e");
mkdirSync(SHOTS, { recursive: true });
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function connector(over) {
  return Object.assign({
    id: "c1",
    type: "horsepicks",
    endpoint_url: "https://horsepicks-tips.horsepicksai.workers.dev/tips",
    api_key_last4: "fYa1",
    has_api_key: true,
    target_channel_id: "222",
    tipster_label: "HorsePicks AI",
    poll_interval_seconds: 60,
    post_mode: "replace",
    skip_past_events: true,
    enabled: false,
    backfill_from: null,
    status: {
      last_poll: "2026-10-14T06:00:00Z",
      last_success: "2026-10-14T06:00:00Z",
      last_error: null,
      tips_posted_today: 2,
      map_size: 18,
    },
  }, over);
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

test.describe("connectors settings", () => {
  let server;
  let base;
  test.beforeAll(async () => {
    server = await startSite();
    base = `http://127.0.0.1:${server.address().port}/`;
  });
  test.afterAll(async () => { if (server) server.close(); });

  const liveTip = {
    event: "Randwick R4",
    selection: { number: 5, name: "Splendid Win" },
    market: "Win",
    odds: 4.2,
    bookie: "BetDeluxe",
    stake_units: 4.5,
    confidence: { models_agreeing: 3, models_total: 4, rating: "High" },
  };
  const liveEvents = [
    { id: "p1", type: "poll", at: "2026-10-14T07:21:00Z", count: 4 },
    { id: "t1", type: "tip_received", at: "2026-10-14T07:21:04Z", tip: liveTip },
    { id: "t2", type: "posted", at: "2026-10-14T07:21:05Z", tip: liveTip },
    { id: "s1", type: "status_update", at: "2026-10-14T07:21:06Z", status: "scratched", tip: { event: "Randwick R4", selection: { number: 5, name: "Splendid Win" } } },
    { id: "s2", type: "status_update", at: "2026-10-14T07:21:07Z", status: "won", tip: { event: "Randwick R4", selection: { number: 2, name: "Fast Lane" } } },
    { id: "s3", type: "status_update", at: "2026-10-14T07:21:08Z", status: "lost", tip: { event: "Randwick R4", selection: { number: 8, name: "Slow Bolt" } } },
    { id: "k1", type: "skipped", at: "2026-10-14T07:21:09Z", message: "past", tip: { event: "Randwick R4", selection: { number: 1, name: "Old News" } } },
    { id: "e1", type: "error", at: "2026-10-14T07:21:10Z", message: "upstream 502" },
  ];

  async function install(page, { ops, stream } = {}) {
    const bag = { calls: [], current: connector() };
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
      let body = null;
      if (route.request().method() !== "GET" && route.request().method() !== "HEAD") {
        try { body = JSON.parse(route.request().postData() || "{}"); } catch { body = {}; }
      }
      const call = { method: route.request().method(), path: parsed.pathname, search: parsed.search, body };
      if (parsed.pathname.startsWith("/api/connectors") || parsed.pathname === "/api/channels") bag.calls.push(call);

      let status = 200;
      let payload = { ok: true };
      if (parsed.pathname === "/api/servers") {
        payload = { role: ops ? "owner" : "mod", ops: !!ops, servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 100, won: 7, lost: 4, profit_units: 6.2, roi: 42, queued: 0 }], follower_servers: [] };
      } else if (parsed.pathname === "/api/server") {
        payload = { settings: { guild_id: "1", display_name: "Test", enabled: 1, can_admin: true, unit_size: 100 }, stats: { won: 7, lost: 4, push: 1, profit_units: 6.2, roi: 42.8, queued: 0, strike_rate: 58, followers: 3, settled: 12, staked_units: 14.5 }, tips: { settled: [], queued: [] }, months: [], month: "" };
      } else if (parsed.pathname === "/api/terms/status") payload = { ok: true, version: "1.0", accepted: true };
      else if (parsed.pathname === "/api/me") payload = { ok: true, ops: !!ops };
      else if (parsed.pathname === "/api/ops/ext.js") {
        await route.fulfill({ status: 404, contentType: "text/javascript", body: "", headers: cors });
        return;
      } else if (parsed.pathname === "/api/channels") {
        payload = { ok: true, channels: [{ id: "111", name: "tips", category: "Tips" }, { id: "222", name: "racing", category: "Tips" }], outputs: [] };
      } else if (parsed.pathname === "/api/connectors" && route.request().method() === "GET") {
        payload = { ok: true, connectors: bag.current.id ? [bag.current] : [] };
      } else if (parsed.pathname === "/api/connectors" && route.request().method() === "POST") {
        bag.current = Object.assign({}, bag.current, body, { id: bag.current.id || "c1", api_key_last4: body.api_key ? String(body.api_key).slice(-4) : bag.current.api_key_last4 });
        delete bag.current.api_key;
        payload = { ok: true, connector: bag.current };
      } else if (parsed.pathname === "/api/connectors" && route.request().method() === "DELETE") {
        bag.current = { id: "" };
        payload = { ok: true };
      } else if (parsed.pathname === "/api/connectors/c1/test") {
        payload = {
          ok: true,
          count: 5,
          preview: [
            { event: "Flemington R4", selection: { number: 3, name: "Night Mail" }, market: "Win", odds: 4.2, bookie: "TAB", stake_units: 1, confidence: { models_agreeing: 3, models_total: 4, rating: "High" } },
            { event: "Randwick R2", selection: { number: 1, name: "River Bend" }, market: "Place", odds: 1.8, bookie: "Sportsbet", stake_units: 1, confidence: { models_agreeing: 2, models_total: 4, rating: "Medium" } },
            { event: "Caulfield R6", selection: { number: 7, name: "Gold Run" }, market: "EW", odds: 6.5, bookie: "Neds", stake_units: 0.5, confidence: { models_agreeing: 4, models_total: 4, rating: "High" } },
            { event: "Should not show", selection: "Extra" },
          ],
        };
      } else if (parsed.pathname === "/api/connectors/c1/dry-run") {
        payload = {
          ok: true,
          embeds: [{
            title: "HorsePicks AI · Flemington R4",
            description: "3 Night Mail · Win @4.2",
            fields: [{ name: "Bookie", value: "TAB" }, { name: "Stake", value: "1u" }, { name: "Confidence", value: "3/4 models · High" }],
            footer: { text: "Dry run · nothing posted" },
          }],
        };
      } else if (parsed.pathname === "/api/connectors/c1/toggle") {
        bag.current = Object.assign({}, bag.current, { enabled: !!(body && body.enabled) });
        payload = { ok: true, connector: bag.current };
      } else if (parsed.pathname === "/api/connectors/c1/events/stream") {
        if (stream === "sse") {
          const frame = [
            "id: t1",
            "event: tip_received",
            "data: " + JSON.stringify({ id: "t1", type: "tip_received", at: "2026-10-14T07:21:04Z", tip: liveTip }),
            "",
            "",
          ].join("\n");
          await route.fulfill({
            status: 200,
            headers: Object.assign({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache" }, cors),
            body: frame,
          });
          return;
        }
        await route.fulfill({ status: 404, contentType: "application/json", headers: cors, body: "{}" });
        return;
      } else if (parsed.pathname === "/api/connectors/c1/events") {
        payload = { ok: true, events: parsed.searchParams.get("after") ? [] : liveEvents };
      }
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

  async function openSettings(page) {
    if ((await page.getAttribute("#settings-panel .panel-hd", "aria-expanded")) !== "true") {
      await page.locator("#settings-panel .panel-hd").click();
    }
    await page.waitForSelector("#femoji", { timeout: 10000 });
  }

  test("owner can test, preview, and enable a paused connector at 390px", async ({ page }) => {
    const bag = await install(page, { ops: true });
    const errors = await boot(page);
    await openSettings(page);
    await expect(page.locator("#stab-connectors")).toBeVisible();
    await page.locator("#stab-connectors").click();
    await page.waitForSelector("#cx-form");
    await expect(page.locator("#cx-key")).toHaveAttribute("type", "password");
    await expect(page.locator("#cx-key")).toHaveValue("");
    await expect(page.locator("#cx-root")).toContainText("ends in fYa1");
    await expect(page.locator("#cx-root")).toContainText("Paused");
    await expect(page.locator("#cx-enabled")).not.toBeChecked();
    await expect(page.locator("#cx-skip")).toBeChecked();
    await expect(page.locator("#cx-tipster")).toHaveValue("HorsePicks AI");
    await expect(page.locator("#cx-poll")).toHaveValue("60");
    await expect(page.locator("#cx-root")).toContainText("Replace their posts");
    await expect(page.locator("#cx-root")).toContainText("Mirror alongside");
    await expect(page.locator("#cx-toggle")).toHaveText("Enable");
    await expect(page.locator("#cx-root")).toContainText("Saved");
    await expect(page.locator(".cx-status")).toContainText("Tips posted today");
    await expect(page.locator(".cx-status")).toContainText("Map size");
    await expect(page.locator(".cx-status")).toContainText("18");
    await expect(page.locator(".cx-status")).toContainText("2");
    await page.locator("#cx-root").screenshot({ path: path.join(SHOTS, "connectors_form_390.png") });

    const list = bag.calls.find((c) => c.method === "GET" && c.path === "/api/connectors");
    expect(list.search).toBe("?guild_id=1");

    await page.locator("#cx-key").fill("typed-key-9999");
    await page.locator('input[name="cx-mode"][value="alongside"]').check();
    await page.locator("#cx-save").click();
    await expect(page.locator("#cx-msg")).toContainText("Saved");
    await expect(page.locator("#cx-root")).not.toContainText("Not saved yet");
    await expect(page.locator("#cx-key")).toHaveValue("");
    await expect(page.locator("#cx-root")).toContainText("ends in 9999");
    const save = bag.calls.find((c) => c.method === "POST" && c.path === "/api/connectors");
    expect(save.search).toBe("?guild_id=1");
    expect(save.body.api_key).toBe("typed-key-9999");
    expect(save.body.post_mode).toBe("alongside");
    expect(save.body.enabled).toBe(false);
    expect(save.body.skip_past_events).toBe(true);
    expect(save.body.guild_id).toBe("1");
    expect(JSON.stringify(save.body)).not.toContain("edyx");

    await page.locator("#cx-test").click();
    await expect(page.locator("#cx-result")).toContainText("5 tips");
    await expect(page.locator("#cx-result")).toContainText("Nothing was posted");
    await expect(page.locator("#cx-result")).toContainText("3 Night Mail");
    await expect(page.locator("#cx-result")).toContainText("3/4 models · High");
    await expect(page.locator("#cx-result")).not.toContainText("Should not show");
    const tested = bag.calls.find((c) => c.path === "/api/connectors/c1/test");
    expect(tested.method).toBe("POST");
    expect(tested.body.api_key).toBeUndefined();

    await page.locator("#cx-dry").click();
    await expect(page.locator("#cx-result")).toContainText("Dry run");
    await expect(page.locator("#cx-result")).toContainText("Nothing was posted");
    await expect(page.locator("#cx-result")).toContainText("HorsePicks AI · Flemington R4");
    await expect(page.locator("#cx-result .cx-embed")).toContainText("TAB");
    const dry = bag.calls.find((c) => c.path === "/api/connectors/c1/dry-run");
    expect(dry.method).toBe("POST");

    const box = await page.locator("#cx-root").boundingBox();
    expect(box.width).toBeLessThanOrEqual(390);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    await page.locator("#cx-result").screenshot({ path: path.join(SHOTS, "connectors_preview_390.png") });

    await page.locator("#cx-toggle").click();
    await expect(page.locator("#cx-toggle")).toHaveText("Pause");
    await expect(page.locator("#cx-root")).toContainText("On");
    const toggled = bag.calls.find((c) => c.path === "/api/connectors/c1/toggle");
    expect(toggled.body).toEqual({ guild_id: "1", enabled: true });

    await page.locator("#cx-toggle").click();
    await expect(page.locator("#cx-toggle")).toHaveText("Enable");
    const pauses = bag.calls.filter((c) => c.path === "/api/connectors/c1/toggle");
    expect(pauses[1].body.enabled).toBe(false);

    await page.locator("#cx-remove").click();
    await page.locator('.tbs-btn[data-act="ok"]').click();
    await expect(page.locator("#cx-msg")).toContainText("Removed");
    await expect(page.locator("#cx-test")).toBeDisabled();
    await expect(page.locator(".cx-board")).toHaveCount(0);
    const removed = bag.calls.find((c) => c.method === "DELETE");
    expect(removed.path).toBe("/api/connectors");
    expect(removed.search).toContain("guild_id=1");
    expect(removed.search).toContain("id=c1");
    expect(errors).toEqual([]);
  });

  test("a non-owner never sees the tab and never calls connector routes", async ({ page }) => {
    const bag = await install(page, { ops: false });
    const errors = await boot(page);
    await expect(page.locator("#stab-connectors")).toHaveCount(0);
    await openSettings(page);
    await expect(page.locator("#settings-body")).toBeVisible();
    await expect(page.locator("#stab-connectors")).toHaveCount(0);
    await expect(page.locator("#cx-root")).toHaveCount(0);
    expect(bag.calls.filter((c) => c.path.startsWith("/api/connectors"))).toEqual([]);
    expect(errors).toEqual([]);
    await page.locator("#settings-panel").screenshot({ path: path.join(SHOTS, "connectors_hidden_390.png") });
  });

  test("live log falls back to a 3s poll and filters at 390px", async ({ page }) => {
    const bag = await install(page, { ops: true });
    const errors = await boot(page);
    await openSettings(page);
    await page.locator("#stab-connectors").click();
    await page.waitForSelector(".cx-board");
    const recv = page.locator('.cx-line[data-tag="RECV"]');
    await expect(recv).toContainText("18:21:04 RECV Randwick R4 #5 Splendid Win @4.20 BetDeluxe 4.5u [3/4 HIGH]");
    await expect(page.locator('.cx-line[data-tag="POSTED"]')).toContainText("POSTED");
    await expect(page.locator('.cx-line[data-tag="SCRATCHED"]')).toContainText("SCRATCHED");
    await expect(page.locator('.cx-line[data-tag="WON"]')).toContainText("WON");
    await expect(page.locator('.cx-line[data-tag="LOST"]')).toContainText("LOST");
    await expect(page.locator('.cx-line[data-tag="SKIP"]')).toContainText("SKIP");
    await expect(page.locator('.cx-line[data-tag="ERR"]')).toContainText("ERR upstream 502");
    await expect(page.locator(".cx-cursor")).toHaveCount(1);
    const paths = bag.calls.map((c) => c.path);
    const streamAt = paths.indexOf("/api/connectors/c1/events/stream");
    const eventsAt = paths.indexOf("/api/connectors/c1/events");
    expect(streamAt).toBeGreaterThanOrEqual(0);
    expect(eventsAt).toBeGreaterThan(streamAt);
    const polled = bag.calls.find((c) => c.path === "/api/connectors/c1/events");
    expect(polled.method).toBe("GET");
    expect(polled.search).toBe("");

    const chip = await page.locator('.cx-chip[data-filter="errors"]').boundingBox();
    expect(chip.height).toBeGreaterThanOrEqual(44);
    const logBox = await page.locator(".cx-log").boundingBox();
    expect(logBox.height).toBeLessThanOrEqual(180);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    const scrolls = await page.locator(".cx-log").evaluate((el) => el.scrollHeight > el.clientHeight + 8);
    expect(scrolls).toBe(true);
    await page.locator(".cx-board").screenshot({ path: path.join(SHOTS, "connectors_live_390.png") });

    await page.locator(".cx-log").evaluate((el) => { el.scrollTop = 0; });
    await expect(page.locator(".cx-log-jump")).toBeVisible();
    await page.locator(".cx-log-jump").click();
    await expect(page.locator(".cx-log-jump")).toBeHidden();
    const atEnd = await page.locator(".cx-log").evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight <= 28);
    expect(atEnd).toBe(true);

    await page.locator('.cx-chip[data-filter="errors"]').click();
    await expect(page.locator('.cx-line[data-tag="RECV"]')).toHaveCount(0);
    await expect(page.locator('.cx-line[data-tag="ERR"]')).toHaveCount(1);
    await page.locator('.cx-chip[data-filter="results"]').click();
    await expect(page.locator('.cx-line[data-tag="WON"]')).toHaveCount(1);
    await expect(page.locator('.cx-line[data-tag="LOST"]')).toHaveCount(1);
    await expect(page.locator('.cx-line[data-tag="SCRATCHED"]')).toHaveCount(1);
    await expect(page.locator('.cx-line[data-tag="RECV"]')).toHaveCount(0);
    await expect(page.locator('.cx-line[data-tag="ERR"]')).toHaveCount(0);
    await page.locator('.cx-chip[data-filter="tips"]').click();
    await expect(page.locator('.cx-line[data-tag="RECV"]')).toHaveCount(1);
    await expect(page.locator('.cx-line[data-tag="POSTED"]')).toHaveCount(1);
    await expect(page.locator('.cx-line[data-tag="SKIP"]')).toHaveCount(1);
    await expect(page.locator('.cx-line[data-tag="ERR"]')).toHaveCount(0);
    await expect(page.locator('.cx-line[data-tag="WON"]')).toHaveCount(0);
    await expect(page.locator('.cx-line[data-tag="POLL"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("a live stream paints a tip before the poll starts", async ({ page }) => {
    const bag = await install(page, { ops: true, stream: "sse" });
    const errors = await boot(page);
    await openSettings(page);
    await page.locator("#stab-connectors").click();
    await expect(page.locator('.cx-line[data-tag="RECV"]')).toContainText("Splendid Win @4.20");
    expect(bag.calls.some((c) => c.path === "/api/connectors/c1/events/stream")).toBe(true);
    expect(bag.calls.some((c) => c.path === "/api/connectors/c1/events")).toBe(false);
    expect(errors).toEqual([]);
  });
});
