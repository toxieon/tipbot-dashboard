## 0.54.2 · 2026-10-10 · `home` · Home for everyone, Stats dedupe

- **Home for everyone**: Single-server tipsters and follower-only users land on Home (not straight into server or follower detail), so the Racing next-to-go tile and Stats entry are always reachable.
- **Home Racing tile**: Shown for every signed-in user with a community (managed server or follow); uses the first managed server for Build when present.
- **Stats dedupe**: When you both run and follow the same server, settled tips are counted once by `tip_id`.
- **Tests**: `tests/home.test.js` covers no auto-jump, the one-tap server card, Stats and Racing tiles for single-server users; Stats dedupe fixture.

## 0.54.1 · 2026-10-09 · `racing` · Gallops and harness, opening prices

- **Chooser**: Build opens on Sports vs Racing, with a next-to-go strip. Countdown chips are computed client-side; racing APIs are not polled. The countdown stops itself once no badge is on screen.
- **Home Racing tile** (Cinna's design): a small next-to-go strip (start times, one read, no polling) for anyone who manages a server; tapping it opens Racing in Build. Deep links `#/s/<gid>/build/racing` and `/build/sports` route.
- **Gallops & harness only**: Categories T and H. Greyhounds (G) are excluded — TipBot returns 400 and the UI says so.
- **Opening prices**: Race-card odds are labelled Opening and read from TipBot's `runner.fixed` (the opening price it captures once). Tips lock to the opening win. No flucs sparkline and no live-odds refresh.
- **Hero**: Galloping horse on thoroughbred (T) race cards only. Harness has no hero. Reduced motion skips the open animation.
- **Results**: Placings and win/place dividends show after the race is final, from TipBot's `results` / `dividends` lists.
- **Unavailable state**: while the feed is off (`/api/racing/*` 503) the strip, meetings and race cards say "Racing data is currently unavailable. Please try again later." and Home says "Racing is unavailable right now."
- Review fixes against TipBot 0.58.1: meetings now send `category=T|H&date=<Sydney today>` (All = both, merged; it 400'd before), race cards read `{event}` (not `{race}`), jockey/driver read `jockey_or_driver`, next-to-go no longer prints a bare "m" with no distance, and opening Sports keeps legs already in the tray (the 0.53.x preserve rule).

Tests: `tests/racing.test.js`, plus the `tests/split.test.js` smoke now uses TipBot's real payload shapes (incl. a final race with results and dividends).

## 0.53.4 · 2026-10-09 · Home Stats screen

- **Stats screen.** A new Home Stats view (`#/stats`) with 7d / 30d / season units and ROI, a handwritten cumulative-units line, win rate by sport, best and worst markets, current and longest streaks, average odds, a monthly bar chart, and a per-server breakdown. Figures are computed in the browser from the `/api/server` and `/api/follower` payloads the dashboard already loads — no new endpoints.
- Reach it from the Stats tile on Home (and the header button when your one server page is Home). No top-bar link and no tab: the phone tab bar stays Home | Build | Upcoming. `stats` is in `panel()`'s fixed list.
- Empty, loading/skeleton and error states; charts stay still when reduced motion is on; phone-first layout that goes two-up on desktop.
- `/api/server` sends at most the latest 25 settled tips per server, so a full list shows a small "based on the latest settled tips" note.
- Fix: a month whose running total passed through 0 (e.g. a void first) drew a duplicate monthly bar.

Tests: `tests/stats.test.js`, including a hand-computed fixture (admin + follower payloads, 7d / 30d / season). Checked against the 6 Oct settled-tips export: season units, staked and ROI match the bot's own server_stats formula.

## 0.53.3 · 2026-10-09 · Phone-first UI audit

Phone-first audit. The 15 shipped fixes:

- **Upcoming was a hidden screen.** `panel()` never listed `upcoming`, so Home | Build | Upcoming could not show Upcoming. The tab now unhides `#upcoming`.
- **Upcoming bounced to the server page.** Opening Upcoming with no prior load called `loadDetail` and left the new screen. It now stays on Upcoming, paints a skeleton, and loads queued tips (with retry on error).
- **Deep link `#/s/<gid>/upcoming` was ignored** and reloads landed on the server page. Routed.
- **Upcoming with no servers was a dead tab.** Empty state plus `TBOpenUpcoming` for the phone bar.
- **Server page threw on missing tips/stats.** `renderDetail` now treats missing `tips`/`stats`/`settings` as empty and shows an error if there is no guild id.
- **Tip cards printed `undefinedu @ undefined`** and crashed on a null tip. Units/odds omit when missing; null rows are skipped.
- **Home cards were mouse-only.** Server and follower cards are `role="button"` with Enter/Space.
- **Empty home was a faint one-liner.** Illustrated “No communities yet” status region.
- **Tap targets under 44px:** gear (32/38), back, primary buttons, tabs, theme swatches, accent dots, topnav, menu rows, batch clear, Add on the builder.
- **Contrast:** `.empty` uses `--muted`; Light / Black / Mono `--faint` lifted to the muted ink so captions pass on those shells.
- **Stats period `<select>` had no label.** `for`/`aria-label` on `#monthsel`.
- **Stale cache-busting** on favicons, the web manifest, `players.json`, and `bookies.json`.
- **Focus:** `select`, `textarea`, and `[role="button"]` get the same visible ring; toggles have `aria-label` / `aria-pressed`.
- **Long names overflowed home cards** at 360–430px. Names wrap; name columns `min-width: 0`.
- **Apex header actions and glow could widen the page.** Actions wrap; Upcoming/detail/builder clip sideways; the tab indicator reads layout once via `getBoundingClientRect`.

Tests: `tests/upcoming_screen.test.js`, `tests/edge_data.test.js`, `tests/phone_a11y.test.js`, plus a missing-payload case in `tests/server_view.test.js`.

## 0.53.2 · 2026-10-09 · Phone tab bar: Home | Build | Upcoming

- The phone tab bar follows the TABS order, and Build sits in the centre column of a three-column grid, so it is centred and no longer clipped at the edge.

## 0.53.1 · 2026-10-09 · `tipdash` · Cleaner navigation and new theme names

- **WON/LOST stamp overlap.** The tilted WON/LOST stamp covers the +/- units figure (e.g. +0.8085u, -0.23u). Keep the stamp, since the owner likes it, but move or shrink it so the units are always fully readable at 360–430px and on desktop. For example, put the stamp behind the units at low opacity, or beside the Win/Loss pill, never on top of the number.
- **Themes.**
   - Move the old themes (Navy, Day, Ochre) into a collapsed 'Legacy themes' section at the bottom of the Appearance settings. They still work, but they're tucked away.
   - The Apex family becomes the main themes with plain names: Apex → 'Midnight', Apex Light → 'Light', Apex OLED → 'Black', Apex Mono → 'Mono'.
   - Add a new Apex variant, 'Ochre', a warm amber/ochre take built on the Apex shell (data-theme="apex" with data-apex-variant="ochre", following the existing variant pattern).
   - Keep the stored theme ids backward compatible (apex, apex-light, apex-oled, apex-mono, plus the new apex-ochre). Only the labels change.
   - The user-facing UI must not use the word 'Apex' anymore.
- **Bottom tab bar.** It becomes exactly three items: Home | Build | Upcoming, with Build as the centred raised primary button.
   - Remove Live from the bar and hide the Live view entirely for now, but keep the code.
   - Remove Settings from the tab bar. Settings is reached only from the gear in the top right, and that gear shows only on the Home screen.
- **Upcoming as its own screen.** Upcoming opens as a full screen with its own header and back navigation, not as a tab panel swapped in place.
- **Bug: pressing Upcoming halfway through building a tip glitches.** Fix the navigation so leaving the Build flow mid-way is clean: no overlapping panels or broken state. The draft tip should be preserved if that's easy, otherwise discarded cleanly. Add a test.

## 0.52.5 · 2026-10-09 · P0: dashboard API base restored

- 0.52.3 set `const API=""` in index.html, so every dashboard call went to tipdashhq.com and failed ("Couldn't load that server."). Restored `https://afl-tipster-bot.onrender.com` and added a test.

## 0.52.4 · 2026-10-09 · Apex variants get the Apex shell

- Added /logo-lab/ preview page with 4 animated logo concepts.

- apex-light, apex-oled and apex-mono now render as `data-theme="apex"` plus `data-apex-variant` (light, oled, mono), so the tab bar, glow and animations apply. Saved names and TipBot theme prefs are unchanged.
- The Apex tab indicator slide stops under reduced motion.

# Changelog: toxieon/tipbot-dashboard (tipdash)

## 0.52.3 · 2026-10-09 · `apex-delight` · Apex theme delight layer

Added a delight layer to the Apex theme, enhancing the premium feel without compromising performance or accessibility.

- **Win moment**: Settled wins now trigger a subtle celebratory burst (confetti) and a green pulse on the profit number.
- **Streak flame**: A small animated flame chip appears on the home screen and server tiles for 3+ consecutive wins.
- **Skeleton loaders**: Replaced spinners and blank states on home, server tiles, and Upcoming with shimmering skeletons matching the final layout to remove layout shift.
- **Micro-interactions**: Added press-scale on buttons and tiles, spring easing on the bottom-tab indicator, a pull-to-refresh style shimmer on Upcoming, and smooth count-up on stat tiles.
- **Empty states**: Added friendly illustrated empty states (inline SVGs) for no upcoming tips, no results yet, and no servers.
- **Accessibility**: All animations respect `prefers-reduced-motion` and use only transform/opacity for performance. Tests added for streak calculation and reduced-motion handling.

## 0.52.2 · 2026-10-09 · Apex glow fits phone screens

- Keep the Apex hero glow inside the screen on phones (scrollWidth was 455 at 390px)

## 0.52.1 · 2026-10-09 · `theme-variants` · Theme variants and accent picker

- Add Apex Light, Apex OLED, and Apex Mono theme variants
- Add Accent colour picker (Blue, Green, Orange, Crimson, Violet, Gold)
- Add Follow System theme mode
- Support short View Transitions on theme and accent changes
- Fix horizontal scroll overflow on narrow screens caused by the Apex hero background glow

## 0.51.3 · 2026-10-09 · `ext-fix` · Program-owner panel loads from the bot, not a public file

`assets/ext.js` 404'd on the live site: `scripts/build-public.mjs` has always excluded it, so `window.TBOwner` (and the custom games controls) never loaded for the program owner. The file is now deleted from this repo — it's public on GitHub — and the companion endpoint `GET {API_BASE}/api/ops/ext.js` (TipBot, program-owner-only, 404 to everyone else, `Authorization: Bearer` session auth same as `/api/ops/ui.js`) replaces it.

- `ensureExt()` still gates on `/api/me` returning `ops===true` first. On a go-ahead it fetches that endpoint and runs the response from a blob URL (no inline eval). A 404 or any network failure fails silently — no console output, no visible error.
- TipBot's matching endpoint is live.
- Tests: `tests/public_build.test.js` now asserts `assets/ext.js` is gone and no public file names it.

## 0.51.2 · 2026-10-09 · `settings-drawer` · Settings panel on phones

The settings menu was opening off the left edge of a phone when the header wrapped, so Appearance could not be reached. The server tier mark was a stretched box outside Apex.

- On a phone the drawer is fixed to the viewport, at most the screen width, and it scrolls. The gear stays on the right. This applies in navy, day, ochre, and Apex.
- The tier mark is a small pill in every theme.
- Tests: `tests/settings_drawer.test.js`.

## 0.51.1 · 2026-10-08 · `apex` · Apex app shell

Apex is the default for a new visitor (`APEX_DEFAULT`, on). Navy, day and ochre stay selectable. The same pages, data and actions remain.

- Desktop gets a fixed section rail (Home, Servers, Upcoming, Live, Build, Settings) with a moving indicator. A phone gets a bottom tab bar and a raised Build button. Page changes use the View Transitions API when it exists.
- Home opens with total profit, a drawn units line, and queued / live / next. Server cards carry a mini chart and rise as they enter view.
- A server page leads with the name, units and ROI. The timeframe is a segmented control. Stat tiles sit in a bento grid. Tipster rows keep initials and reorder in place.
- Upcoming and live games group under sticky day headers, with team initial lockups, the countdown ring, and Win / Loss / Push as one segmented control.
- Build a tip shows Sport, Game, Market, Confirm. Sport chips are the first step. Every sport chip, filter, and game label uses one shared mark (`assets/sport-marks.js`).
- Buttons press in, tiles lift on a fine pointer, skeletons shimmer, toasts slide, and figures tick when the value changes. Motion stays on transform and opacity, and reduced motion jumps to the end state.
- Tests: `tests/apex_theme.test.js`.

## 0.50.1 · 2026-10-08 · `apex` · Apex theme

Navy, day and ochre are unchanged. Apex is an extra appearance, dark by default. With Auto on, Apex is light from 7 am to 7 pm Sydney time and dark after that, until midnight hands the choice back the way the other themes already do.

- Tokens live on `html[data-theme="apex"]` everywhere the other themes do, including a light set for the day-time variant. The swatch is in Settings → Appearance.
- Motion is in `assets/theme-apex.js` and `assets/theme-apex.css`, loaded only while Apex is on. Geist and Instrument Sans are self-hosted (SIL OFL).
- Settled win and loss cards stamp once per tip per session. Last-10 form tiles flip in, a three-win run shows a flame, the units line draws on first view, upcoming tips get a countdown ring, and ranked rows slide when their order changes.
- If the account server does not store Apex yet, the dashboard keeps the local choice instead of clearing it.
- The glow sits behind the title and does not push the page down. On a phone the header is one row. Form tiles are squares with the streak chip, and the home tier mark is a small pill.
- Tests: `tests/apex_theme.test.js`.

## 0.49.2 · 2026-10-08 · `custom-games` · Owner controls for custom games

Needs TipBot 0.55.1. The program-owner panel lives in `assets/ext.js` and loads only after `/api/me` says `ops: true`. The public copy does not include that file, and it does not name it.

- **Allow custom games** reads and sets `enabled` on `GET` and `POST /api/ops/custom-games`. The value sent is a JSON boolean.
- **Servers.** Each listed server shows its name when TipBot knows it, plus Remove. Add a server by its id with `POST /api/ops/custom-games/whitelist`.
- The controls are not requested or drawn for anyone else. A 404 leaves them off the page.
- One note: custom bet lines on fixture games still work when the switch is off.
- The tip builder shows `Custom games aren't available in this server.` when a submit is refused with that message, including a batch.
- Tests: `tests/public_build.test.js`.

## 0.49.1 · 2026-10-08 · `audit` · Phone load, layout, and session gates

- A deep link (settings, a server, results) is kept when the account has one server. The home shortcut no longer overwrites it.
- Dashboard reads are not reused from the browser cache. The wake ping is shared, so opening the page does not call it three times.
- Script addresses include the version, so an update replaces the previous files. The dashboard scripts sit after the page shell so the first paint is not blocked on them.
- On a narrow phone, the header backdrop, the batch bar, and the server cards stay inside the screen.
- Platform tools load only after the session confirms them, and they are left out of the public copy.
- Tests: `tests/public_build.test.js`.

## 0.48.1 · 2026-10-08 · `compare` · Compare a player prop across bookies

Compare is back in the tip builder. The section starts closed, like the others.

- Pick a player and a line, such as Errol Gulden 25+ disposals, then tap Compare.
- The panel ranks each bookie's price for that exact line and highlights the best one.
- Nearby lines, such as 20+ or 30+, sit underneath so you can see where the value is.
- A bookie with no price is left out. If nothing is saved for the prop, the panel says so.
- One line at the top of the panel explains what Compare does.
- Tests: `tests/compare_ui.test.js`.

## 0.47.1 · 2026-10-08 · `live-cards` · Live player cards

- **`/live`** shows games in progress for the signed-in server. Each game has the score and the clock. Each active tip leg is a player card: name, market and line (such as under 19.5 disposals), the live count against that line with a progress bar, on track / at risk / hit / miss, plus the tip's units and odds.
- The page only reads endpoints the dashboard already uses: `/api/servers`, `/api/live-tips`, `/api/server`, `/api/server/prop-counts`, `/api/fixtures` and `/api/live-stats`. A count those payloads don't include stays blank. The clock is the phase label or clock already on those payloads. Historical imports are left out.
- Refreshes every 45s while the tab is visible, and pauses while it is hidden. Phone layout, 44px controls, no sideways scroll. `?sample=1` paints the sample cards with no sign-in.
- Tests: `tests/live_cards.test.js`.
- The previous live board (all sports, game and flat views, heatmap) is kept at `/live/board/`, linked as Board from `/live`.

## 0.46.1 · 2026-10-08 · `public-build` · Public build + admin tools loader

- The pages that ship are an allowlisted copy in `dist/`. After sign-in, a session with admin access gets an Admin tools tab that loads its bundle from TipBot.
- Tests: `tests/public_build.test.js`.

## 0.45.3 · 2026-10-08 · `hotfix` · Pricing page kept, unlinked

- `/pricing/` restored but reachable by direct URL only: nothing links to it. No prices on `/welcome/` or tipster pages.
- `Home` link removed from the public page headers and the 404 page. Developer notes removed from public page copy.

## 0.45.2 · 2026-10-08 · `hotfix` · Pricing page removed

- `/pricing/` removed, along with every link to it (nav, buttons, 404 page) and the price band on `/welcome/`. Plan stub script and its test removed.

## 0.45.1 · 2026-10-06 · `public-site` · Public landing and verified tipster pages

The dashboard at `/` is the same app. These pages sit beside it: static HTML, no backend, no build.

- **`/welcome/`** — landing page. Hero, “Add TipBot to your server”, and short sections for verified tips, auto-grading, follower bankroll and P&L, form and streak, and leaderboards. Links to the dashboard (`/`). tipdash has no Discord bot invite yet, so `BOT_INVITE_URL` in `assets/site/site.js` is the placeholder until an OAuth URL exists.
- **`/t/<handle>`** — public verified tipster page (avatar, record, units chart, last-10 dots, streak, recent tips). GitHub Pages can’t rewrite, so `404.html` renders any `/t/<handle>` path and every other unknown path stays a normal 404. `/t/index.html?handle=` is the fallback that returns 200. Stats are computed from tip rows and skip historical imports. The page shows example data (labelled) until `GET /api/public/tipster/<handle>` exists.
- Settings menu gains a Public site link. `TD.version` is 0.45.1.
- Tests: `tests/tipster_stats.test.js`.

## 0.44.1 · 2026-10-06 · `server-view` · Server page matches the stat cards, charts and tip list

The server page (open a Discord server) now leads with the same kind of record Cinna mocked up: units, ROI, strike rate and the W–L record with pushes, form dots and the hot streak when the server sends form, a units-over-time line and a monthly P&L bar chart, then the recent tips in that tighter list. Charts are hand-drawn SVG and follow the day, night and ochre colours already in the app.

Bets by bookie is a donut, and it only appears when tips actually carry a bookie. Per-tipster units in this server are added up from the tips already on the page (no new API). Tips marked as a historical import are left out of those sums when the list is complete enough to recompute; otherwise the cards stay on the figures `/api/server` already sent. Month picker, calendar, Upcoming and Finished, Scheduled Tips, settings, owner tools and the Form list are unchanged.

- Tests: `tests/server_view.test.js`.

## 0.43.6 · 2026-10-06 · `form-badges` · Tipster form shows as dots and a streak

Needs TipBot 0.52.1. A server only sends form when its form-badges flag is on. When that object is there, Discover cards (including the featured tipster), the server page, each follower row, and the follower profile show up to 10 small dots — win green, loss red, push or void grey, newest on the left — plus a hot pill (`🔥 3W`) or a quiet streak (`W3` / `L2`). If form is missing, those spots stay as they were. The server page also loads a short Form list of tipsters (hot first) through the same database queue as the other server calls.

- Tests: `tests/form_badges.test.js`.

## 0.43.5 · 2026-10-06 · `master-confirm` · Master confirms sit on top, and one consensus save keeps every field

- **Master → Forwarding → Servers:** turning a server's Forward switch on opened "Turn forwarding on for this server?" behind the page, so the click looked like it did nothing. Confirms and sheets on the master page now open on top of the page, and the confirm button is focused. The same sheet is used for the other confirms there (master beta, set as master, lockdown, consensus).
- **Master → Consensus:** setting Minimum servers to 2, turning Consensus on and confirming saved the switch but put Minimum servers back to 3. That confirm posted only the switch, before the number box was read. One save now posts every current field (on, dry run, paused, minimum servers, and the rest) to `POST /api/consensus/settings`.
- Tests: `tests/master_sheet.test.js`, `tests/consensus_ui.test.js`.

## 0.43.4 · 2026-10-06 · `db-queue` · Server page stops crowding the bot, and Upcoming counts only upcoming tips

- **One database at a time.** Opening a server fired 6–8 requests together, and the 30 s scheduled-tips poll landed on the same second as the 90 s live-tips poll. TipBot answered 503 `db_busy`, and after three tries the page said "Couldn't reach the bot". Database calls now wait in a short queue (about 2 at a time). Fixtures, upcoming, master config and odds skip that queue. A 503 waits `retry_after` plus a random 0–1 s. The two polls are offset so they don't fire together, and they pause while the tab is hidden. "Couldn't reach the bot" shows only after the retries are used up.
- **Upcoming Bets count.** The header counted every pending tip ("1 queued") even after that tip had moved to Finished games, so the body said "No upcoming bets". The header now counts upcoming tips only ("0 upcoming"). Finished games has its own badge ("1 to settle"). If nothing is upcoming but a finished tip is waiting to be graded, the empty line says so. A start stored as a date only (such as NBA-2026-037, `2026-10-03`) is the end of that local day.
- Tests: `tests/db_queue.test.js`, `tests/upcoming_split.test.js`.

## 0.43.3 · 2026-10-06 · `ft-grade-load` · Full-time auto-grade switches stay unknown when the read fails

- **Settings → General:** a failed, 503 `db_busy`, or missing-flag read of the full-time switches is retried (honouring `retry_after`). If it still doesn't load, that switch stays disabled with "Couldn't load, retry" and is never shown as off, so a reload can't be saved as off by mistake. A toggle does nothing until that sport's real on or off state has loaded. AFL still comes from `/api/auto-push`; NFL and NBA/WNBA still come from `/api/feature-flags`. A late auto-push response can't paint the other two off.
- Tests: `tests/ft_autograde.test.js`.

## 0.43.2 · 2026-10-06 · `ft-autograde` · AFL, NFL and NBA/WNBA full-time auto-grade are separate switches

Needs TipBot 0.47.1. Nothing is turned on: each flag still defaults off.

- **Settings → General** (server admins): the full-time control is three switches, the same toggle as before. **Auto-grade AFL at full time** still saves `feat.auto_push_ft` through `/api/auto-push`. **Auto-grade NFL at full time** (`feat.auto_push_ft_nfl`) and **Auto-grade NBA/WNBA at full time** (`feat.auto_push_ft_nba`) each save only that flag through `/api/feature-flags`.
- **Admin Tools → Features** (platform owner): the list still follows TipBot's registry order. Those three rows use the same Auto-grade labels, with NFL and NBA/WNBA next to AFL. A note says NFL also needs `ESPN_AUTO_PUSH_FT` and NBA/WNBA also needs `ESPN_AUTO_PUSH_FT_NBA`; the toggle alone won't grade if that server env switch is off. If the API includes the env-gate state, the note shows on or off.
- Tests: `tests/ft_autograde.test.js`.

## 0.43.1 · 2026-10-06 · `apple-design` · Press feedback, sheets and undo, in-app Back, and the design system

One feature release on top of 0.42.3 (the simple TipBot tile stays the mark).

- **Bug fixes:** one `toast(msg, kind, {action})` (error / success / warn), Day-theme ink tokens, safe areas, hover only on fine pointers, promo chip pulses twice, day-sheet focus trap, toggle uses `transform`.
- **Press feel:** controls and cards react on pointer-down; the gear menu grows from the gear; trays enter and leave along one path; the switch has a physical overshoot; adding a leg bumps the tray count (and a short haptic tick on Android). Reduced motion drops movement and keeps fades.
- **Sheets and undo:** `assets/tb-motion.js` (`TBMotion` spring + `TBSheet`, drag to dismiss). Native `confirm()` is gone: trial mode and clearing a batch undo from a toast; destructive actions use a sheet; God-delete of a settled tip is a 1.2 s hold. Grade undo is on by default (4 s, ⚙ to turn off).
- **Back stays in the app:** views and sheets push history, so Back / swipe-back steps through TipDash and closes a sheet first. Deep links `#/s/<id>`, `#/settings`, and the other view hashes. One sticky header (Dashboard · Live) shared with `/live`. Owner settings is its own view. Sticky headers stick (`overflow-x: clip`). Restoring a builder draft no longer throws when the title sits in `.dhead`. The builder search box is no longer ~160 px tall on a phone.
- **Design system:** 8-step rem type scale, radius tokens (nested corners concentric), frosted trays / menu / toast with reduced-transparency and high-contrast fallbacks, theme changes cross-fade, switches expose `role="switch"`. Home screen: `display: standalone` on the existing manifest, using the 0.42.3 tile icons.
- **Review fixes:** `tb-motion.js` is cache-busted with `?v=` like the other modules. If that script fails to load, confirms fall back to the browser dialog (dashboard and Master) and the day sheet falls back to an alert. A grade waiting out the 4 s undo window is sent immediately on `pagehide` or when the tab is hidden (`fetch` keepalive, same bearer token); a second toast cannot drop or double-post that grade.
- Tests: `tests/toast_single.test.js`, `tests/day_theme_tokens.test.js`, `tests/apple_design.test.js`.

## 0.42.3 · 2026-10-06 · `logo-simple` · Cinna's simple TipBot tile is the default mark

- Favicon is the TB monogram (`assets/favicon.svg`, the 16/32 mark). The header slot is 30 px and the Live brand mark is 18 px, so they use that monogram. Login and the loading panel are 46 px, so they use the TipBot wordmark tile (`assets/logo.svg`).
- Apple touch icon is a 180 px raster of the solid tile. `assets/favicon.ico` (16/32/48/256) and the solid PWA icons (192 and 512) are linked from the dashboard, Live, Master and Compare. `manifest.webmanifest` carries the name and the tile colour `#0F1420`.
- Bookie marks stay as they are.

## 0.42.2 · 2026-10-02 · `busy-recovery` · Scheduled Tips no longer sticks on "warming"; AFL Upcoming Bets keeps its start times (works with TipBot 0.44.1 or older)

- **Scheduled Tips panel:** when TipBot answered 503 (`{"error":"warming"}` or `{"error":"db_busy"}`, which happens during a restart or a busy DB), the panel showed the raw word "warming" until the next 30 s poll, and every remount whose first load got a 503 showed it again. Brandon hit this on 2 Oct around 19:38–19:47, when TipBot logs show `/api/scheduled-tips` 503s and two health-check restarts. Now a 503 shows "TipBot is busy or starting up. Retrying…", keeps any list already loaded, and retries after `retry_after` (2–10 s, default 4 s), up to 6 times, before it waits for the normal poll.
- **Upcoming Bets "time TBC":** `fetchUpcomingCtx` switched `/api/upcoming` off for the whole session after a single network error. That only happens when TipBot restarts mid-request (19:42:01 on 2 Oct), and the fallback fetches failed during the restart too, so AFL tips such as GWS v Essendon (AFL-2026-036) showed "time TBC" until the page was reloaded. Now a network error falls back for that load only, and only a real 404 marks an older TipBot.
- **AFL tips carry their start:** the builder now sends `game_start`, the fixture's start (Squiggle `unixtime`) as ISO UTC, for AFL fixture games on the single, batch and queue payloads, so a tip's start no longer depends on `/api/upcoming` alone. TipBot already accepts `game_start` (ISO datetime). ESPN and custom games are unchanged.
- Tests: `tests/busy_recovery.test.js` (new).

## 0.42.1 · 2026-10-01 · `csv-template` · Paste tip sheet: owner-only "Download CSV template" (needs TipBot 0.43.1)

- Admin Tools → Paste tip sheet (owner-only panel) gains **Download CSV template**. It fetches TipBot's `GET /api/owner/tipsheet-template` (owner-only) and saves `tipsheet-template.csv`: notes lines (`#`, allowed values), the header with exactly the columns the importer reads, and one example row. Older TipBot: "This needs TipBot's latest deploy" (press the button again once it's live).
- The Paste sheet now also reads that CSV: a sheet whose first line starts `kind,` (no tab) is read as CSV (quoted cells allowed); `#` lines are notes. TSV / two-space sheets are read exactly as before. Same rule as TipBot's parser.
- Tests: `tests/tipsheet_template.test.js` (4; the template is the shared fixture `tests/fixtures/tipsheet_template.csv`, checked byte-for-byte against TipBot's generator in TipBot's tests). `tests/split.test.js`: new admin entry point `pasteSheetTemplate`.

## 0.41.2 · 2026-10-01 · `light-server-rosters` · Server page and builder load less (needs TipBot 0.42.3 for the full gain)

- **Server page:** `/api/server` no longer carries live/FT prop counts (TipBot 0.42.3). They load right after the page paints from `GET /api/server/prop-counts` and are merged into the tip legs (`current`, `emoji`, `status`, `line`, `side`), then the page repaints once. An older TipBot has no such endpoint, but its `/api/server` still includes the counts, so the miss is ignored.
- **Builder:** the games list asks for `/api/fixtures?rosters=0` (no players: a few KB instead of a few hundred). Picking a game fetches only that game's players from `/api/fixtures/roster?game=` (cached 2 min per game) and shows "Loading players…" meanwhile. Older TipBot: it ignores `?rosters=0` (players already present, nothing extra fetched) or 404s the roster endpoint, and the builder falls back to the full `/api/fixtures` payload. Also used for the 3-min games poll and the old-TipBot upcoming fallback.
- `assets/light-data.js` (browser `TBLight` + node export). Tests: `tests/light_data.test.js` (6). No visual changes.

## 0.41.1 · 2026-09-30 · `scheduled-tips` · Server page: Scheduled Tips (cancel, adjust odds, edit before posting)

- New **Scheduled Tips** section on the server page (open by default): the server's queued / scheduled tips that haven't posted yet, with when each posts ("⏰ Posts Wed 10:30 pm (in 9 min)"), legs, odds, stake, bookmaker, an image badge and "↗ forwarded" when the master already has the scheduled copy. Refreshes every 30 s.
- Actions (same sign-in as the builder): **Cancel tip** (confirm), **Adjust odds**, **Edit** (leg text, odds, stake, bookmaker). They go through TipBot `POST /api/scheduled-tip` (list: `GET /api/scheduled-tips`), which updates the queued tip and the forwarded master copy. A tip that already posted comes back with TipBot's clear "already posted" message and drops off the list.
- `assets/scheduled-tips.js` (browser `TBScheduled` + node export). Tests: `tests/scheduled_tips.test.js` (9). Needs TipBot 0.41.1; older TipBot shows "needs TipBot's latest deploy".

## 0.40.3 · 2026-09-30 · `stats-flicker` · Server stats stop flashing to 0; the builder loads its data in parallel (perf deep dive quick fixes)

- Home: the fast `lite=1` server list has no stats, so it now keeps the stats already shown (saved boot copy / current state) and saves those, instead of overwriting them with nothing. Cards with no stats yet show "…" instead of 0.
- The lite list only re-renders home when home is showing. It no longer pulls you off a server page back to home.
- Server page: a saved copy (memory or disk) paints with "Updating…" for Tips Queued (tile and summary) until fresh `/api/server` data arrives. Disk copies older than 10 min aren't painted at all. If the refresh fails, the last known count shows again.
- Builder: `players.json`, `bookies.json` and `/api/fixtures` load in parallel (`prefetchBuilderData`), and are warmed once a server page has loaded, so opening the builder reuses them.

## 0.40.2 · 2026-09-29 · `lazy-builder` · The tip builder and Paste sheet load on first open (Claude, Phase 2.2b)

No visual or behaviour changes. The first page load no longer downloads or parses the tip builder or Admin Tools' Paste tip sheet.
- **What moved:** 88 top-level declarations of the builder (AFL games/players, custom tips, ESPN NFL/NBA/WNBA picker, tray, review, schedule, batch, drafts) to `assets/builder.js`, and the 8 of Paste tip sheet (parse, preview, confirm) to `assets/admin.js`, **byte-for-byte**: every one of the main script's 425 top-level declarations is still there exactly once across index.html + the two files (checked by parsing all three).
- **How:** index.html's main script was never a closure but a top-level classic script, so its `const`/`let`/`function` names (`BUILD`, `BATCH`, `STATE`, `$`, `esc`, `api` …) are shared with any other classic script on the page. The two files are plain scripts in that same scope, so the moved code runs unchanged. The one small namespace is `window.TD`: `TD.load(name)` adds `<script src="./assets/<name>.js?v=<VERSION>">` once (cache-busted every release, `TD.version` must equal `VERSION`), and index.html keeps a placeholder for each entry point the rest of the app calls (`openBuilder`, `openCustom`, `pasteSheetPreview`, `pasteSheetConfirm`). A placeholder loads its file, then the real function the file declares replaces it. A failed load shows "Couldn't load the tip builder/admin tools. Check your connection and try again." and a retry fetches again.
- **Kept in index.html** (used outside the builder): the Results view, `teamName` / `aflLogoHtml` / `fmtGameWhen` and their helpers, the batch tray (`renderBatchTray`, `syncTrayStack`, `clearBatch`: every server open calls it), and the Compare-pick listeners that register at load (`applyComparePick`, `compareHref`). **God mode stays too:** it isn't a separate block but part of `renderDetail` and the shared grading every tip card uses, so moving it would make ordinary server views load a lazy file.
- **Measured** (first load, mocked API, local server): index.html **513 KB → 406 KB raw, 137 KB → 109 KB gzip** (−28 KB on the wire; builder.js is 27 KB gzip, admin.js 4.5 KB, fetched only when used). DOMContentLoaded median over 15 runs: 191 → 175 ms unthrottled, 670 → 570 ms with 4× CPU throttling (a mid-range phone).
- **Browser check** (Playwright, mocked API, 390 and 1280 px): home, server page, builder, custom tip, the NBA prop picker (Add puts a leg in the tray) and Paste sheet Preview, on 0.40.1 and 0.40.2: 0 page errors; screenshots pixel-identical (one 1280 px server-page strip differed only run to run, on both builds); home and server pages fetch neither file; opening the builder fetches `builder.js?v=…` once and Preview fetches `admin.js?v=…` once.
- Tests: **50 → 56 passing** (+6 `split.test.js`: the lazy files compile, stay sloppy-mode and aren't in any `<script src>`; `TD.version` = `VERSION`; placeholders vs real entry points and no name clashes; the loader run for real (one fetch for a double click, arguments passed, failed load toasts and can retry, no loop when a file lacks its function); and a smoke run of the real page scripts plus the lazy files in a fake DOM with a mocked API: home, server page, builder, custom tip, NBA picker and Paste preview open, lazy files fetched only on first use). `lines.test.js` and `espn_props.test.js` now read the builder code from `assets/builder.js`, with the same assertions.

## 0.40.1 · 2026-09-29 · `nba-props` · NBA/WNBA player props in the builder (Claude, Phase 2.1)

Needs TipBot 0.40.1 for the props; older TipBot keeps working (see below). Grading is TipBot's and ships OFF there.
- **The NFL prop picker is reused for NBA and WNBA.** Opening an NBA/WNBA game now loads the roster from TipBot `GET /api/espn/players?league=…&event=…` and shows the same tabs, sliders, Over/Under and Add row as NFL, with the five markets TipBot grades: Points, Rebounds, Assists, Threes Made, Points + Rebounds + Assists. Legs carry `player_id`, `prop`, `line`, `side`, `league`, `espn_event_id` and `game_id`, the same shape as NFL legs, and get the half-point rule like every player prop. "＋ Free text" still opens the match-pick box for free-text selections on the same game.
- **Older TipBot:** if `/api/espn/players` isn't there (404), the game opens the free-text pick as before, with "player props need TipBot's latest deploy" and Retry.
- **Fixed (NFL too):** the prop picker's Add buttons were never wired. Since `f5a94cf` the wiring loop read an undeclared `q` and threw right after the rows were drawn. The render and the wiring now share one player list (`visiblePlayers`), so search can't shift which row a button belongs to.
- League differences live in `assets/espn-props.js` (`TBEspnProps`): prop tables (NFL values unchanged), roster URL, the NFL-only skill-position filter, and the leg builder. No theme or design work.
- Tests: **42 → 50 passing** (+8 `espn_props.test.js`: prop tables, roster URLs, player lists, leg shape, market labels, index wiring and the missing-endpoint fallback, plus the real `paintEspnNflPlayers` run against a fake DOM for NBA and NFL; the NFL case throws "q is not defined" on 0.39.2).

## 0.39.2 · 2026-09-29 · `hide-master-home` · TipBot Master Server hidden from the home servers list

- The home servers list (and the one-server auto-open) skips the configured master guild. The id comes from the owner's `/api/master/config` (`config.master_guild_id`), with the known id `1553952007923040309` covering the first paint; never matched by name. View-as, the ⚙ menu and the Master pages (`/master/`) are unchanged, so the master server is still reachable there.

## 0.39.1 · 2026-09-28 · `slip-import` · Slip import card (Claude, Phase 1.3)

Needs TipBot 0.39.1. Off by default.
- **Master → Overview → Slip import** card (`assets/slip-ui.js`): the Slip import on/off switch, the #slips channel picker (master server channels), the default target server (with its unit size), and status: vision key set yes/no, model, drafts today and approximate spend (today and this month). Saves to `POST /api/owner/slip-import/settings`. A missing endpoint shows "This needs TipBot’s latest deploy." with Retry.
- No theme or design work: existing master card, switch, select and stats styles.
- Tests: **38 → 42 passing** (+4 `slip_ui.test.js`). Mocked browser check of the Overview tab at 390 and 1280 px: 0 page errors, no horizontal scroll.

## 0.38.1 · 2026-09-28 · `consensus` · Consensus tab + shared half-point helper (Claude, Phase 1.2)

Needs TipBot 0.38.1. Consensus ships OFF (on = false, dry run = true).
- **Master → Consensus tab** (`assets/consensus-ui.js`) replaces the placeholder: the Consensus on / Dry run / Paused switches (each with a confirm; turning dry run off needs the beta on and a verified master), the settings form (minimum servers, minimum % of active servers, window, line tolerance, before-start rule, multi legs, sports, what the post shows) and a **live "what would qualify right now" preview** (`GET /api/consensus/preview` with the unsaved values). A missing endpoint shows "This needs TipBot’s latest deploy." with Retry. The Overview status pill shows Consensus on only when it is on with dry run off.
- **Half-point rule moved to `assets/lines.js`** unchanged (`applyHalfPointLine`, `normalizePropLines`, `lineAdjustNote`); `index.html` calls it, so builder behaviour is identical. TipBot now has a Python twin, checked by the shared `tests/fixtures/half_point_vectors.json` (same bytes in both repos).
- No theme or design work: existing master card, switch, pill, stats and table styles.
- Tests: **28 → 38 passing** (+4 `lines.test.js`: shared vectors + wiring; +6 `consensus_ui.test.js`: form validation, preview query, missing endpoint, rendering, tab wiring). Mocked browser check of the Consensus tab at 390 and 1280 px: 0 page errors, no horizontal scroll.

## 0.37.1 · 2026-09-28 · `sport-routing` · Sport routing popups + settings (Claude, Phase 1.1)

Needs TipBot 0.37.1. **Nothing changes until a server turns on sport routing** (`feat.sport_routing`, default off).
- **Post-time decisions** (`assets/routing.js`). Before the confirm step of Review/Schedule, custom tips and batches, tipdash asks `POST /api/routing/preview` where each tip goes. One channel: no popup, just a chip on the confirm (“→ #afl-plays”). Rules clash (several tags/channels, not “post to all”): a popup lists each candidate channel with why it matched, checkboxes, and “Remember this choice” (admins). More than one channel in the end (including a “post to all” rule): a confirm popup lists the channels. Nothing matched: “Post to #tips (default) / pick a channel / cancel”. The choice travels with the tip as `route`; TipBot re-checks it. Batches ask per tip, only where needed.
- If routing is off, the endpoint is missing (older TipBot) or the preview fails, the tip is sent exactly as before (no `route`, TipBot decides).
- **Settings → Channels → Sport routing (beta)**, below the existing routing list: the “Enable sport routing (beta)” switch (existing feature-flags endpoint), the default channel (the Tips picker), a tag table (on/off, channels, keywords, priority, “Ask” / “Post to all”), add/delete custom tags, the multi-sport mode, the non-interactive rule, remembered choices with Delete, and a test box. Saves to `POST /api/routing` (server admins). A missing endpoint shows “This needs TipBot’s latest deploy.” with Retry.
- `assets/sport-keywords.js`: the keyword matcher, identical to TipBot’s (shared vectors in `tests/fixtures/sport_keywords_vectors.json`), used for live keyword validation (50 terms, 60 characters).
- No theme or design work: the popups reuse the countdown-confirm sheet styles (`NDCountdownConfirm.injectStyles` is now exported), and the settings reuse the existing panel/feature-row/select styles.
- Tests: `node --test tests/*.test.js` **15 → 28 passing** (+4 `sport_keywords.test.js`, +9 `routing.test.js`: single, conflict, multi-confirm, none, cancel, batch, and missing endpoint / routing off / network error). Local mocked browser check at 390 and 1280 px: 0 page errors.

## 0.36.1 · 2026-09-28 · `forwarding-1c` · Forwarding tab (Claude, Block 1C)

- `master/index.html`: the placeholder **Forwarding** tab (previously labelled "phase 1C") now shows the global **Forwarding on** and **Paused** switches (`POST /api/master/config`, each with a confirm), a status panel (forwarded / queued / retrying / gave up / queue depth / duplicates found / last error) and a per-server table (channel, Active or No Longer Active, per-server toggle via `POST /api/master/forward/source`, last forward, counts).
- If `/api/master/forward/status` is missing (TipBot not deployed yet) or errors, the tab shows "This needs TipBot's latest deploy." with a Retry button. The switches are disabled while `MASTER_BETA_DISABLE` is set, beta is off or no master is verified.
- No theme or design changes; it reuses the existing card, stats and access-table styles.
- **Versioning (new).** `VERSION` file (`0.36.1`) and `VERSIONING.md` (the bump rule for every merge to `main`). The version shows at the bottom of the ⚙ Settings menu (`tipdash v0.36.1`). History replay put `main` at 0.35.3 after #88, so this merge is 0.36.1.
- Tests: `node --test tests/*.test.js` **13 → 15 passing** (+2 in `tests/version.test.js`: VERSION format, and the Settings-menu label and CHANGELOG match it). Local mocked browser smoke at 375 and 1280 px (normal, toggles, 404): no horizontal scroll, 0 page errors, and the two POST bodies were as expected.

## 2026-09-28 · `p3-dash-notes` · Phase 3 assessment + remaining list (Husker)

- **#5 (split the builder/admin JS): assessed, not done.** `index.html` is 510 KB raw but **139 KB gzip on the wire** (Pages sends `content-encoding: gzip`, `max-age=600`). The 431 KB main script is one closure: 347 top-level functions, and the builder alone references `BUILD` 436×, interleaved with shared `STATE`, `api`, `$` and `esc`. Moving it to on-demand assets safely means first exposing that shared state through a small module boundary, then a browser pass over every builder/admin flow with an owner token. That is a ~1–1.5M block, not a small safe change for an unattended night, so it is scoped in REMAINING.md.
- `REMAINING.md` updated after phases 2/3.
- No code changes; tests still **13 passing**.

## 2026-09-28 · `p2-dash-request-pool` · Fewer overlapping requests (Husker, P2b)

- **All communities** now loads at most 4 communities at a time (`ROLLUP_CONCURRENCY`) instead of firing `/api/follower` for every follow at once. Results keep their order, so the merged rollup is unchanged.
- **In-flight GET dedupe** in `api()`: identical plain GETs (same path, token, retries and timeout) already in flight share one request, and each caller gets its own `Response.clone()`. Mutations, custom headers and signals, and `onAttempt` callers are never shared. Finished requests are not cached, so the next call hits the network as before.
- **Builder live refresh** no longer stacks. A 30 s poll tick or a ↻ tap while the previous refresh for the same game is still running waits on that one instead of starting another.
- The helpers live in `assets/req-pool.js` (`mapLimit`, `createDedupe`, `singleFlight`). `index.html` falls back to the old behaviour if the file fails to load.
- Tests: `node --test tests/*.test.js` **13 passing** (+5 in `tests/req_pool.test.js`). Local mocked browser smoke at 375 and 1280 px: 7 follows → 7 requests, peak 4 in flight, rollup rendered, 0 page errors.

## 2026-09-27 · `b2-landing` · Landing (Husker)

Landed Claude's feature-pass UI and Codex's Master access/audit tabs on top of `f98decb`. There are no tipdash code changes of my own. What I checked:
- `FEATURE_COMPARE` and `FEATURE_HEATMAPS` still default to `false`. They can only be turned on per browser with `?compare=1` / `?heatmaps=1`.
- The master beta switch, "Set as master", lockdown apply and whitelist removal each ask for a `confirm()`.
- The Master page's `?api=` override only works on localhost.
- Codex's CRLF line endings were converted back to LF in CHANGELOG/REMAINING.
- `node --test tests/*.test.js`: **8 passing**. TipBot backend lands first (828 passing on Linux with libsql).

## 2026-09-27 · `master-access-ui` · Phase 1B companion (Codex)

The Master page now has functional Lockdown & access and Audit log tabs, using the existing theme tokens and owner-only backend.

**Changes**
- Separate default-role checkbox, per-channel human-readable permission diff, explicit apply confirmation and expiring review token. Changing the choice or whitelist invalidates the shown review.
- Whitelist add/edit/remove, default read-only, channel/category/source scope IDs kept as strings, queued-action status refresh and pause-repair control.
- Administrator bypass warning, member count, audit-event filter and pagination. Missing endpoints show a deploy-needed message; network failures are handled.
- Beta switch confirmation added; mobile whitelist entries stack without page overflow. No existing theme was redesigned.

**Validation**
- `node --test "tests/*.test.js"`: **8 passing** (5 inherited + 3 new); tests cover exact ID parsing and escaping.
- Headless Chrome 375px/1280px: preview/confirm/apply, queue status, whitelist DELETE, audit, missing endpoint; clean console on normal flows and no page overflow. All API responses mocked locally.
- Companion TipBot suite: 819 passing.

**Unplanned / extra**
- Brandon authorized local snapshot + Claude overlay as the base. No GitHub main merge was assumed.
- These two tabs were brought forward from block 3 to make block 1B usable. Beta confirmation covers one of Husker's planned landing fixes.

**Skipped / deferred**
- Forwarding and Consensus tabs remain placeholders for their corresponding backend blocks.
- No PR/deployment, live flag changes, domain edits or visual redesign. Real Discord behavior needs Ray's M3–M7 test-guild script.
- Source scopes take effect when phase 1C creates forwarding mappings. Whitelist expiry remains an unapproved proposal.


## Summary of this build (2026-09-27 AEST, Claude)

- **Base:** `f98decb` (PR #84). **Tests:** `node --test` 5 passing (new harness for the clock helper). Browser-checked at 375 px, 1200 px and in all three themes.
- **Flags left OFF:** `FEATURE_COMPARE`, `FEATURE_HEATMAPS` (both have `?x=1` dev overrides). The master beta is off on TipBot, so the Master page shows everything off.
- **Codex:** all new UI uses existing tokens and semantic classes, with no inline colours. See each PR's "UI notes for Codex".
- **Known gaps:** see `REMAINING.md`.

---

## 2026-09-27 · `trial-mode` · Feature G UI
- Server detail (**owner only**):
  - "Trial mode (follower tracking off)" switch, plus an expiry date (a Sydney day; the trial ends at the end of that day) and an "On expiry" select;
  - a Save button;
  - confirm dialogs that explain follows are kept, and that there's no backfill.
- Badges `.badge.trial` ("TRIAL · expires 12 Oct") and `.badge.trial-expired` on the server list card and the switch label.
- Follower view: `.trial-banner` "Tracking is off during this server's trial…".
- Calls `POST /api/server/trial`.
- **Skipped:** no header badge outside the switch row (the card badge plus the switch label cover it).

## 2026-09-27 · `master-page` · Master page (Phase 1-UI, first slice)
- New **`master/index.html`** (owner only; non-owners get "Owner only").
- Tabs:
  - **Overview:** beta switch, status pills (lockdown, forwarding and consensus show "not built yet"), sources count, and the master plus when it was verified.
  - **Master server:** candidate list (ineligible greyed with the reason; OLD MASTER / CURRENT tags), Run verification, the ✅ / ❌ / ⚠️ / ℹ️ checklist with fix hints, and **Set as master** (enabled only when every required check passes; TipBot re-verifies).
  - **Lockdown**, **Forwarding**, **Consensus** and **Audit** are placeholder tabs saying "not built yet".
- Owner gear → "Master server (beta)" link (`#dd-master`, owner only).
- UI classes for Codex: `.tabs .tab[aria-selected] .soon`, `.card`, `.pills .pill.on/.off/.todo`, `.stats`, `.switch`, `.cands .cand[aria-pressed] .tag .why`, `.checks .check[data-state=pass|fail|warn|info] .ic .lb .lv .dt .fx`, `.banner.ok/.err`.

---

## 2026-09-27 · Feature pass, five PRs (details in each drop's `PR_NOTES.md`)
- **`live-page`:** new standalone `live/index.html` (games board, sport and server filters, game centre, tips per game, signed-out mode); a Live link in the top nav.
- **`heatmaps`:** `HeatmapCard` on `/live` behind `FEATURE_HEATMAPS` (off).
- **`sydney-time`:**
  - new `assets/tbtime.js` (shared Sydney clock) and `tests/tbtime.test.js`;
  - theme day/night, the calendar day sheet, Scores / fixtures / ESPN times, the quota "as of" and the draft banner all use Sydney time;
  - fixes Scores showing AFL starts ~10 h early.
- **`signup-gate`:** the "I'm in Australia" declaration screen (`#signup=`), the `region_declined` message, and the owner Settings row (toggle plus per-user Allow / Block / Clear).
- **`compare`:** `compare/index.html` rebuilt (best value across SB / PB / Ladbrokes, line table, Use in builder); the builder's Compare link sends the game name, line and side; the builder receives picks through localStorage.
- **Unplanned / extra:** the Scores time bug fix; the builder Compare link fix (it was sending an id the odds cache can't resolve).


## Summary of this build (Codex continuation)

Lockdown & access and Audit log are usable with the phase 1B backend. Eight unit tests and desktop/mobile browser checks pass. All feature defaults are unchanged.
