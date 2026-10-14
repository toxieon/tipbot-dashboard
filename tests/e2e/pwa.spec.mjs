import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

let baseUrl;
let server;

test.beforeAll(async () => {
  server = await startMockSite();
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  if (server) server.close();
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

async function noOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
}

async function boot(page, opts = {}) {
  const errors = trackErrors(page);
  await installApiMock(page);
  if (opts.auth !== false) await page.addInitScript(authInitScript());
  if (opts.init) await page.addInitScript(opts.init);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  if (opts.auth === false) {
    await page.waitForFunction(() => {
      const a = document.getElementById("loginbtn");
      return a && /\/auth\/login$/.test(a.getAttribute("href") || "");
    });
  } else {
    await page.waitForFunction(() => {
      const app = document.getElementById("app");
      return app && !app.hidden;
    });
  }
  return errors;
}

async function swReady(page) {
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await page.evaluate(() => navigator.serviceWorker.ready);
}

async function cacheUrls(page) {
  return page.evaluate(async () => {
    const out = [];
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      for (const req of await cache.keys()) out.push(req.url);
    }
    return out;
  });
}

test("manifest, shell, and hidden owner controls at 390×844", async ({ page }) => {
  const errors = await boot(page);
  await swReady(page);
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const res = await fetch(link.href);
    return res.json();
  });
  expect(manifest.name).toBe("TipBot Dashboard");
  expect(manifest.short_name).toBe("TipBot");
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe("#0F1420");
  expect(manifest.icons.some((i) => i.sizes === "192x192")).toBe(true);
  expect(manifest.icons.some((i) => i.sizes === "512x512")).toBe(true);
  await expect(page.locator("#pwa-update")).toBeHidden();
  await expect(page.locator("#pwa-ios")).toHaveCount(0);
  await expect(page.locator("#nav-ops")).toBeHidden();
  await expect(page.locator("#dd-owner-settings")).toBeHidden();
  const urls = await cacheUrls(page);
  expect(urls.some((u) => u.includes("/api/"))).toBe(false);
  expect(urls.some((u) => u.includes("onrender.com"))).toBe(false);
  expect(urls.some((u) => u.endsWith("/") || u.includes("/index.html"))).toBe(true);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("API responses are not stored and fail offline at 390×844", async ({ page, context }) => {
  await boot(page);
  await swReady(page);
  await page.evaluate(async () => {
    await fetch("/api/servers", { cache: "no-store" });
    await fetch("https://afl-tipster-bot.onrender.com/api/terms/status", {
      cache: "no-store",
      headers: { Authorization: "Bearer t" },
    });
  });
  const urls = await cacheUrls(page);
  expect(urls.some((u) => new URL(u).pathname === "/api/servers" || new URL(u).pathname.startsWith("/api/"))).toBe(false);
  expect(urls.some((u) => u.includes("onrender.com"))).toBe(false);
  await context.setOffline(true);
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch("/api/servers", { cache: "no-store" });
      return { failed: false, status: res.status };
    } catch (e) {
      return { failed: true };
    }
  });
  expect(result.failed).toBe(true);
});

test("offline fallback and saved dashboard at 390×844", async ({ page, context }) => {
  await boot(page);
  await swReady(page);
  await context.setOffline(true);
  const missing = await page.goto(baseUrl + "no/such/page", { waitUntil: "domcontentloaded" });
  expect(missing.status()).toBe(200);
  await expect(page.locator("#offline-title")).toHaveText("You're offline");
  await expect(page.locator("#offline-retry")).toBeVisible();
  await noOverflow(page);
  await page.locator("a[href='/']").click();
  await page.waitForFunction(() => document.title.indexOf("TipBot Dashboard") !== -1);
  await expect(page.locator("#offline-title")).toHaveCount(0);
  await noOverflow(page);
});

test("sign-in stays available at 390×844", async ({ page }) => {
  const errors = await boot(page, { auth: false });
  await swReady(page);
  const href = await page.locator("#loginbtn").getAttribute("href");
  expect(href).toContain("/auth/login");
  const hit = await page.evaluate(() => {
    const box = document.getElementById("loginbtn").getBoundingClientRect();
    const el = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return !!(el && (el.id === "loginbtn" || el.closest("#loginbtn")));
  });
  expect(hit).toBe(true);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test("terms gate still blocks until Accept at 390×844", async ({ page }) => {
  const state = { accepted: false, posts: [] };
  await installApiMock(page);
  await page.route(/afl-tipster-bot\.onrender\.com\/api\/terms/, async (route) => {
    const req = route.request();
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization,content-type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const pathname = new URL(req.url()).pathname;
    let body;
    if (pathname === "/api/terms/accept") {
      state.posts.push(JSON.parse(req.postData() || "{}"));
      state.accepted = true;
      body = { ok: true, version: "2.0", accepted: true };
    } else if (pathname === "/api/terms/status") {
      body = { ok: true, version: "2.0", accepted: state.accepted };
    } else {
      body = { ok: true, version: "2.0", title: "Terms & Conditions", text: "PLACEHOLDER terms." };
    }
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const app = document.getElementById("app");
    return app && !app.hidden;
  });
  await swReady(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  const gate = page.locator("#terms-gate");
  await expect(gate).toBeVisible();
  const accept = page.locator("#tg-accept");
  await expect(accept).toBeDisabled();
  const hit = await page.evaluate(() => {
    const box = document.getElementById("tg-age").getBoundingClientRect();
    const el = document.elementFromPoint(box.left + 8, box.top + box.height / 2);
    return !!(el && (el.id === "tg-age" || (el.closest && el.closest("#terms-gate"))));
  });
  expect(hit).toBe(true);
  await page.locator("#tg-age").check();
  await expect(accept).toBeEnabled();
  await accept.click();
  await expect(gate).toBeHidden();
  expect(state.posts).toEqual([{ version: "2.0", age_confirmed: true }]);
  await expect(page.locator("#nav-ops")).toBeHidden();
});

test.describe("iOS home screen hint", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    hasTouch: true,
    isMobile: true,
  });

  test("shows once, can be dismissed, and does not cover sign-in", async ({ page }) => {
    const errors = await boot(page, { auth: false });
    const hint = page.locator("#pwa-ios");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("Add to Home Screen");
    const hit = await page.evaluate(() => {
      const box = document.getElementById("loginbtn").getBoundingClientRect();
      const el = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return !!(el && (el.id === "loginbtn" || el.closest("#loginbtn")));
    });
    expect(hit).toBe(true);
    await noOverflow(page);
    await page.locator("#pwa-ios-dismiss").click();
    await expect(hint).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("tipdash_a2hs_dismissed"))).toBe("1");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#loginbtn");
    await expect(page.locator("#pwa-ios")).toHaveCount(0);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test("stays hidden when the app is already installed", async ({ page }) => {
    await boot(page, {
      auth: false,
      init: () => {
        Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
      },
    });
    await expect(page.locator("#pwa-ios")).toHaveCount(0);
    const flags = await page.evaluate(() => ({
      phone: window.TBPwa.isIosDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints || 0),
      pad: window.TBPwa.isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5),
      desktop: window.TBPwa.isIosDevice("Mozilla/5.0 (Windows NT 10.0)", "Win32", 0),
      mac: window.TBPwa.isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0),
    }));
    expect(flags).toEqual({ phone: true, pad: true, desktop: false, mac: false });
  });
});

test("update prompt is dismissible at 390×844", async ({ page }) => {
  const errors = await boot(page);
  await expect(page.locator("#pwa-update")).toHaveCount(0);
  await page.evaluate(() => window.TBPwa.noteUpdate(null));
  const bar = page.locator("#pwa-update");
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("A new version of tipdash is ready.");
  await expect(page.locator("#nav-ops")).toBeHidden();
  await noOverflow(page);
  await page.locator("#pwa-update-dismiss").click();
  await expect(bar).toBeHidden();
  await page.evaluate(() => window.TBPwa.noteUpdate(null));
  await expect(bar).toBeHidden();
  expect(errors).toEqual([]);
});
