// Features Live: "Show my marker on followers' racetracks" (feat.racetrack_marker).
import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHOTS = process.env.SHOTS || "";
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
  return {
    ok: true,
    flags: {
      "feat.racetrack_marker": true,
      "feat.gv_refresh_button": false,
      "feat.livestats": true,
    },
    labels: {
      "feat.racetrack_marker": "Show my marker on followers' racetracks",
      "feat.gv_refresh_button": "Game view refresh button",
      "feat.livestats": "Live stats",
    },
    keys: ["feat.livestats", "feat.gv_refresh_button", "feat.racetrack_marker"],
    categories: { "feat.livestats": "Live", "feat.gv_refresh_button": "Live", "feat.racetrack_marker": "Live" },
    categoryOrder: ["Live"],
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

test("Features Live shows racetrack marker toggle (default on)", async ({ page }) => {
  const server = await startSite();
  const base = `http://127.0.0.1:${server.address().port}/`;
  try {
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
      if (parsed.pathname === "/api/ops/ext.js") {
        await route.fulfill({ status: 200, contentType: "text/javascript", body: EXT, headers: cors });
        return;
      }
      if (route.request().method() === "POST" && parsed.pathname === "/api/feature-flags") {
        await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ ok: true, flags: flagPayload().flags }) });
        return;
      }
      let payload = { ok: true };
      if (parsed.pathname === "/api/servers") {
        payload = { role: "owner", ops: true, servers: [{ guild_id: "1", display_name: "Test", enabled: 1, subscription_active: 1, unit_size: 100, won: 7, lost: 4, profit_units: 6.2, roi: 42, queued: 0 }], follower_servers: [] };
      } else if (parsed.pathname === "/api/server") {
        payload = { settings: { guild_id: "1", display_name: "Test", enabled: 1, can_admin: true, unit_size: 100 }, stats: { won: 7, lost: 4, push: 1, profit_units: 6.2, roi: 42.8, queued: 0, strike_rate: 58, followers: 3, settled: 12, staked_units: 14.5 }, tips: { settled: [], queued: [] }, months: [], month: "" };
      } else if (parsed.pathname === "/api/terms/status") payload = { ok: true, version: "1.0", accepted: true };
      else if (parsed.pathname === "/api/me") payload = { ok: true, ops: true };
      else if (parsed.pathname === "/api/feature-flags") payload = flagPayload();
      else if (parsed.pathname === "/api/auto-recap") payload = { ok: true, settings: {}, outputs: [], channels: [] };
      else if (parsed.pathname === "/api/guild-emojis") payload = { ok: true, emojis: [] };
      await route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(payload) });
    });
    await page.addInitScript(() => {
      localStorage.setItem("tipbot_token", "t." + btoa(JSON.stringify({ exp: 4102444800 })) + ".x");
      localStorage.setItem("tipbot_auth_epoch", "2");
      localStorage.setItem("tipbot_theme", "apex");
    });
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.locator("#overview .scard").filter({ hasText: "Test" }).click();
    await page.waitForSelector("#settings-panel", { timeout: 20000 });
    await page.waitForSelector("#featurestoggle", { state: "attached" });
    if ((await page.getAttribute("#admintoggle", "aria-expanded")) !== "true") await page.click("#admintoggle");
    await page.locator("#featurestoggle").scrollIntoViewIfNeeded();
    await page.click("#featurestoggle");
    await page.waitForSelector('.feat-cb[data-k="feat.racetrack_marker"]', { timeout: 15000 });
    const cb = page.locator('.feat-cb[data-k="feat.racetrack_marker"]');
    await expect(cb).toBeChecked();
    await expect(page.locator("#features-box")).toContainText("Show my marker on followers' racetracks");
    await expect(page.locator("#features-box")).toContainText("feat.racetrack_marker");
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.locator("#featuresbody").screenshot({ path: path.join(SHOTS, "studio-marker-toggle.png") });
    }
  } finally {
    server.close();
  }
});
