// Predictor Call (0.73.2) at 390 px and desktop, Apex, mocked API: Settings ->
// Command access shows the mod when the server has a Horse Predictor, the owner
// enables it, selects a source and dest channel, and saves. Hidden with no
// predictor. Screenshots: SHOTS=/dir writes source-agree-*.png.
import { test, expect } from "@playwright/test";
import path from "node:path";
import { startMockSite, authInitScript, installApiMock } from "./mock-server.mjs";

const SHOTS = process.env.SHOTS || "";

let baseUrl, server;
test.beforeAll(async () => { server = await startMockSite(); baseUrl = `http://127.0.0.1:${server.address().port}/`; });
test.afterAll(async () => { if (server) server.close(); });

function view(extra = {}) {
  return {
    ok: true,
    has_predictor: true,
    can_edit: true,
    enabled: false,
    sources: [],
    channel_id: null,
    agree_channel_id: "9001",
    picker: [
      { id: "s1", tipster_name: "Feed A", guild_name: "North", enabled: true },
      { id: "s2", tipster_name: "Feed B", guild_name: "South", enabled: true },
    ],
    channels: [
      { id: "9002", name: "source-agree" },
      { id: "9003", name: "general" },
    ],
    close_call_pp: 5,
    ...extra,
  };
}

async function open(page, first, onPost, viewport) {
  if (viewport) await page.setViewportSize(viewport);
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await installApiMock(page);
  const cors = (route) => ({ "Access-Control-Allow-Origin": route.request().headers().origin || "*", "Access-Control-Allow-Credentials": "true" });
  await page.route("**/api/server/predictor-tracker**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify({ ok: true, models: [], tracked: [], totals: {}, can_edit: true }) }));
  await page.route("**/api/server/predictor-agree**", async (r) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: { ...cors(r), "Access-Control-Allow-Headers": "authorization,content-type", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" } });
    if (r.request().method() === "POST") {
      const body = JSON.parse(r.request().postData() || "{}");
      onPost && onPost(body);
      return r.fulfill({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify({ ...view({ enabled: !!body.enabled, sources: body.sources || [], channel_id: body.channel_id || null }), message: "Predictor Call saved." }) });
    }
    return r.fulfill({ status: 200, contentType: "application/json", headers: cors(r), body: JSON.stringify(first) });
  });
  await page.addInitScript(authInitScript());
  await page.addInitScript(() => { try { localStorage.setItem("tipbot_theme", "apex"); } catch (e) {} });
  await page.goto(baseUrl + "#/s/1", { waitUntil: "domcontentloaded" });
  const hd = page.locator("#settings-panel .panel-hd");
  await hd.waitFor({ timeout: 30000 });
  if ((await hd.getAttribute("aria-expanded")) !== "true") await hd.click();
  await page.locator("#stab-perms").click();
  return errors;
}
async function shot(page, name) {
  if (!SHOTS) return;
  const el = page.locator("#sam");
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await el.screenshot({ path: path.join(SHOTS, "predictor-call-" + name + ".png") });
  await page.screenshot({ path: path.join(SHOTS, "predictor-call-" + name + "-page.png") });
}

test.use({ viewport: { width: 390, height: 844 } });

test("owner: enable, select a source and channel, save", async ({ page }) => {
  let posted = null;
  const errors = await open(page, view(), (b) => { posted = b; });
  const box = page.locator("#sam");
  await expect(box).toBeVisible();
  await expect(box.locator("#sam-on")).toHaveAttribute("aria-checked", "false");
  await expect(box.locator("[data-src]")).toHaveCount(0);
  await shot(page, "390-off");
  await box.locator("#sam-on").click();
  await expect(box.locator("#sam-on")).toHaveAttribute("aria-checked", "true");
  await expect(box.locator("[data-src]")).toHaveCount(2);
  await box.locator('[data-src="s1"]').check();
  await box.locator("#sam-ch").selectOption("9002");
  await expect(box.locator("#sam-save")).toBeEnabled();
  await shot(page, "390-on");
  await box.locator("#sam-save").click();
  await expect(box.locator("#sam-msg")).toHaveText("✓ saved");
  expect(posted).toEqual({ guild_id: "1", enabled: true, sources: ["s1"], channel_id: "9002" });
  expect(errors).toEqual([]);
});

test("no Horse Predictor: section stays hidden", async ({ page }) => {
  await open(page, view({ has_predictor: false }));
  await expect(page.locator("#sam")).toHaveCount(0);
});

test("desktop Apex settings", async ({ page }) => {
  const errors = await open(page, view({ enabled: true, sources: ["s1"], channel_id: "9002" }), null, { width: 1280, height: 800 });
  const box = page.locator("#sam");
  await expect(box).toBeVisible();
  await expect(box.locator("#sam-on")).toHaveAttribute("aria-checked", "true");
  await expect(box.locator('[data-src="s1"]')).toBeChecked();
  await shot(page, "desktop");
  expect(errors).toEqual([]);
});
