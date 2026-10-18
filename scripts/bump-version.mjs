#!/usr/bin/env node
// Stamp the release version into a built tree. Source pages keep PLACEHOLDER.
// The main-branch workflow runs this before the public build and passes the
// printed version in. The build then writes that version into the built files only.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const PLACEHOLDER = "__TD_VERSION__";

const TEXT_EXT = new Set([
  ".html",
  ".js",
  ".mjs",
  ".css",
  ".json",
  ".svg",
  ".txt",
  ".md",
  ".webmanifest",
]);

export function readBaseVersion(dir = root) {
  return fs.readFileSync(path.join(dir, "VERSION"), "utf8").trim();
}

export function nextPatch(version) {
  const m = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error("VERSION must be x.y.z");
  return m[1] + "." + m[2] + "." + String(Number(m[3]) + 1);
}

export function shortSha(sha) {
  const match = String(sha || "").trim().toLowerCase().match(/[0-9a-f]{7,40}/);
  return match ? match[0].slice(0, 7) : "";
}

/** VERSION plus a short sha when one is available, otherwise the next patch. */
export function releaseVersion(base, sha) {
  const version = String(base || "").trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("VERSION must be x.y.z");
  const short = shortSha(sha);
  if (short) return version + "-" + short;
  return nextPatch(version);
}

export function resolveSha(env = process.env) {
  if (env.GITHUB_SHA) return String(env.GITHUB_SHA);
  try {
    return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

export function stampText(text, version) {
  return String(text).split(PLACEHOLDER).join(version);
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === ".git") continue;
    const abs = path.join(dir, name);
    const st = fs.statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (st.isFile() && TEXT_EXT.has(path.extname(name).toLowerCase())) out.push(abs);
  }
  return out;
}

/** Replace the placeholder in text files under dir and write VERSION. */
export function stampTree(dir, version) {
  const release = String(version || "").trim();
  if (!release) throw new Error("release version is empty");
  if (!fs.existsSync(dir)) throw new Error("built output missing: " + dir);
  let files = 0;
  for (const abs of walk(dir)) {
    const before = fs.readFileSync(abs, "utf8");
    if (!before.includes(PLACEHOLDER)) continue;
    fs.writeFileSync(abs, stampText(before, release));
    files += 1;
  }
  fs.writeFileSync(path.join(dir, "VERSION"), release + "\n");
  return { dir, version: release, files };
}

function main() {
  const argv = process.argv.slice(2);
  const base = readBaseVersion();
  const version = releaseVersion(base, resolveSha());
  if (argv.includes("--print")) {
    process.stdout.write(version + "\n");
    return;
  }
  if (argv.includes("--export")) {
    process.stdout.write("TIPDASH_RELEASE_VERSION=" + version + "\n");
    return;
  }
  const at = argv.indexOf("--dist");
  const dist = path.resolve(at === -1 ? path.join(root, "dist") : argv[at + 1] || "");
  const result = stampTree(dist, version);
  process.stdout.write("stamped " + result.version + " (" + result.files + " files)\n");
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
