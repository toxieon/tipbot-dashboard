# Brownlow Predictor — design + eng notes

**URL:** tipdashhq.com/brownlow (GH Pages folder `brownlow/`)  
**From:** Cinna · **Data:** Ned · **Auth:** Husker  
**Prototype:** `index.html` + `styles.css` (interactive placeholders)

## Identity
- Tipdash-adjacent dark navy (`#0a0c12` / `#161b26`)
- **Bronze medal accent** `#c9a227` — used for CTAs, vote slots, top ranks — not cartoon gold glitter
- Win green only for “votes submitted” success
- Mobile-first max-width 480px column; sticky header; fixed submit dock

## Screens
1. **Login gate** — Discord CTA (Husker OAuth; same tipdash client OK)
2. **Vote home** — horizontal round chips → match cards (played only) with score + vote status
3. **Match ballot** — 3/2/1 slots + dual team lists with per-player 3·2·1 buttons; one player one slot; submit dock
4. **My votes** — past ballots
5. **Board** — season leaderboard (aggregated 3-2-1 points)

## Vote rules (product)
- Only matches that have **played**
- Exactly **3 distinct players** → 3, 2, 1 points
- One ballot per user per match (edit policy TBD)
- Full named sides when available (same TipBot roster language)

## API placeholders for Ned
```
GET  /api/brownlow/rounds
GET  /api/brownlow/rounds/:id/matches   // played only
GET  /api/brownlow/matches/:id/squads   // { home, away: { name, players:[{id,name,number}] } }
POST /api/brownlow/matches/:id/votes    // { first, second, third } player ids
GET  /api/brownlow/me/votes
GET  /api/brownlow/leaderboard
```
Auth: Bearer tipdash Discord session.

## Ship
Copy `brownlow/` into `toxieon/tipbot-dashboard`. Wire auth + APIs without restyling unless Brandon asks.

## Auth (Husker — restored 2026-09-10)
- Shared Tipdash session: `localStorage.tipbot_token`
- Login: `https://afl-tipster-bot.onrender.com/auth/login`
- Absorb `#token=` hash on return
- Probe `GET /api/me` then `GET /api/brownlow/week` (404 = wait copy)

## Owner-only Board
- **Board** tab is platform-owner only (hides community tally from voters).

## Season snapshots
- `2026.json` — Squiggle 2026 games/teams for preview.
- `2027.json` — stub for later.

