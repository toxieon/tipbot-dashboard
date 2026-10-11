#!/usr/bin/env node
/** Stylised 2D stadium posters (matches afl-stadiums colour variants; dev helper). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createCanvas } from "canvas";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "assets", "stadiums");
const venues = createRequire(import.meta.url)("../assets/afl-venues.js");
const stadiums = createRequire(import.meta.url)("../assets/afl-stadiums.js");

const W = 780;
const H = 440;

function hex(c) {
  const n = parseInt(c.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function draw(key) {
  const v = stadiums.VARIANTS[key];
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#07090f");
  g.addColorStop(0.55, "#0c1018");
  g.addColorStop(1, "#111820");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const cx = W * 0.5;
  const cy = H * 0.58;
  const rx = 210 * v.rx;
  const rz = 120 * v.rz;
  const turf = hex(v.turf);
  const stand = hex(v.stand);
  const accent = hex(v.accent);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, rz / rx);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, rx, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${turf.r},${turf.g},${turf.b})`;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(200,208,220,0.55)";
  ctx.stroke();
  ctx.restore();
  const segs = 28;
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const h = 28 + v.bowl * 42 + Math.sin(am * 2) * 12 * v.asym;
    const orx = rx * (1.12 + v.bowl * 0.08);
    const orz = rz * (1.12 + v.bowl * 0.08);
    const x0 = cx + Math.cos(a0) * orx;
    const y0 = cy + Math.sin(a0) * orz;
    const x1 = cx + Math.cos(a1) * orx;
    const y1 = cy + Math.sin(a1) * orz;
    const xm = cx + Math.cos(am) * (orx - 18);
    const ym = cy + Math.sin(am) * (orz - 10);
    const col = i % 5 === 0 ? accent : stand;
    ctx.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
    ctx.beginPath();
    ctx.moveTo(x0, y0 - h);
    ctx.lineTo(x1, y1 - h);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x0, y0);
    ctx.closePath();
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(xm, ym - h - 4);
    ctx.lineTo(xm, ym - h - 28);
    ctx.strokeStyle = `rgba(${accent.r},${accent.g},${accent.b},0.85)`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  const glow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 320);
  glow.addColorStop(0, `rgba(${accent.r},${accent.g},${accent.b},0.12)`);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  return canvas.toBuffer("image/png");
}

fs.mkdirSync(outDir, { recursive: true });
for (const key of Object.keys(venues.VENUES)) {
  fs.writeFileSync(path.join(outDir, key + ".png"), draw(key));
  process.stdout.write("wrote " + key + ".png\n");
}
