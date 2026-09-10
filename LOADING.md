# Tipdash loading screen (visual)

**For:** Ray (cache-first wiring) · **From:** Cinna · 2026-09-10

## Rules
1. **Determinate** progress only — label + percent. No indeterminate spinner / sliding fake bar on the full-page panel.
2. **Kill forever** any “~50s / bot wakes / while the bot wakes” copy.
3. Tipdash navy: `--bg` / `--card` / `--accent` flat (no purple glow essay).

## Panel markup (replace `#loading` inner)
```html
<div id="loading" class="center">
  <div class="tb-loadpanel">
    <div class="logo" style="margin:0 auto 14px;width:46px;height:46px;font-size:22px">🎯</div>
    <h1>TipBot Dashboard</h1>
    <p id="loadingmsg" class="tb-loadpanel-label">Starting…</p>
    <div class="tb-loadpanel-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="tb-loadpanel-bar">
      <i id="tb-loadpanel-fill"></i>
    </div>
    <p class="tb-loadpanel-pct" id="tb-loadpanel-pct">0%</p>
  </div>
</div>
```

## CSS (determinate panel — drop slide animation)
```css
.tb-loadpanel{text-align:center;max-width:320px;margin:0 auto}
.tb-loadpanel-label{color:var(--muted);margin:0 0 4px;font-size:14px;min-height:1.3em}
.tb-loadpanel-bar{
  width:min(280px,70vw);height:8px;border-radius:99px;
  background:rgba(255,255,255,.08);overflow:hidden;margin:16px auto 8px;
}
.tb-loadpanel-bar > i{
  display:block;height:100%;width:0%;border-radius:99px;
  background:var(--accent,#5b8cff); /* flat — no gradient shimmer */
  transition:width .2s ease;
}
.tb-loadpanel-pct{
  margin:0;font-size:12px;font-weight:700;color:var(--faint);
  font-variant-numeric:tabular-nums;
}
```

## JS hook for Ray
```js
function setLoadPanel(label, pct){
  const msg=$("loadingmsg"), fill=$("tb-loadpanel-fill"),
        pctEl=$("tb-loadpanel-pct"), bar=$("tb-loadpanel-bar");
  if(msg) msg.textContent=label||"Loading…";
  const p=Math.max(0,Math.min(100, pct|0));
  if(fill) fill.style.width=p+"%";
  if(pctEl) pctEl.textContent=p+"%";
  if(bar) bar.setAttribute("aria-valuenow", String(p));
}
```
Drive from cache-first stages e.g. `Session 10%` → `Servers 40%` → `Ready 100%`. Top thin `#tb-loadbar` can stay for in-app fetches; prefer determinate `TopBar.set(pct)` there too — avoid `.indeterminate` when you know stages.

## Copy bank (short)
- Starting…
- Checking session…
- Loading servers…
- Almost ready…
Never mention wake, cold start, or Render sleep.
