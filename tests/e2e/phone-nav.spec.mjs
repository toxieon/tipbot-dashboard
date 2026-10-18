import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

let baseUrl;
let server;

test.beforeAll(async () => {
  server = await startMockSite();
  baseUrl = `http://127.0.0.1:${server.address().port}/`;
});

test.afterAll(async () => {
  if (server) server.close();
});

test.use({
  viewport: { width: 390, height: 844 },
  userAgent: IPHONE_UA,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

async function boot(page) {
  await page.emulateMedia({ displayMode: "standalone" });
  await installApiMock(page);
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => {
    const app = document.getElementById("app");
    return app && !app.hidden;
  }, { timeout: 45000 });
}

async function navBox(page) {
  return page.evaluate(() => {
    const tabs = document.querySelector(".apex-tabs");
    if (!tabs) return null;
    const cs = getComputedStyle(tabs);
    const r = tabs.getBoundingClientRect();
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden";
    document.body.appendChild(probe);
    const safe = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
    probe.remove();
    return {
      display: cs.display,
      bottom: r.bottom,
      height: r.height,
      top: r.top,
      innerHeight: window.innerHeight,
      safe,
      parent: tabs.parentElement ? tabs.parentElement.tagName : "",
      inApp: !!(document.getElementById("app") && document.getElementById("app").contains(tabs)),
    };
  });
}

function assertPinned(box) {
  expect(box, "phone bar missing").toBeTruthy();
  expect(box.display).not.toBe("none");
  expect(box.parent).toBe("BODY");
  expect(box.inApp).toBe(false);
  expect(box.height).toBeGreaterThan(40);
  const limit = Math.max(1, box.safe + 1);
  expect(Math.abs(box.bottom - box.innerHeight)).toBeLessThanOrEqual(limit);
}

test("Home and Settings General keep the phone bar on the bottom", async ({ page }) => {
  await boot(page);
  await expect(page.locator("#overview")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.screenshot({ path: "/opt/cursor/artifacts/nav-home.png", fullPage: false });
  const home = await navBox(page);
  expect(home.display).toBe("none");

  await page.locator("#overview .scard").filter({ hasText: "Test" }).click();
  await page.waitForFunction(() => {
    const detail = document.getElementById("detail");
    const tabs = document.querySelector(".apex-tabs");
    return detail && !detail.hidden && tabs && getComputedStyle(tabs).display !== "none";
  });
  await page.locator("#settings-panel .panel-hd").click();
  await page.waitForFunction(() => {
    const body = document.querySelector("#settings-panel .panel-body");
    const general = document.getElementById("stab-general");
    return body && !body.hidden && general && general.classList.contains("active");
  });
  await page.evaluate(() => {
    const body = document.querySelector("#settings-body");
    if (!body) return;
    const pad = document.createElement("div");
    pad.id = "nav-pin-pad";
    pad.style.height = "1600px";
    body.appendChild(pad);
  });
  const max = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - window.innerHeight));
  expect(max).toBeGreaterThan(200);
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(max / 2));
  await page.waitForTimeout(100);
  const mid = await navBox(page);
  assertPinned(mid);
  await page.screenshot({ path: "/opt/cursor/artifacts/nav-settings-mid.png", fullPage: false });

  await page.evaluate(() => {
    const wrap = document.querySelector(".wrap");
    const app = document.getElementById("app");
    if (wrap) {
      wrap.style.transform = "scale(.965)";
      wrap.style.filter = "brightness(.85)";
    }
    if (app) app.style.transform = "translateZ(0)";
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(100);
  const bottom = await navBox(page);
  assertPinned(bottom);
  await page.screenshot({ path: "/opt/cursor/artifacts/nav-settings-bottom.png", fullPage: false });
});
