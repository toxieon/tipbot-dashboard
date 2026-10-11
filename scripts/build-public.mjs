#!/usr/bin/env node
// Copy an allowlisted public site into dist/ and refuse secret terms.
// Secret scan stays forward|mirror|master|consensus. A hit is kept only when
// it is one of the explicit exceptions below (CSS animation-fill "forwards",
// or the ordinary word "Straightforward"). Do not widen the secret expression.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const ALLOW = [
  "index.html",
  "404.html",
  "CNAME",
  "VERSION",
  "PUBLIC_CHANGELOG.md",
  ".nojekyll",
  "manifest.webmanifest",
  "bookies.json",
  "players.json",
  "assets",
  "welcome",
  "pricing",
  "t",
  "live",
  "compare",
  "brownlow",
];

// These stay in the private repo and must not be copied, even from assets/.
export const ASSET_DENY = new Set([
  "assets/consensus-ui.js",
  "assets/master-access.js",
  "assets/slip-ui.js",
  "assets/admin.js",
  "assets/ext.js",
  "assets/owner-tools.js",
]);

// Phrases that must not appear in the public copy. The secret-word scan above
// is separate and must not be widened.
export const CONSOLE_RE = /console\.(?:log|debug|info|warn|error|trace)\s*\(/g;
export const OWNER_PHRASES = [
  "Debug menu",
  "God mode",
  "God re-grade",
  "Paste tip sheet",
  "/api/debug",
  "/api/god-",
  "/api/queue-status",
  "/api/leave-server",
  "/api/owner-invite",
  "/api/owner/signup",
  "/api/owner/follower-map",
  "/api/owner/import-tips",
  "/api/owner/tipsheet",
  "Odds API markets",
  "Australia-only sign-ups",
];

export const DENY_FILES = new Set([
  "CHANGELOG.md",
  "REMAINING.md",
  "VERSIONING.md",
]);

export const DENY_DIRS = new Set(["master", "tests", "design", "docs", "GPT", "logo-lab", "labs"]);

export const SECRET_RE = /forward|mirror|master|consensus/gi;

// Explicit exceptions. Each predicate receives the whole file and the index
// where SECRET_RE matched. Returning true keeps that one hit.
export const SECRET_ALLOW = [
  {
    name: "css-animation-fill-forwards",
    // The CSS animation-fill-mode keyword, only when it sits in an animation
    // declaration or immediately after an easing name.
    test(text, index) {
      if (wordAt(text, index).toLowerCase() !== "forwards") return false;
      const before = text.slice(Math.max(0, index - 160), index);
      return /(?:animation(?:-fill-mode)?\s*:[^;{}\n]*|(?:ease(?:-in-out|-out|-in)?)\s+)$/i.test(before);
    },
  },
  {
    name: "straightforward",
    test(text, index) {
      return wordAt(text, index).toLowerCase() === "straightforward";
    },
  },
];

export const PRICE_LINK_RE = /href\s*=\s*["']\/pricing\/["']/gi;
export const AUD_PRICE_RE = /A\$[0-9]/g;

// Exempt from the pricing-link and A$ checks only. They still take the secret scan.
export const PRICE_EXEMPT = new Set([
  "pricing/index.html",
  "assets/site/checkout.js",
]);

// Vendored third-party bundles (e.g. MIT Three.js) — skip secret/console scans.
export const SCAN_EXEMPT = new Set(["assets/vendor/three.module.js"]);

export function toPosix(rel) {
  return String(rel).split(path.sep).join("/");
}

export function wordAt(text, index) {
  let a = index;
  let b = index;
  while (a > 0 && /[A-Za-z]/.test(text[a - 1])) a--;
  while (b < text.length && /[A-Za-z]/.test(text[b])) b++;
  return text.slice(a, b);
}

export function isDeniedRel(rel) {
  const posix = toPosix(rel);
  const parts = posix.split("/");
  if (parts.some((p) => DENY_DIRS.has(p))) return true;
  if (DENY_FILES.has(path.posix.basename(posix))) return true;
  if (ASSET_DENY.has(posix)) return true;
  if (posix.endsWith(".map")) return true;
  if (posix.endsWith(".md") && path.posix.basename(posix) !== "PUBLIC_CHANGELOG.md") return true;
  return false;
}

function walk(dir, srcRoot, out) {
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    const rel = path.relative(srcRoot, abs);
    if (isDeniedRel(rel)) continue;
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, srcRoot, out);
    else if (st.isFile()) out.push(abs);
  }
}

export function listShipped(srcRoot) {
  const files = [];
  for (const item of ALLOW) {
    const abs = path.join(srcRoot, item);
    if (!fs.existsSync(abs)) throw new Error("allowlist missing: " + item);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, srcRoot, files);
    else if (isDeniedRel(item)) throw new Error("allowlist entry is denied: " + item);
    else files.push(abs);
  }
  return files;
}

function secretAllowed(text, index) {
  return SECRET_ALLOW.some((rule) => rule.test(text, index));
}

function isBinaryShippedAsset(posix) {
  return /\.(png|webp|jpe?g|gif|ico|woff2?)$/i.test(posix);
}

export function scanText(rel, text) {
  const problems = [];
  const posix = toPosix(rel);
  if (SCAN_EXEMPT.has(posix) || isBinaryShippedAsset(posix)) return problems;
  const secret = new RegExp(SECRET_RE.source, "gi");
  let m;
  while ((m = secret.exec(text))) {
    if (!secretAllowed(text, m.index)) {
      const line = text.slice(0, m.index).split("\n").length;
      problems.push({ rel: posix, kind: "secret", match: m[0], line });
    }
  }
  if (!PRICE_EXEMPT.has(posix)) {
    const link = new RegExp(PRICE_LINK_RE.source, "gi");
    while ((m = link.exec(text))) {
      const line = text.slice(0, m.index).split("\n").length;
      problems.push({ rel: posix, kind: "pricing-link", match: m[0], line });
    }
    const aud = new RegExp(AUD_PRICE_RE.source, "g");
    while ((m = aud.exec(text))) {
      const line = text.slice(0, m.index).split("\n").length;
      problems.push({ rel: posix, kind: "aud-price", match: m[0], line });
    }
  }
  const cons = new RegExp(CONSOLE_RE.source, "g");
  while ((m = cons.exec(text))) {
    const line = text.slice(0, m.index).split("\n").length;
    problems.push({ rel: posix, kind: "console", match: m[0], line });
  }
  for (const phrase of OWNER_PHRASES) {
    let at = text.indexOf(phrase);
    while (at !== -1) {
      const line = text.slice(0, at).split("\n").length;
      problems.push({ rel: posix, kind: "owner-tool", match: phrase, line });
      at = text.indexOf(phrase, at + phrase.length);
    }
  }
  return problems;
}

export function scanTree(dir) {
  const problems = [];
  function rec(d) {
    for (const name of fs.readdirSync(d)) {
      const abs = path.join(d, name);
      const st = fs.statSync(abs);
      if (st.isDirectory()) rec(abs);
      else if (st.isFile()) {
        const rel = path.relative(dir, abs);
        const text = fs.readFileSync(abs);
        problems.push(...scanText(rel, text.toString("utf8")));
      }
    }
  }
  if (fs.existsSync(dir)) rec(dir);
  return problems;
}

export function formatProblems(problems) {
  return problems.map((p) => p.rel + ":" + p.line + ": " + p.kind + ": " + p.match).join("\n");
}

export function build(opts = {}) {
  const srcRoot = opts.root || root;
  const dist = opts.dist || path.join(srcRoot, "dist");
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
  const files = listShipped(srcRoot);
  for (const abs of files) {
    const rel = path.relative(srcRoot, abs);
    const dest = path.join(dist, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs, dest);
  }
  const problems = scanTree(dist);
  if (problems.length) {
    const err = new Error("public build refused\n" + formatProblems(problems));
    err.problems = problems;
    throw err;
  }
  return { dist, count: files.length, files: files.map((f) => toPosix(path.relative(srcRoot, f))) };
}

function main() {
  const scanAt = process.argv.indexOf("--scan");
  if (scanAt !== -1) {
    const dir = process.argv[scanAt + 1];
    if (!dir) {
      console.error("usage: node scripts/build-public.mjs --scan <dir>");
      process.exit(2);
    }
    const problems = scanTree(path.resolve(dir));
    if (problems.length) {
      console.error(formatProblems(problems));
      process.exit(1);
    }
    process.exit(0);
  }
  try {
    const result = build();
    console.log("public build ok (" + result.count + " files) -> " + result.dist);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
