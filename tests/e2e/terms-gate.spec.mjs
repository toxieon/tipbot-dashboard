import { test, expect } from "@playwright/test";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

async function boot(page, accepted) {
  const state = { accepted, posts: [] };
  await installApiMock(page);
  await page.route(/afl-tipster-bot\.onrender\.com\/api\/terms/, async (route) => {
    const req = route.request();
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" };
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const p = new URL(req.url()).pathname;
    let body;
    if (p === "/api/terms/accept") { state.posts.push(JSON.parse(req.postData() || "{}")); state.accepted = true; body = { ok: true, version: "2.0", accepted: true }; }
    else if (p === "/api/terms/status") body = { ok: true, version: "2.0", accepted: state.accepted };
    else body = { ok: true, version: "2.0", title: "Terms & Conditions", text: "PLACEHOLDER terms.\n\nSecond paragraph." };
    return route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  });
  await page.addInitScript(authInitScript());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const a = document.getElementById("app"); return a && !a.hidden; });
  return state;
}

test("unaccepted user is blocked until Accept; version line shows", async ({ page }) => {
  const state = await boot(page, false);
  const gate = page.locator("#terms-gate");
  await expect(gate).toBeVisible();
  await expect(page.locator("#tg-ver")).toHaveText("Version 2.0");
  await expect(page.locator("#tg-body")).toContainText("PLACEHOLDER terms.");
  expect(await page.evaluate(() => document.getElementById("app").hasAttribute("inert"))).toBe(true);
  const btn = page.locator("#tg-accept");
  await expect(btn).toBeDisabled();
  await page.locator("#tg-age").check();
  await expect(btn).toBeEnabled();
  await page.locator("#tg-age").uncheck();
  await expect(btn).toBeDisabled();
  await page.locator("#tg-age").check();
  await btn.click();
  await expect(gate).toBeHidden();
  expect(state.posts).toEqual([{ version: "2.0", age_confirmed: true }]);
  expect(await page.evaluate(() => document.getElementById("app").hasAttribute("inert"))).toBe(false);
  await expect(page.locator("#terms-ver")).toHaveText("Terms v2.0");
});

test("prompts once: after accepting, a reload/new login does not prompt again", async ({ page }) => {
  const state = await boot(page, false);
  await page.locator("#tg-age").check();
  await page.locator("#tg-accept").click();
  await expect(page.locator("#terms-gate")).toBeHidden();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => { const v = document.getElementById("terms-ver"); return v && !v.hidden; });
  expect(await page.locator("#terms-gate").count()).toBe(0);
  expect(state.posts.length).toBe(1);
});

test("accepted user sees no gate", async ({ page }) => {
  await boot(page, true);
  await page.waitForFunction(() => { const v = document.getElementById("terms-ver"); return v && !v.hidden; });
  expect(await page.locator("#terms-gate").count()).toBe(0);
});

test("legal footer links and cookie banner stays off", async ({ page }) => {
  await boot(page, true);
  for (const href of ["/terms/", "/privacy/", "/refund/", "/renewal/", "/cookies/", "/accessibility/"])
    expect(await page.locator(`footer.legal-foot a[href="${href}"]`).count()).toBe(1);
  expect(await page.locator("#cookie-banner").count()).toBe(0);
  expect(await page.evaluate(() => window.TBCookieConsent && window.TBCookieConsent.enabled())).toBe(false);
  await page.evaluate(() => window.TBCookieConsent.show());
  await expect(page.locator("#cookie-banner")).toBeVisible();
});

test("legal page loads its text from TipBot and renders it safely", async ({ page }) => {
  await page.route(/afl-tipster-bot\.onrender\.com\/api\/legal\//, (route) => route.fulfill({
    status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ ok: true, slug: "privacy", title: "Privacy Policy", version: "0.2",
      text: "> **DRAFT**\n\n## 1. What we collect\n\n- Discord ID\n- IP address\n\nSee [Terms](/terms/) <script>x</script> [bad](javascript:alert(1))" }) }));
  await page.goto(baseUrl + "privacy/index.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#legal-ver")).toHaveText("Version 0.2");
  await expect(page.locator("#legal-body h3")).toHaveText("1. What we collect");
  await expect(page.locator("#legal-body li")).toHaveCount(2);
  expect(await page.locator('#legal-body a[href="/terms/"]').count()).toBe(1);
  expect(await page.locator("#legal-body script").count()).toBe(0);
  expect(await page.locator('#legal-body a[href^="javascript"]').count()).toBe(0);
});

test("every image has alt text and icon buttons have labels", async ({ page }) => {
  await boot(page, true);
  const bad = await page.evaluate(() => [
    ...[...document.querySelectorAll("img")].filter((i) => !i.getAttribute("alt")).map((i) => "img " + i.src),
    ...[...document.querySelectorAll("button")].filter((b) => !b.textContent.trim().replace(/[^A-Za-z0-9]/g, "") && !b.getAttribute("aria-label") && !b.getAttribute("title")).map((b) => "button " + b.outerHTML.slice(0, 80)),
  ]);
  expect(bad).toEqual([]);
});
