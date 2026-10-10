#!/usr/bin/env node
/** CI leak guard: public build scan + banned terms + API base assertion. */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { build, scanTree } from "./build-public.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const apiLine = 'const API="https://afl-tipster-bot.onrender.com";';
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!html.includes(apiLine)) {
  process.stderr.write("index.html must keep " + apiLine + "\n");
  process.exit(1);
}

const result = build({ root, dist });
const hits = scanTree(result.dist);
if (hits.length) {
  process.stderr.write("public build scan failed:\n" + hits.map((h) => h.rel + " " + h.kind + " " + h.match).join("\n") + "\n");
  process.exit(1);
}

const grep = spawnSync("grep", ["-riE", "forward|mirror|master|consensus", dist], { encoding: "utf8" });
if (grep.status === 0) {
  const lines = (grep.stdout || "").split("\n").filter(Boolean);
  for (const line of lines) {
    if (!/\bforwards\b/.test(line)) {
      process.stderr.write("unexpected secret match (need animation forwards only): " + line + "\n");
      process.exit(1);
    }
    if (/forwarded|forwarding|\bmaster\b|\bmirror\b|\bconsensus\b/i.test(line)) {
      process.stderr.write("banned term in public dist: " + line + "\n");
      process.exit(1);
    }
  }
}

const extra = spawnSync(
  "grep",
  ["-riE", "owner-tools|/api/ops|custom-games|\\bops:", dist],
  { encoding: "utf8" }
);
if (extra.status === 0 && (extra.stdout || "").trim()) {
  process.stderr.write("banned ops/owner strings in public dist:\n" + extra.stdout + "\n");
  process.exit(1);
}

const forwardNotS = spawnSync("grep", ["-riE", "forward[^s]", dist], { encoding: "utf8" });
if (forwardNotS.status === 0) {
  const lines = (forwardNotS.stdout || "").split("\n").filter(Boolean);
  for (const line of lines) {
    if (/\bforwards\b/.test(line) && !/forward[^s]/i.test(line.replace(/\bforwards\b/g, ""))) continue;
    process.stderr.write("forward[^s] leak: " + line + "\n");
    process.exit(1);
  }
}

const guildId = process.env.TIPDASH_MASTER_GUILD_ID || "";
if (guildId) {
  const inDist = spawnSync("grep", ["-r", guildId, dist], { encoding: "utf8" });
  if ((inDist.stdout || "").trim()) {
    process.stderr.write("master guild id must not appear in public dist\n" + inDist.stdout + "\n");
    process.exit(1);
  }
  if (html.includes(guildId)) {
    process.stderr.write("master guild id must not appear in index.html\n");
    process.exit(1);
  }
}

process.stdout.write("ci-public-guard ok (" + result.count + " files)\n");
