# Tipdash loading screen

**Visual:** Cinna · **Cache-first stages:** Ray · 2026-09-10

## Rules
1. **Determinate** progress only — label + percent. No indeterminate spinner / sliding fake bar on the full-page panel.
2. **Kill forever** any “~50s / bot wakes / while the bot wakes” copy.
3. Tipdash navy: flat `--accent` on the panel fill (no purple glow essay).

## Hook
`setLoadPanel(label, pct)` updates the full-page panel. `TopBar.set(pct, label)` drives both the thin top bar and the panel.

Cache-first boot (main): paint from `tipdash_boot_v1` when present → `healthz` warm → `/api/servers?lite=1` → background `lite=0` for card stats.

## Copy bank
- Starting…
- Checking session…
- Connecting…
- Loading servers…
- Almost ready…
- Ready

Never mention wake, cold start, or Render sleep.
