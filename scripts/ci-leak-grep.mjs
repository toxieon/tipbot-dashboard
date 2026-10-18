#!/usr/bin/env node
// Scan a built tree for the public guard's terms and for PRIVATE_GUILD_IDS.
// Report locations only. Never print a secret value or a matched line.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanTree } from "./build-public.mjs";
import { parseTerms, findHits } from "./ci-public-guard.mjs";

const TEXT_EXT = /\.(html|js|mjs|css|json|svg|txt|md|webmanifest)$/i;

export function parseIdList(raw) {
  return String(raw || "")
    .split(/[\s,;]+/)
    .map((part) => part.replace(/^['"[\]()]+|['"[\]()]+$/g, "").trim())
    .filter(Boolean);
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (st.isFile() && TEXT_EXT.test(name)) out.push(abs);
  }
  return out;
}

/** Fixed-string search. Hits name the id by index, never by value. */
export function grepIds(dir, ids) {
  const found = [];
  if (!ids.length) return found;
  for (const file of walk(dir)) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      ids.forEach((id, k) => {
        if (line.includes(id)) {
          found.push(path.relative(dir, file) + ":" + (i + 1) + " (private id #" + (k + 1) + ")");
        }
      });
    });
  }
  return found;
}

export function scanBuilt(dir, env = process.env) {
  const guardHits = scanTree(dir).map((p) => p.rel + ":" + p.line + ": " + p.kind);
  const scanIds = Object.keys(env)
    .filter((k) => /^TIPDASH_SCAN_ID_\d+$/.test(k))
    .map((k) => String(env[k] || "").trim())
    .filter(Boolean)
    .map((id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const patterns = parseTerms(env.TIPDASH_SCAN_TERMS).concat(scanIds);
  const termHits = patterns.length ? findHits(walk(dir), patterns) : [];
  const ids = parseIdList(env.PRIVATE_GUILD_IDS);
  const idHits = grepIds(dir, ids);
  return { guardHits, termHits, idHits, idCount: ids.length };
}

function main() {
  const dir = path.resolve(process.argv[2] || "dist");
  if (!fs.existsSync(dir)) {
    process.stderr.write("leak grep: built output missing\n");
    process.exit(1);
  }
  const result = scanBuilt(dir);
  const hits = result.guardHits.concat(result.termHits, result.idHits);
  if (hits.length) {
    process.stderr.write("leak grep failed:\n" + hits.join("\n") + "\n");
    process.exit(1);
  }
  if (!result.idCount) {
    process.stdout.write("::notice::private id scan skipped (PRIVATE_GUILD_IDS not set)\n");
  }
  process.stdout.write("leak grep ok\n");
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
