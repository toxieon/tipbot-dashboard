# Tipdash loading screen

**Visual:** Cinna · **Cache-first stages:** Ray · **Cold-start resilience:** 2026-09-12

## Rules
1. **Determinate** progress only — label + percent. No indeterminate spinner / sliding fake bar on the full-page panel.
2. Do **not** show a dead red “Couldn't reach the bot.” on the first failure. Soft-ping `/healthz`, retry `/api/servers` (and detail) with backoff, and show **“Waking TipBot…”** with progress while cold-starting / 503 `warming`.
3. Only surface “Couldn't reach the bot” after retries are exhausted (and only when there is no last-good localStorage cache to keep painting).
4. Tipdash navy: flat `--accent` on the panel fill (no purple glow essay).

## Hook
`setLoadPanel(label, pct)` updates the full-page panel. `TopBar.set(pct, label)` drives both the thin top bar and the panel.

`api()` defaults: **60s** timeout per attempt, **3** attempts with exponential backoff on network fail / 502 / 503 (`{error:"warming",retry_after}`). **401** never retries — login flow unchanged.

Cache-first boot: paint from `tipdash_boot_v1` (+ `tipdash_detail_v1` for server detail) → `healthz` warm (open + visibility) → `/api/servers?lite=1` with retries → background `lite=0` for card stats.

## Copy bank
- Starting…
- Checking session…
- Connecting…
- Waking TipBot…   ← only while retrying cold start / warming
- Loading servers…
- Almost ready…
- Ready / Refreshing… / Updating servers…

Never invent “~50s” timers. Progress % should track real attempts/stages.
