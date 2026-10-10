#!/usr/bin/env node
/** Render stadium poster PNGs via headless Chrome + procedural Three.js scenes. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "stadiums");
const venues = createRequire(import.meta.url)("../assets/afl-venues.js");
const shell = path.join(__dirname, "stadium-poster.html");

function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let file = req.url === "/" ? "/scripts/stadium-poster.html" : req.url;
      const fp = path.join(root, file.replace(/^\//, ""));
      try {
        const data = fs.readFileSync(fp);
        const ext = path.extname(fp);
        const types = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".png": "image/png",
          ".webp": "image/webp",
        };
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function chromeBin() {
  for (const c of ["google-chrome", "chromium", "chromium-browser"]) {
    const r = spawnSync("which", [c], { encoding: "utf8" });
    if (r.status === 0) return r.stdout.trim();
  }
  throw new Error("Chrome not found for poster render");
}

async function shot(server, key, chrome) {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/scripts/stadium-poster.html?key=${encodeURIComponent(key)}`;
  const out = path.join(outDir, key + ".png");
  const profile = path.join("/tmp", "chrome-poster-" + key);
  fs.mkdirSync(profile, { recursive: true });
  const wait = spawnSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "--user-data-dir=" + profile,
      "--window-size=780,440",
      `--screenshot=${out}`,
      "--virtual-time-budget=8000",
      url,
    ],
    { encoding: "utf8", timeout: 25000 }
  );
  if (wait.status !== 0) {
    throw new Error("chrome failed for " + key + ": " + (wait.stderr || wait.stdout));
  }
}

fs.mkdirSync(outDir, { recursive: true });
const server = await startServer();
const chrome = chromeBin();
for (const key of Object.keys(venues.VENUES)) {
  await shot(server, key, chrome);
  process.stdout.write("wrote " + key + ".png\n");
}
server.close();
