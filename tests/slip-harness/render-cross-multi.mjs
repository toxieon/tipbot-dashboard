import { chromium } from "playwright";
const ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 568, height: 700 } });
await p.goto("file://"+ROOT+"/tests/slip-harness/cross-multi.html");
await p.screenshot({ path: ROOT+"/tests/fixtures/slips/synthetic/s09-cross-game-multi.png", fullPage: true });
await b.close();
