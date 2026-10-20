#!/usr/bin/env node
// Theme token sheet: parses the theme token blocks out of index.html,
// live/index.html, compare/index.html and assets/theme-apex.css, then writes
//   labs/tokens/index.html   a static, self-contained sheet for design handoffs
//   labs/tokens/tokens.json  the same data for other tools
// labs/ is not in the public build allowlist, so neither file ships.
// Node built-ins only. Read-only on every source file.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SURFACES = {
  app: "index.html",
  live: "live/index.html",
  compare: "compare/index.html",
};
export const APEX_CSS = "assets/theme-apex.css";

// Theme/variant ids, in display order.
export const THEMES = ["navy", "day", "ochre", "apex", "apex-light", "apex-oled", "apex-mono", "apex-ochre", "apex-light-legacy"];
export const THEME_LABELS = {
  navy: "Navy (default)",
  day: "Day",
  ochre: "Ochre",
  apex: "Apex",
  "apex-light": "Apex · light",
  "apex-oled": "Apex · OLED",
  "apex-mono": "Apex · mono",
  "apex-ochre": "Apex · ochre",
  "apex-light-legacy": "Apex · light (data-apex-light=1)",
};

// ---------- CSS parsing ----------

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Top-level rules only; @media / @supports / @font-face bodies are skipped. */
export function topLevelRules(css) {
  css = stripComments(css);
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const selector = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    // A selector that follows other text on the same chunk (e.g. after a `;`) keeps only its last statement.
    const sel = selector.split(/[;}]/).pop().trim();
    if (!sel.startsWith("@")) rules.push({ selector: sel, body });
    i = j;
  }
  return rules;
}

/** `--name:value` declarations directly in a rule body (nested blocks ignored). */
export function customProps(body) {
  const flat = body.replace(/\{[^{}]*\}/g, "");
  const out = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+?)\s*(?:;|$)/g;
  let m;
  while ((m = re.exec(flat))) out[m[1]] = m[2].trim();
  return out;
}

/**
 * Map one simple selector to the theme key it targets, or null if it is not a
 * pure token selector (anything with a descendant/pseudo part is ignored).
 *   :root                                          -> "*"  (every theme, lowest weight)
 *   html[data-theme="day"]                         -> "day"
 *   html[data-theme="apex"][data-apex-variant="x"] -> "apex-x"
 *   html[data-theme="apex"][data-apex-light="1"]   -> "apex-light-legacy"
 */
export function themeKey(sel) {
  sel = sel.trim();
  if (sel === ":root") return "*";
  const m = /^html\[data-theme="([a-z]+)"\](?:\[data-apex-(variant|light)="([a-z0-9]+)"\])?$/.exec(sel);
  if (!m) return null;
  if (!m[2]) return m[1];
  if (m[1] !== "apex") return null;
  if (m[2] === "variant") return "apex-" + m[3];
  return m[3] === "1" ? "apex-light-legacy" : null;
}

/** All <style> blocks of an HTML file, joined in source order. */
export function styleCss(html) {
  const parts = [];
  const re = /<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html))) parts.push(m[1]);
  return parts.join("\n");
}

/**
 * Declarations per theme key, in cascade order. Specificity: :root (0,1,0) <
 * html[data-theme] (0,1,1) < html[data-theme][data-apex-*] (0,2,1). Within the
 * same weight, later source order wins.
 */
export function collectBlocks(css) {
  const blocks = { "*": {} };
  for (const rule of topLevelRules(css)) {
    const keys = rule.selector.split(",").map(themeKey);
    if (keys.some(k => k === null)) continue;
    const props = customProps(rule.body);
    for (const k of keys) blocks[k] = Object.assign(blocks[k] || {}, props);
  }
  return blocks;
}

/** Resolve one theme's computed token map from collected blocks. */
export function resolveTheme(blocks, theme) {
  const out = Object.assign({}, blocks["*"]);
  const base = theme.startsWith("apex") ? "apex" : theme;
  if (blocks[base]) Object.assign(out, blocks[base]);
  if (theme !== base && blocks[theme]) Object.assign(out, blocks[theme]);
  return out;
}

/** Only themes the surface actually declares (navy is the :root default). */
export function themesIn(blocks) {
  return THEMES.filter(t => t === "navy" || blocks[t]);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/**
 * Model: surface -> theme -> { var: value }.
 * withApexCss (default true) layers theme-apex.css onto the app's apex themes,
 * which is what the app really shows. The drift check passes false so it only
 * compares the hand-copied blocks in the three HTML files.
 */
export function buildModel({ withApexCss = true } = {}) {
  const model = {};
  const apexBlocks = collectBlocks(read(APEX_CSS));
  for (const [surface, file] of Object.entries(SURFACES)) {
    const blocks = collectBlocks(styleCss(read(file)));
    model[surface] = {};
    for (const t of themesIn(blocks)) {
      const map = resolveTheme(blocks, t);
      // theme-apex.css is injected at runtime after the inline <style>, so its
      // equal-specificity html[data-theme="apex"] block wins. App only.
      if (withApexCss && surface === "app" && t.startsWith("apex")) Object.assign(map, resolveTheme(apexBlocks, t));
      model[surface][t] = map;
    }
  }
  return model;
}

// ---------- colour + WCAG 2.1 contrast ----------

/** Resolve var(--x[, fallback]) chains against a token map. */
export function resolveValue(value, map, depth = 0) {
  if (depth > 10 || value == null) return value;
  return value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, name, fb) => {
    const v = map[name] != null ? map[name] : fb;
    return v == null ? "" : resolveValue(v.trim(), map, depth + 1);
  });
}

/** Parse #rgb/#rgba/#rrggbb/#rrggbbaa or rgb()/rgba(); returns {r,g,b,a} or null. */
export function parseColor(v) {
  if (!v) return null;
  v = v.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split("").map(c => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    };
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    let a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a };
  }
  return null;
}

export function toHex(c) {
  const h = n => Math.round(n).toString(16).padStart(2, "0");
  return "#" + h(c.r) + h(c.g) + h(c.b) + (c.a < 1 ? h(c.a * 255) : "");
}

/** Composite a translucent colour over an opaque backdrop. */
export function over(fg, bg) {
  const a = fg.a == null ? 1 : fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

/** WCAG 2.1 relative luminance. */
export function luminance(c) {
  const ch = x => {
    x /= 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
}

export function contrastRatio(a, b) {
  const la = luminance(a), lb = luminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Key pairs. kind "text" needs 4.5:1 (AA normal text); "ui" needs 3:1
// (AA large text / non-text UI). "pending" is what .b-pending actually uses.
export const PAIRS = [
  { id: "txt-bg", fg: "--txt", bg: "--bg", kind: "text", label: "Text on page" },
  { id: "txt-card", fg: "--txt", bg: "--card", kind: "text", label: "Text on card" },
  { id: "muted-card", fg: "--muted", bg: "--card", kind: "text", label: "Muted on card" },
  { id: "accent-card", fg: "--accent", bg: "--card", kind: "ui", label: "Accent on card" },
  { id: "win-card", fg: "--win-ink", bg: "--card", kind: "text", label: "Win ink on card" },
  { id: "loss-card", fg: "--loss-ink", bg: "--card", kind: "text", label: "Loss ink on card" },
  { id: "pending-card", fg: "--muted", bg: "--card", kind: "text", label: "Pending badge text (.b-pending uses --muted)" },
  { id: "pending-border-card", fg: "--faint", bg: "--card", kind: "ui", label: "Pending badge border (--faint)" },
];
export const AA = { text: 4.5, ui: 3 };

/** Contrast rows for one resolved theme map. */
export function contrastFor(map) {
  const page = parseColor(resolveValue(map["--bg"], map)) || { r: 0, g: 0, b: 0, a: 1 };
  return PAIRS.map(p => {
    const fgRaw = resolveValue(map[p.fg], map);
    const bgRaw = resolveValue(map[p.bg], map);
    let fg = parseColor(fgRaw), bg = parseColor(bgRaw);
    const declared = map[p.fg] != null && map[p.bg] != null;
    if (!fg || !bg) return { ...p, declared, fgValue: fgRaw || null, bgValue: bgRaw || null, ratio: null, pass: null };
    if (bg.a < 1) bg = over(bg, page);
    if (fg.a < 1) fg = over(fg, bg);
    const ratio = contrastRatio(fg, bg);
    return { ...p, declared, fgValue: fgRaw, bgValue: bgRaw, ratio: Math.round(ratio * 100) / 100, need: AA[p.kind], pass: ratio >= AA[p.kind] };
  });
}

/** Vars shared between surfaces per theme whose values differ. */
export function driftReport(model) {
  const out = [];
  const surfaces = Object.keys(SURFACES);
  for (const theme of THEMES) {
    const present = surfaces.filter(s => model[s][theme]);
    if (present.length < 2) continue;
    const vars = new Set();
    present.forEach(s => Object.keys(model[s][theme]).forEach(v => vars.add(v)));
    for (const v of [...vars].sort()) {
      const values = {};
      present.forEach(s => { if (model[s][theme][v] != null) values[s] = model[s][theme][v]; });
      if (Object.keys(values).length < 2) continue;
      const norm = new Set(Object.values(values).map(x => x.toLowerCase().replace(/\s+/g, "")));
      if (norm.size > 1) out.push({ theme, var: v, values });
    }
  }
  return out;
}

// ---------- page ----------

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function isColourVar(name, value, map) {
  return !!parseColor(resolveValue(value, map));
}

function fontFace(family, file) {
  const b64 = fs.readFileSync(path.join(root, "assets/fonts", file)).toString("base64");
  return `@font-face{font-family:"${family}";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:100 900;font-display:swap}`;
}

export function renderPage(model, generatedFrom, drift = driftReport(buildModel({ withApexCss: false }))) {
  const app = model.app;
  const themes = Object.keys(app);
  const colourVars = new Set(), sizeVars = new Set(), radiusVars = new Set(), otherVars = new Set();
  for (const t of themes) {
    for (const [k, v] of Object.entries(app[t])) {
      if (isColourVar(k, v, app[t])) colourVars.add(k);
      else if (/^--t-/.test(k) || k === "--apex-display") sizeVars.add(k);
      else if (/^--r-|radius/.test(k)) radiusVars.add(k);
      else otherVars.add(k);
    }
  }
  const sortVars = s => [...s].sort();

  const col = t => {
    const map = app[t];
    const rows = sortVars(colourVars).map(v => {
      const raw = map[v];
      if (raw == null) return `<li class="sw none"><i></i><span class="n">${esc(v)}</span><span class="h">not set</span></li>`;
      const c = parseColor(resolveValue(raw, map));
      return `<li class="sw"><i style="background:${esc(toHex(c))}"></i><span class="n">${esc(v)}</span><span class="h">${esc(raw)}</span></li>`;
    }).join("");
    const bg = toHex(parseColor(resolveValue(map["--bg"], map)));
    const card = toHex(parseColor(resolveValue(map["--card"], map)));
    const txt = toHex(parseColor(resolveValue(map["--txt"], map)));
    const muted = toHex(parseColor(resolveValue(map["--muted"], map)));
    return `<section class="theme" style="--p-bg:${bg};--p-card:${card};--p-txt:${txt};--p-muted:${muted}">
  <header><h2>${esc(THEME_LABELS[t] || t)}</h2><code>${esc(t)}</code></header>
  <div class="preview"><div class="pcard"><b>Test Tipster</b><span>3 legs · pending</span></div></div>
  <ul class="swatches">${rows}</ul>
</section>`;
  };

  const contrastRows = themes.map(t => {
    const cells = contrastFor(app[t]).map(r => r.ratio == null
      ? `<td class="na">n/a</td>`
      : `<td class="${r.pass ? "ok" : "bad"}"><b>${r.ratio.toFixed(2)}</b><small>${r.pass ? "AA" : "fail"} · ${r.need}:1</small></td>`).join("");
    return `<tr><th scope="row">${esc(THEME_LABELS[t] || t)}</th>${cells}</tr>`;
  }).join("");

  const sizeRows = sortVars(sizeVars).map(v => `<tr><th scope="row"><code>${esc(v)}</code></th>${themes.map(t => `<td>${esc(app[t][v] ?? "—")}</td>`).join("")}</tr>`).join("");
  const radiusRows = sortVars(radiusVars).map(v => {
    const val = app.navy[v] ?? app[themes[0]][v];
    return `<tr><th scope="row"><code>${esc(v)}</code></th><td>${esc(val)}</td><td><span class="rad" style="border-radius:${esc(val)}"></span></td></tr>`;
  }).join("");
  const driftRows = drift.length
    ? drift.map(d => `<tr><th scope="row">${esc(d.theme)}</th><td><code>${esc(d.var)}</code></td>${Object.keys(SURFACES).map(s => `<td>${esc(d.values[s] ?? "—")}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="5">No drift: shared vars match on every surface.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>tipdash theme tokens</title>
<style>
${fontFace("Geist", "geist-latin.woff2")}
${fontFace("Instrument Sans", "instrument-sans-latin.woff2")}
:root{color-scheme:light dark;--bg:#f6f7f9;--fg:#11141a;--mut:#5b6474;--line:#dde1e8;--card:#fff;--ok:#0b7a43;--bad:#b42318}
@media (prefers-color-scheme:dark){:root{--bg:#0c0f15;--fg:#eef1f6;--mut:#98a2b3;--line:#262c38;--card:#141922;--ok:#5fd48c;--bad:#ff9a9e}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 "Geist",system-ui,sans-serif;min-height:100dvh;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left))}
h1{font:600 1.6rem/1.15 "Instrument Sans","Geist",sans-serif;margin:0 0 4px;letter-spacing:-.01em}
h2{font:600 1.05rem/1.2 "Instrument Sans","Geist",sans-serif;margin:0}
h3{font:600 1.15rem/1.2 "Instrument Sans","Geist",sans-serif;margin:32px 0 10px}
p.lede{color:var(--mut);margin:0 0 20px;max-width:70ch}
code{font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.theme{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.theme header{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:12px 12px 8px}
.theme header code{color:var(--mut)}
.preview{background:var(--p-bg);padding:14px 12px}
.pcard{background:var(--p-card);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}
.pcard b{color:var(--p-txt);font-weight:600}.pcard span{color:var(--p-muted);font-size:13px}
.swatches{list-style:none;margin:0;padding:6px 0}
.sw{display:grid;grid-template-columns:22px 1fr;column-gap:8px;padding:4px 12px;align-items:center}
.sw i{grid-row:span 2;width:22px;height:22px;border-radius:6px;border:1px solid rgba(127,127,127,.35)}
.sw .n{font:12px/1.2 ui-monospace,Menlo,monospace}.sw .h{font:11px/1.2 ui-monospace,Menlo,monospace;color:var(--mut);word-break:break-all}
.sw.none i{background:repeating-linear-gradient(45deg,transparent 0 4px,rgba(127,127,127,.3) 4px 6px)}
.tbl{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:12px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;white-space:nowrap}
thead th{font-weight:600;color:var(--mut);font-size:12px}
td small{display:block;color:var(--mut);font-size:11px}
td.ok b{color:var(--ok)}td.bad b{color:var(--bad)}td.na{color:var(--mut)}
.rad{display:inline-block;width:44px;height:28px;background:var(--line)}
.type p{margin:6px 0}.type .geist{font-family:"Geist"}.type .inst{font-family:"Instrument Sans"}
footer{margin-top:32px;color:var(--mut);font-size:12px}
</style>
</head>
<body>
<h1>tipdash theme tokens</h1>
<p class="lede">Generated by <code>npm run tokens</code> from ${esc(generatedFrom.join(", "))}. The values come from the source files, so this page is only as current as its last run. Apex themes in the app include the overrides in <code>${esc(APEX_CSS)}</code>.</p>

<h3>Colours (app)</h3>
<div class="grid">
${themes.map(col).join("\n")}
</div>

<h3>Contrast (WCAG 2.1 AA)</h3>
<p class="lede">Text pairs need 4.5:1. Accent and the pending border are UI or large text, so they need 3:1. Translucent colours are composited over the page background first.</p>
<div class="tbl"><table>
<thead><tr><th>Theme</th>${PAIRS.map(p => `<th>${esc(p.label)}<small><code>${esc(p.fg)}</code> on <code>${esc(p.bg)}</code></small></th>`).join("")}</tr></thead>
<tbody>${contrastRows}</tbody>
</table></div>

<h3>Type</h3>
<div class="type">
<p class="inst" style="font-size:28px;font-weight:600">Instrument Sans: Test Tipster 4/5 legs</p>
<p class="geist" style="font-size:17px">Geist: Demo Server · 12.4u profit · 63% strike</p>
<p class="geist" style="font-size:13px;color:var(--mut)">Geist 13px: secondary text, chips, meta</p>
</div>
<div class="tbl"><table>
<thead><tr><th>Size var</th>${themes.map(t => `<th>${esc(t)}</th>`).join("")}</tr></thead>
<tbody>${sizeRows}</tbody>
</table></div>

<h3>Radius</h3>
<div class="tbl"><table>
<thead><tr><th>Var</th><th>Value</th><th>Sample</th></tr></thead>
<tbody>${radiusRows}</tbody>
</table></div>
<p class="lede">The app has no spacing tokens: spacing is written inline per component.</p>

<h3>Drift between surfaces</h3>
<p class="lede">These vars are declared in two or more of index.html, live/ and compare/, but with different values. No colours are changed here; Cinna decides.</p>
<div class="tbl"><table>
<thead><tr><th>Theme</th><th>Var</th>${Object.values(SURFACES).map(f => `<th>${esc(f)}</th>`).join("")}</tr></thead>
<tbody>${driftRows}</tbody>
</table></div>
<footer>Private design reference. labs/ is excluded from the public build.</footer>
</body>
</html>
`;
}

export function run() {
  const model = buildModel();
  const sources = [...Object.values(SURFACES), APEX_CSS];
  const outDir = path.join(root, "labs", "tokens");
  fs.mkdirSync(outDir, { recursive: true });
  const json = {
    sources,
    themes: model,
    contrast: Object.fromEntries(Object.entries(model.app).map(([t, map]) => [t, contrastFor(map)])),
    drift: driftReport(buildModel({ withApexCss: false })),
  };
  fs.writeFileSync(path.join(outDir, "tokens.json"), JSON.stringify(json, null, 2) + "\n");
  fs.writeFileSync(path.join(outDir, "index.html"), renderPage(model, sources, json.drift));
  return json;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = run();
  const fails = Object.entries(json.contrast).flatMap(([t, rows]) => rows.filter(r => r.pass === false).map(r => `${t} ${r.id} ${r.ratio}`));
  process.stdout.write(`tokens: ${Object.keys(json.themes.app).length} app themes, ${json.drift.length} drift rows, ${fails.length} contrast fails -> labs/tokens/\n`);
}
