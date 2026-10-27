#!/usr/bin/env node
/**
 * Live connection diagnostic: does the dashboard reach TipBot, and does a real
 * session get through /api/me and /api/servers?
 *
 *   node scripts/live-diagnostic.mjs                         # steps 1-3, no session
 *   TIPDASH_SESSION_TOKEN=... node scripts/live-diagnostic.mjs   # all steps
 *
 * Steps 1-3 need no session and only read public endpoints. Steps 4-6 need a real
 * session token (the `tipbot_token` the dashboard keeps after Discord login), given
 * only through TIPDASH_SESSION_TOKEN. The token is never printed or written.
 * Exit codes: 0 every step passed, 1 a step failed, 2 passed so far but the
 * session steps did not run (no token).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_HOST = "afl-tipster-bot.onrender.com";
const CDN = "cdn.discordapp.com";

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail });
  console.log(`${status.padEnd(7)} ${name}${detail ? " - " + detail : ""}`);
}

export function apiBaseFrom(html) {
  const m = String(html).match(/const API="([^"]*)";/);
  return m ? m[1] : null;
}

export function isTipBotBase(base) {
  try {
    const u = new URL(base);
    return u.protocol === "https:" && u.hostname === EXPECTED_HOST && (u.pathname === "/" || u.pathname === "");
  } catch {
    return false;
  }
}

/** Every image URL on a servers payload must be https cdn.discordapp.com. */
export function badImageUrls(rows) {
  const bad = [];
  for (const row of rows || []) {
    for (const key of ["icon_url", "owner_avatar_url"]) {
      if (row && row[key] != null) {
        try {
          const u = new URL(String(row[key]));
          if (u.protocol !== "https:" || u.hostname !== CDN) bad.push(key);
        } catch {
          bad.push(key);
        }
      }
    }
  }
  return bad;
}

async function get(url, headers = {}) {
  const res = await fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(30000) });
  let body = null;
  try { body = await res.json(); } catch { body = null; }
  return { status: res.status, body };
}

async function main() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const base = apiBaseFrom(html);
  if (base && isTipBotBase(base)) record("1 api base is TipBot", "PASS", base);
  else {
    record("1 api base is TipBot", "FAIL", `index.html API base is ${JSON.stringify(base)}, expected https://${EXPECTED_HOST}`);
    return finish();
  }

  try {
    const h = await get(base + "/healthz");
    if (h.status === 200) record("2 TipBot answers /healthz", "PASS", `version ${h.body && h.body.version ? h.body.version : "unknown"}`);
    else record("2 TipBot answers /healthz", "FAIL", `HTTP ${h.status}`);
  } catch (e) {
    record("2 TipBot answers /healthz", "FAIL", String(e && e.message || e));
  }

  try {
    const s = await get(base + "/api/servers");
    if (s.status === 401) record("3 /api/servers is live and asks for a session", "PASS", "HTTP 401 without a token");
    else record("3 /api/servers is live and asks for a session", "FAIL", `HTTP ${s.status} without a token (expected 401)`);
  } catch (e) {
    record("3 /api/servers is live and asks for a session", "FAIL", String(e && e.message || e));
  }

  const token = process.env.TIPDASH_SESSION_TOKEN || "";
  if (!token) {
    record("4 /api/me with a real session", "SKIPPED", "no TIPDASH_SESSION_TOKEN");
    record("5 /api/servers with a real session", "SKIPPED", "no TIPDASH_SESSION_TOKEN");
    record("6 server picture fields use cdn.discordapp.com only", "SKIPPED", "no TIPDASH_SESSION_TOKEN");
    return finish();
  }
  const auth = { Authorization: "Bearer " + token };
  try {
    const me = await get(base + "/api/me", auth);
    if (me.status === 200 && me.body && (me.body.user_id || me.body.role)) record("4 /api/me with a real session", "PASS", `role ${me.body.role || "?"}`);
    else record("4 /api/me with a real session", "FAIL", `HTTP ${me.status}`);
  } catch (e) {
    record("4 /api/me with a real session", "FAIL", String(e && e.message || e));
  }
  try {
    const sv = await get(base + "/api/servers", auth);
    const rows = sv.body && Array.isArray(sv.body.servers) ? sv.body.servers : null;
    if (sv.status === 200 && rows) {
      const withIcon = rows.filter((r) => r.icon_url).length;
      const withOwner = rows.filter((r) => r.owner_avatar_url).length;
      record("5 /api/servers with a real session", "PASS", `${rows.length} servers, ${withIcon} with icon_url, ${withOwner} with owner_avatar_url (owner avatars fill in after the first call)`);
      const bad = badImageUrls(rows);
      if (bad.length) record("6 server picture fields use cdn.discordapp.com only", "FAIL", `${bad.length} bad value(s)`);
      else record("6 server picture fields use cdn.discordapp.com only", "PASS", "");
    } else {
      record("5 /api/servers with a real session", "FAIL", `HTTP ${sv.status}`);
      record("6 server picture fields use cdn.discordapp.com only", "SKIPPED", "no servers payload");
    }
  } catch (e) {
    record("5 /api/servers with a real session", "FAIL", String(e && e.message || e));
  }
  return finish();
}

function finish() {
  const failed = results.some((r) => r.status === "FAIL");
  const skipped = results.some((r) => r.status === "SKIPPED");
  console.log(failed ? "RESULT: FAILED" : skipped ? "RESULT: INCOMPLETE - session steps did not run" : "RESULT: ALL PASSED");
  process.exitCode = failed ? 1 : skipped ? 2 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
