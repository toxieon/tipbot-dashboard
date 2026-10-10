#!/usr/bin/env node
/** CI guard: public build scan, private term list (from CI secrets) and API base assertion. */
import fs from "node:fs";
import path from "node:path";
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
  process.stderr.write("public build scan failed:\n" + hits.map((h) => h.rel + " " + h.kind).join("\n") + "\n");
  process.exit(1);
}

/** Terms: newline or comma separated. Plain terms match as whole words (case-insensitive);
 *  a term starting with "re:" is used as a regular expression. */
export function parseTerms(raw) {
  return String(raw || "")
    .split(/[\n,]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      if (t.startsWith("re:")) return new RegExp(t.slice(3), "i");
      const esc = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp("(^|[^A-Za-z0-9_])" + esc + "(?![A-Za-z0-9_])", "i");
    });
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(html|js|mjs|css|json|svg|txt|md|webmanifest)$/i.test(name)) out.push(p);
  }
  return out;
}

export function findHits(files, patterns) {
  const found = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      patterns.forEach((re, k) => {
        if (re.test(line)) found.push(path.relative(root, file) + ":" + (i + 1) + " (term #" + (k + 1) + ")");
      });
    });
  }
  return found;
}

const ids = Object.keys(process.env)
  .filter((k) => /^TIPDASH_SCAN_ID_\d+$/.test(k))
  .map((k) => String(process.env[k] || "").trim())
  .filter(Boolean)
  .map((id) => new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
const terms = parseTerms(process.env.TIPDASH_SCAN_TERMS);
const patterns = terms.concat(ids);

if (!patterns.length) {
  // Secrets are absent on fork PRs: pass, but say so.
  process.stdout.write("::notice::private scan skipped (TIPDASH_SCAN_TERMS / TIPDASH_SCAN_ID_* not set)\n");
} else {
  const files = walk(result.dist);
  const leaks = findHits(files, patterns);
  if (leaks.length) {
    // Never echo the matched text: the list itself is private.
    process.stderr.write("private scan failed:\n" + leaks.join("\n") + "\n");
    process.exit(1);
  }
  process.stdout.write("private scan ok (" + patterns.length + " patterns)\n");
}

process.stdout.write("ci-public-guard ok (" + result.count + " files)\n");
