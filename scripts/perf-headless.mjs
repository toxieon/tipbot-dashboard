#!/usr/bin/env node
/**
 * Headless Chrome metrics for tipdash (local file + mocked fetch).
 * Usage: node scripts/perf-headless.mjs
 */
import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const MOCK = {
  "/api/servers": { role: "owner", servers: [{ guild_id: "1", display_name: "T", enabled: 1, subscription_active: 1, unit_size: 20 }], follower_servers: [] },
  "/api/server": { settings: { guild_id: "1" }, stats: { won: 0, lost: 0, profit_units: 0 }, tips: { settled: [], pending: [], queued: [] }, months: [], month: "" },
  "/api/racing/next": { ok: true, races: [] },
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        const key = url.pathname + (url.search.startsWith("?guild_id=") ? "?" + url.search.slice(1).split("&")[0] : url.search);
        const body = MOCK[url.pathname] || MOCK["/api/server"];
        res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(body));
        return;
      }
      let file = url.pathname === "/" ? "/index.html" : url.pathname;
      const fp = path.join(root, file.replace(/^\//, ""));
      try {
        const data = readFileSync(fp);
        const ext = path.extname(fp);
        const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function measure() {
  const server = await startStaticServer();
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}/`;

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  await page.setRequestInterception(true);
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("afl-tipster-bot.onrender.com")) {
      if (req.method() === "OPTIONS") {
        req.respond({ status: 204, headers: cors });
        return;
      }
      const url = new URL(u);
      const path = url.pathname;
      let body = MOCK[path];
      if (!body && path === "/api/server") {
        body = Object.assign({}, MOCK["/api/server"], { settings: { guild_id: "1", display_name: "T", enabled: 1, unit_size: 20 } });
      }
      if (!body && path === "/api/servers") body = MOCK["/api/servers"];
      if (!body) body = { ok: true };
      req.respond({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
      return;
    }
    if (u.includes("site.api.espn.com")) {
      req.respond({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ events: [] }) });
      return;
    }
    req.continue();
  });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("tipbot_token", "t." + btoa('{"exp":4102444800}') + ".x");
    localStorage.setItem("tipbot_auth_epoch", "2");
    localStorage.setItem("tipbot_theme", "apex");
    window.__perf = { gbcr: 0, layout: 0 };
    const g = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      window.__perf.gbcr++;
      return g.call(this);
    };
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.entryType === "layout-shift" || e.entryType === "measure") window.__perf.layout++;
        }
      }).observe({ entryTypes: ["layout-shift"] });
    } catch (_) {}
  });

  const t0 = Date.now();
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  const loadMs = Date.now() - t0;

  await page.waitForFunction(() => {
    const app = document.getElementById("app");
    const detail = document.getElementById("detail");
    return app && !app.hidden && detail && !detail.hidden;
  }, { timeout: 45000 });

  await page.waitForFunction(() => window.ApexTheme, { timeout: 20000 });
  const beforeResize = await page.evaluate(() => window.__perf.gbcr);
  await page.evaluate(() => {
    for (let i = 0; i < 200; i++) window.dispatchEvent(new Event("resize"));
  });
  await new Promise((r) => setTimeout(r, 120));
  const afterResize = await page.evaluate(() => window.__perf.gbcr);
  const resizeGbcr = afterResize - beforeResize;

  const scrollGbcrBefore = await page.evaluate(() => window.__perf.gbcr);
  await page.evaluate(() => {
    window.scrollTo(0, 400);
    window.scrollTo(0, 0);
    for (let i = 0; i < 30; i++) window.scrollTo(0, i * 20);
  });
  await new Promise((r) => setTimeout(r, 150));
  const scrollGbcr = (await page.evaluate(() => window.__perf.gbcr)) - scrollGbcrBefore;

  const lazyImgs = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img")];
    return { total: imgs.length, lazy: imgs.filter((i) => i.loading === "lazy").length };
  });

  await browser.close();
  server.close();

  return { loadMs, resizeGbcr, scrollGbcr, lazyImgs };
}

measure()
  .then((m) => {
    process.stdout.write(JSON.stringify(m, null, 2) + "\n");
  })
  .catch((e) => {
    process.stderr.write(String(e.stack || e) + "\n");
    process.exit(1);
  });
