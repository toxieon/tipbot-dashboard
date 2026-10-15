## 0.64.3 · 2026-10-15 · `aflw-live-tips` · AFLW tips stay on the live list

- Pending and recently settled tips tagged AFLW are included with AFL on the live-tips panel and the full-time footer. Other sports stay off that list.
- AFLW fixtures and the live player snapshot were already loaded. This only stops those tips being dropped before the games are matched.

Tests: `tests/test_live_tips_aflw.py`.

## 0.64.2 · 2026-10-15 · `follower-game` · Follower bets for one game

- `GET /api/follower/game?guild_id=&game=` returns the legs a follower holds on that game, with live progress from the existing AFL and ESPN snapshots.
- Access matches the follower view: a follower of the server, or someone who can already open it. Anyone else gets no access.
- Pending, hit, and miss are the card states. A settled single with no live source uses the tip result.

Tests: `tests/test_follower_game.py`.

## 0.64.1 · 2026-10-15 · `studio-v2` · Owner sponsor studio matches the approved layout

- The studio is one in-app page from Owner settings, with ← Back. It does not open a new tab. Signed-out callers and anyone who is not the platform owner still get 404. Top-down, 3D view, LED boards, and Ball sponsor are the four tabs. The library deletes and replaces in place. A card opens the sponsor drawer (a bottom sheet on a phone) with contact, contract, payment, click URL, notes, status, and Linked servers. Save is one button, with unsaved, saving, and saved states, and leaving with unsaved changes asks first.
- Ground logos drag and resize freely. The dashed guides only snap the position on release, within 6 m. They do not lock width, height, or rotation.
- Each LED sponsor is one rectangular banner. That image fills every board for its turn (10 to 60 seconds), then the next sponsor does the same. Percentage is the share of that featured time and is scaled to 100%. A turn already saved at 8 seconds still plays.
- A linked-server win still pulses the logo. A transparent logo gets a green outline glow, fireworks, and a floating units label. The follower bet card is a green flash and a short pulse. Test win animation still plays it without recording a bet.
- Up to two ball sponsors share goals by alternating, by quarter, or one per game. When the live score jumps by a goal, the camera moves to that end and a ball carries the sponsor through the posts, then a banner names them. Test goal animation plays the same sequence. With none active, the ball is plain red.
- Owner settings can load any upcoming game as a follower demo. That choice is owner preview only. Followers keep the game they have open, and the public sponsors payload is unchanged apart from the ball list. Existing sponsor images, linked servers, and the wins route stay in place.

Tests: `tests/test_sponsors.py`, `tests/test_ground_sponsors.py`, `tests/test_rotation_schedule.py`, `tests/test_sponsor_wins.py`, `node --test tests/js/sponsor_wins.test.js tests/js/rotation.test.js tests/js/ground.test.js`.

## 0.63.9 · 2026-10-15 · `espn-link` · Server links basketball and NFL tips to ESPN

- Queue, import, slip import, and the web-queue drain match an NBA, NBL, WNBA, or NFL tip to one ESPN event when the payload has no event id. One match stores the event id, the full start time, and stamps each leg. No match, or more than one, still queues the tip as unlinked.
- Custom slip lines for basketball props (points, rebounds, assists, threes, PRA, steals, blocks), NFL props, head-to-head, line, and total are parsed, and the custom flag is dropped. Today and Tomorrow kickoff lines are not stored as legs.
- The platform owner can preview with `GET /api/owner/relink` and apply with `POST /api/owner/relink`. A background pass does the same about every 10 minutes for open tips from the last 14 days. Odds, stake, and result stay as they are. A failed link logs one line and queues one owner DM per tip. Inspect `/tips` adds `link_status`.
- A kickoff line already stored on a tip is flagged (`kickoff_line`) when that tip is linked. Auto-grade skips the flagged row, so the remaining legs can settle.

Tests: `tests/test_espn_link.py`.

## 0.63.8 · 2026-10-15 · `simpler-studio` · A field you can actually use

- On a desktop the studio is two panes. The field is on the left and the controls are on the right, including at 1024, 1280, and 1440 pixels wide. On a phone the field sits on top and the page scrolls. Controls stay on screen instead of being stuck under the 3D view.
- The studio uses the same theme as the rest of tipdash. Navy, Day, Ochre, and the Apex variants (Light, Black, Mono, Ochre) come from the page you already have open.
- Upload any PNG, JPG, WebP, or GIF up to 10 MB. It is fitted to the slot, the aspect ratio stays, and transparency stays. A file that is the wrong pixel size is no longer rejected.
- The main view is the top-down field. Drop an image and it lands on the grass. Drag it. Near the centre, a 50 m arc, a wing, or a flank, it snaps. A corner handle resizes it. Remove takes it off. 3D preview is the other button on the field.
- The selected logo has Linked servers. A win from one of those servers lights that logo: a transparent logo gets a green edge glow and sparks, and any logo gets a rising label such as +2.5U. A solid image gets a green border. Test win animation still plays it without recording a bet.
- A sponsor upload may be about 10.5 MB, so a 10 MB file and its form wrapper are accepted. Width and height are checked before the pixels are decoded. An animated GIF is capped at 60 frames and about 4 million pixels a frame, decoded once, and written out again so comments and other extensions are not stored.

Tests: `tests/test_sponsors.py`, `tests/test_ground_sponsors.py`, `node --test tests/js/sponsor_wins.test.js`.

## 0.63.7 · 2026-10-15 · `sponsor-wins` · Linked servers and a win animation

- Each sponsor in the studio has Linked servers: a multi-select of the servers TipBot is in. The choice is stored on the owner routes, and a server that is not one of those is rejected.
- When a bet or tip from a linked server settles as a Win, that sponsor's logo pulses and a label such as +2.5U rises and fades over about 3 seconds. The units are the graded profit. The studio preview and a 3D stadium scene pick this up by polling a recent-wins feed that carries the sponsor, the units, and nothing else.
- Test win animation plays that same preview on the sponsor you pick. The units field defaults to +2.5U. It does not record a bet or post anything.
- The game wins feed stays owner-only, including when public game sponsors are on. A server that has left is left out of the read, and the linked-server filter is inside the wins query.

Tests: `tests/test_sponsor_wins.py`, `node --test tests/js/sponsor_wins.test.js`.

## 0.63.6 · 2026-10-15 · `studio-emblems` · Game emblems, and the studio is its own page

- Club emblems follow the fixture. When one game is selected in the studio, and in any game-specific 3D render, the two discs show that game's home club at one end and the away club at the other, using the 18 emblem models already in the models folder. Names match through the usual aliases (GWS and Giants, Brisbane Lions, St. Kilda, and the rest). The Emblems on field toggle still hides them. With no game selected, the discs stay off.
- Owner settings no longer embeds the studio in a card. Cogwheel, Owner settings, Sponsor studio opens the studio as its own view in the same tab, with ← Back and a history entry so an iPhone home-screen swipe returns to the previous view. It does not call `window.open` or use `target="_blank"`.
- LED rotation is edited on the studio Boards page. Each sponsor has a share of appearances in one cycle (whole percents that total 100) and a hold in seconds (default 8, from 2 to 60). A longer hold does not add appearances; it only makes each turn longer. The order is the sequence: drag a row, or use Up and Down. Auto-balance splits 100% evenly, and the live total turns bad until the shares add to 100. A bar shows one full cycle, each block as wide as that appearance's seconds. The 0.4 s wipe stays between appearances. The 3D boards play that expanded cycle. The server rejects a mix that does not total 100, a share outside 1–100, or a hold outside 2–60.

Tests: `tests/test_club_emblems.py`, `tests/test_sponsors.py`, `tests/test_rotation_schedule.py`, `node --test tests/js/rotation.test.js`.

## 0.63.5 · 2026-10-15 · `ground-sponsors` · In-app sponsor studio, then painted ground logos

- The sponsor studio stays inside tipdash. Cogwheel, Owner settings, Sponsor studio loads `GET /api/owner/sponsors/embed` with the owner's normal session and paints it in the page. It does not call `window.open` or leave a home-screen app for Safari. The per-server Admin Tools button is gone: the studio is global, not one server's tool. A signed-out caller and anyone who is not the platform owner still get 404 on that route. Non-owners who open `/o/<OWNER_STUDIO_SLUG>` are still redirected to https://tipdashhq.com/. The same rate limits, Origin checks, and GIF caps stay.
- On a phone the page scrolls. The 3D view is 40vh, sticks to the top, and a vertical swipe scrolls the page instead of orbiting. Controls stack full width, including the model select. Sponsor upload, edit, per-game multi-select, all-future assignment, LED boards, and ground slots stay on the page.
- The stadium loads one model at a time and disposes the previous one. Pixel ratio is capped at 2 (1.5 on a phone). Rendering pauses when the view is hidden or off screen. Phone scenes use fewer ring segments, a smaller stand texture, and no light cones.
- The owner studio (`/o/<OWNER_STUDIO_SLUG>`, same `tipbot_studio` cookie, rate limits, and same-origin Origin checks) has a Ground section beside the LED boards. A top-down field lets the owner snap an uploaded logo onto a preset, or drag it anywhere on the grass. Presets are the centre (24×8 m), the two 50 m arcs (18×6 m), and eight wings and flanks enlarged to 14×4.7 m. Club emblem discs stay locked and are not an upload.
- A free placement is 4–30 m wide and 2–12 m tall, aspect 1:1 to 5:1. Rotation snaps to 15° (Shift keeps the angle). Dropping within 6 m of a free preset snaps onto it. Placements stay 3 m inside the boundary, off the centre circle, the goal squares, the 50 m arcs, and 1 m clear of the emblem discs. Two logos cannot share a slot or overlap.
- Ground uploads are PNG with a transparent edge, at the slot's pixel size (centre 2400×800, arc 1800×600, wing and flank 1500×500), 2 MB or smaller. Width, height, and alpha are read from the header before the image is decoded. The LED GIF frame cap and the LED pixel cap are unchanged. Wrong-aspect art is letterboxed, not stretched.
- In the 3D view the logos sit on the grass at 0.85 opacity (60–95% in the editor), with an 18% grass-streak multiply, under the line markings. They use the same rotation as the LED boards: one game, several games, or all future games. Public game sponsors and the LED slides skip ground art.
- Each paintable slot has a downloadable template (PNG, SVG, PDF, and a zip) and a line in the sponsor specs. Emblem slots have no template.

Tests: `tests/test_ground_sponsors.py`, `node --test tests/js/ground.test.js`.

## 0.63.4 · 2026-10-15 · `connector-hardening` · Busy cursor saves and an empty-feed owner alert

- Saving the connector cursor during a poll retries a busy dashboard three times (0.2s, then 0.4s).
- Recording a poll failure uses the same retry. If the dashboard stays busy, that handler returns instead of raising another busy error, so the rest of the pass continues.
- An enabled connector that returns no items for 24 hours DMs the owner once. The clock starts when the connector was created, or at the last item the feed returned. `empty_alert_hours` sets the window per connector (`0` turns it off). The next empty stretch sends one more DM, not one per poll.

Tests: `tests/test_connectors.py`, `tests/test_connector_health.py`, `node --test tests/js/connector_panel.test.js`.

## 0.63.3 · 2026-10-15 · `studio-export` · Studio ticket test accepts a locked database export

- Render sets `DB_SYNC_KEY`, so `GET /export/database` without that key is 403. `test_studio_ticket_sets_host_cookie` clears the key for the test and treats 403 as a refusal, the same as 401 and 404. A studio cookie still does not open the export. The export check itself is unchanged.

## 0.63.2 · 2026-10-15 · `studio-session` · Owner studio keeps a session on this host

- Opening the studio from tipdash was a 302 back to tipdashhq.com. The tipdash session lives in that site's page, so a top-level visit to the bot host arrived signed out. Admin Tools, owner only, now has Owner studio. It asks `POST /api/owner/studio/ticket` for a 60-second single-use signed ticket and opens `/o/<slug>?t=<ticket>`. The page checks the ticket, stores a studio grant (owner id only, no guild or admin scope, 12 hours) separately from dashboard sessions, sets an HttpOnly Secure SameSite=Lax `tipbot_studio` cookie with `Path=/o/<slug>`, and returns a same-origin page that replaces the address with the clean path. The grant is not sent on a 302.
- The studio's model and data routes live under that same prefix, so the cookie is sent only there. Studio writes are POST and require a same-origin Origin. GETs do not change state. Every other route, including `/export/database`, God mode, and owner tools, ignores the studio cookie and a studio-scoped token.
- A visit with no grant goes through Discord login and returns to the studio. The callback sets the same scoped cookie for the platform owner and does not issue a dashboard session. A signed-in server owner or admin is still redirected (302) to https://tipdashhq.com/. Routes outside the slug stay 404 for the studio grant. The per-IP and per-session limits, and the slug-guess lockout, are unchanged.

## 0.63.1 · 2026-10-15 · `sponsors` · Owner sponsors studio and stadium boards

- The sponsors studio is served by TipBot at `/o/<OWNER_STUDIO_SLUG>`. The slug is an env var of 32 or more url-safe characters. A missing value, or one shorter than 32 characters, is refused: every `/o/` path is a 404, the same as a route that does not exist. The platform owner, signed in, gets the page. A signed-out visitor, a server owner, or an admin who opens that page is redirected (302) to https://tipdashhq.com/. Model and data routes stay a 404. The path is not written to the request log.
- The page is a night view: the designer's 3D model fills the top 60%, and the library and schedule sit in two columns under a live LED strip. Open all models lists every `.glb`, with MCG first. A quiet link opens the existing owner controls. tipdashhq.com loads that document for a long `/o/` address; the studio itself is not in the public repo.
- Club emblems lie flat on the grass, one in each half, just above the turf. Each mark is about 38 m across so it fills most of that half, and it is drawn unlit so the colours stay readable at night. They stay off the LED boards. The owner toggle Emblems on field is on by default. The marks are read from the models folder when those files are present.
- The night view loads the designer's meshopt `mcg.glb` (about 40 KB) with three's MIT MeshoptDecoder. The look is ported from `v5.js` (stand crowd, light banks, ground markings, goal posts) and from `boards/boards.js` (two-sided perimeter ring plus the stand ribbons in `boards.json`). Sponsor art is that file's slides. Ribbons use its offsets. Models are not recompressed here. Drop files in `afl_tipster_bot/ops_ui/models/` (override with `SPONSOR_MODELS_DIR`) and list them in `manifest.json`. The studio loads each one from `GET /o/<OWNER_STUDIO_SLUG>/models/<file>`, and the catalog from `.../models/manifest.json`. Both require the platform owner. A missing file returns a small placeholder glTF with `X-Studio-Placeholder: 1`. The old `/api/ops/studio/models/` and `/api/owner/sponsors/models/` paths are 404. Private logos and the ball stay out of the repo; drop them in that folder and they stay on the owner route.
- Club logo models, anything under a `private/` folder, anything under `private-real`, and the ball models are served only to the platform owner. `GET /api/stadium/scene`, `GET /api/stadium/models/*`, and `GET /api/stadium.js` are owner-only as well and 404 for everyone else. A public copy of the live scene is not sent when that scene names private files. The stadium script does not reference them. They are not part of the public dashboard.
- Uploads are PNG or GIF at 1920×120, or 3840×240 for @2x, and 2 MB or smaller. Width and height are read from the file header before the image is decoded. A GIF with more than 240 frames, or whose canvas times its frames exceeds the pixel cap, is rejected. Pillow's pixel limit is tightened to the @2x canvas for that check. The edge must be a solid, non-transparent colour. Contrast under 4.5:1 and mostly-dark art are warnings. GIF bytes are stored as uploaded. Playback holds each sponsor for 8 seconds on every panel, then a 0.4 second wipe. Drift at 40 px/s is off unless the editor turns it on. GIFs play inside the hold and stop at 8 seconds.
- A rotation follows the editor order. It can be assigned to one game, to several games, or set as the default that later games inherit until a game has its own row.
- The template download is `tipdash-led-template-1920x120.zip`: a 1920×120 PNG, a layered SVG (cyan safe area, bleed, centre line), and a one-page SPEC.pdf.
- `/auth/callback`, `/o/<OWNER_STUDIO_SLUG>`, and `/api/owner/*` are limited to 30 requests a minute per IP and, when someone is signed in, per session. Sponsor image uploads are 10 a minute. Over the limit is 429 with `Retry-After`. Eight wrong studio slugs from one IP lock that IP out of `/o/` for 60 seconds.
- `GET /api/games/{id}/sponsors` is owner-only for now and returns 404 to everyone else. Set `PUBLIC_GAME_SPONSORS=1` when the public stats page should show sponsor images to any signed-in session. `GET /api/stadium.js` is owner-only too. It loads the designer's GLB (three.js MIT, r160, meshopt or Draco) and paints the sponsor rotation onto the existing LED board meshes. Thinner ribbons keep the 16:1 art at about 24:1 by extending the edge colour. Night boards glow about 1.6×, day boards about 1.1×, with scanlines, a night bloom, and blacks clamped to #0a0a0a. `GET /api/owner/sponsors*` returns 404, not 401, when nobody is signed in.

Tests: `tests/test_sponsors.py`.

## 0.62.10 · 2026-10-15 · `slip-post` · Date lines are not legs, and slip images carry the server name

- A kickoff line (Today, Tomorrow, or a weekday plus a date and time) is not a leg. It is dropped when a tip is queued, when a queued tip is posted, and when an already-stored tip is rendered. The Discord legs list is numbered from the remaining legs, so it matches the slip's leg count.
- Screenshots attached from Build or a slip import are stamped with the server name before they are posted. The same stamp is used for immediate, delayed, and batch posts.

Tests: `tests/test_slip_datetime.py`, `tests/test_slip_schedule.py`.

## 0.62.9 · 2026-10-14 · `slip-schedule` · Player props schedule without a hard player id

- Queueing an NFL, NBA, WNBA, NBL, MLB, or soccer player prop no longer fails with "props need player_id". The roster is matched by name before the database write. A miss keeps the player name and returns one warning. A match, line, or total does not need a player.
- First touchdown and double-double are recognised markets. Match betting and money line grade as head to head.

Tests: `tests/test_slip_schedule.py`, `tests/test_nba_autograde.py`.

## 0.62.8 · 2026-10-14 · `connectors` · Post latest tip releases the database during the fetch

- Post latest tip was failing with "dashboard db busy" when a poller held the dashboard database. The feed fetch and the racing lookup now run with that lock released. The queue insert and the `test_post` log are one short priority write, with the same busy retry as a connector save, so the button is not stuck behind the poller.
- Test connection and dry run save the auth style after the fetch, on that same priority path. Opening a connector route takes its first read on the priority path too.

Tests: `tests/test_connectors.py`.

## 0.62.7 · 2026-10-14 · `connectors` · Post latest tip

- Owner-only Post latest tip (`POST /api/connectors/{id}/post-latest`) fetches the feed with no since cursor, posts the newest tip once to the target channel labelled as a test, and logs `test_post`. It does not move the cursor. A later real post of that id edits the test message. An empty feed returns "Feed has no tips right now".

Tests: `tests/test_connectors.py`, `node --test tests/js/`.

## 0.62.6 · 2026-10-14 · `db-busy` · Background pollers yield; connector saves go priority

- Background pollers (grade worker claim, connector due list, racing finals backfill and sweep) wait briefly for the dashboard DB worker, then skip the pass quietly and retry on the next one instead of logging DashboardBusy.
- Connector create, update and toggle take the DB worker as a priority job with a longer wait (8s), on top of the existing retries, so a save wins over background work.
- The grade queue schema runs once and waits for the worker on boot instead of failing.

Tests: `tests/test_db_busy_background.py`.

## 0.62.5 · 2026-10-14 · `db-busy` · Connector schema once; busy saves retry

- The connector tables are created once per process (and again after a reconnect) instead of on every connector read and poll pass. On the HTTP driver that rerun held the single dashboard DB worker long enough that other dashboard calls, including saving a connector, failed with "dashboard db busy".
- Creating, updating and toggling a connector retry a busy DB with backoff (0.25s, 0.5s, 1s). A retried create reuses its id, so it cannot insert twice.

Tests: `tests/test_connector_schema_once.py`, `tests/test_connectors.py`.

## 0.62.4 · 2026-10-14 · `owner-tools` · Access and Connectors linked from Admin Tools

- Admin Tools on a server gains an Access & Connectors section between Give me admin and God mode. Each button opens that tab in the server's Settings panel (expanding it if collapsed).

Tests: full suite.

## 0.62.3 · 2026-10-14 · `audit` · Connector poll and secret scrub

- The connector poll grades and retries with a few batched reads, and only looks again at tips that are not already compared. A page of tips is loaded once. Old event rows are deleted once per poll.
- Upstream auth failures no longer return the response body. Logs, stored errors, event text, and connector responses strip query keys, bearer tokens, and `api_key` values.
- Connector column adds run again from the bot database open, and a second run does not fail when the column is already there.

Tests: `tests/test_connectors.py`.

## 0.62.2 · 2026-10-14 · `owner-access` · Per-server access list and global product switches

- Owner-only Access API for one server: who can open its dashboard (admins/mods, then followers and members with dashboard access), add or remove a manual mod, optionally give or take the TipBotAdmin role, and search members for the picker. Non-owners get 404, the same gate as God mode and Give me admin. Changes are written to the audit log. `GET /api/owner/access/audit` pages that log (who, actor, add/remove mod, role change, timestamp). Who counts as an admin elsewhere is unchanged.
- Owner-only global flags `marketplace_enabled` and `build_tips_enabled`, both on unless the owner turns one off. Stored in `platform_settings` (not per server). `GET` and `POST /api/owner/global-flags` are owner-only. Every signed-in client sees the effective values on `GET /api/me` as `global_flags`, so tipdash can hide those menus. With a flag off, the marketplace routes (`GET /api/discover`, `POST /api/portal-opt-in`) or the build-tips routes (`POST /api/queue-tip`, `POST /api/queue-tips`, `GET /api/queue-status`) return 404 for non-owners. The owner can still call them. Per-server feature flags are unchanged.
- Public `GET /api/config` returns the same `global_flags`, no session needed.
- The owner Access panel and the Global switches UI ship in the owner-only ext bundle (`ops_ui/owner-access.js`, `ops_ui/owner-flags.js`).

Tests: `tests/test_owner_access.py`, `tests/test_global_flags.py`, `node --test tests/js/`. Contract: `docs/owner-access-api.md`.

## 0.62.1 · 2026-10-14 · `connectors` · Health alerts, source stats, and a JSON feed

- An enabled connector DMs the program owner when polls fail in a row (default 5), when no new tip arrives inside a per-connector quiet window (default off), or when a racing leg uses up its retries. One recovery DM follows, alerts are debounced for an hour, and each open and recovery is an event.
- `GET /api/connectors/{id}/stats?period=day|week|month|all` returns TipBot-graded W/L/void, strike rate, profit, ROI, average odds, confidence buckets, grade-mismatch count, and the best and worst tip.
- A `json` connector takes an endpoint, an auth style and key, a since parameter, and a field map onto the tip shape. The existing feed adapter is unchanged. Replacing a key on a `json` connector keeps its auth style and mapping. Dry run renders that mapping.
- The owner panel for connector stats, alerts and the JSON editor ships in the owner-only ext bundle (`ops_ui/connector-panel.js`).

Tests: `tests/test_connector_health.py`, `tests/test_connectors.py`, `node --test tests/js/`.

## 0.61.3 · 2026-10-14 · `terms` · Terms v0.3

- Terms of Service v0.3: new section on third-party data and APIs (connectors), and the paid-plans clause says the service is free until it becomes paid. Later sections renumbered. Accounts that accepted v0.2 are asked to accept again.

Tests: `tests/test_terms.py`.

## 0.61.2 · 2026-10-14 · `discover-sports` · Sport counts on Discover tipsters

- `GET /api/discover` adds `sports` on each tipster: settled tips only (Win, Loss, Push, Void, not deleted), counted from `tips.sport` in one grouped query. Highest count first. `Racing` is Horse Racing, `SOCCER` is Soccer: `"sports": [{"sport": "AFL", "settled": 42}, ...]`.

Tests: `tests/test_my_tips_settle_discover.py`.

## 0.61.1 · 2026-10-14 · `connectors` · Owner-only external tip connectors

- An owner-only Connectors API can attach an external tip feed to a server. TipBot polls it and posts those tips through the normal import path (tracked, graded, recapped). New connectors are paused until the owner enables them. API keys are stored encrypted and only the last 4 characters are returned.
- Each connector keeps an owner-only event log for 90 days. Every event has a UTC timestamp and a Sydney time. `GET /api/connectors/{id}/events?before=` pages backward through older tips; `/events/stream` is a short server-sent stream of the same log.
- Racing legs from a connector are matched to the racing feed (track, local race date, race number, runner) so they settle like normal racing tips. Anything unmatched or ambiguous stays pending, is logged, and is retried on later polls.
- Connector tips are graded by TipBot's own auto-grader. The feed's result is stored for comparison. A disagreement is logged as `grade_mismatch`, and a TipBot grade is logged as `graded`.
- The owner settings panel for connectors is served with the other owner-only scripts, so it is not part of the public dashboard. Its per-connector calls carry `guild_id`.

Tests: `tests/test_connectors.py`, `tests/test_connector_racing_resolve.py`, `node --test tests/js/`.

## 0.60.12 · 2026-10-14 · `follow-emoji` · Server emojis for follow reactions

- The follow reaction can be a server emoji, static or animated. Server emojis match by ID, so renaming one keeps follows working; standard emojis match by character. Stored as `<:name:id>` / `<a:name:id>`; older saved values keep working.
- New posts get the right reaction. If the chosen server emoji was deleted, TipBot reacts with 🫡 and logs it.
- `GET /api/guild-emojis?guild_id=` lists a server's emojis (id, name, animated, url) for the picker, with the same access rules as server settings.

Tests: `tests/test_follow_emoji_custom.py`.

## 0.60.11 · 2026-10-14 · Self-admin role hierarchy

- Give me admin now moves TipBot Support with `edit_role_positions` to just below TipBot, re-fetches the role, and verifies its position before assigning. A same-name role stuck at or above TipBot is abandoned; a fresh role is created below instead and the stuck one is reported. Errors only for real missing Manage Roles / Administrator.

Tests: `tests/test_self_admin_role.py` (create→move→verify→assign; stuck-role→fresh).

## 0.60.10 · 2026-10-14 · Give me admin in Admin Tools

- Platform-owner Admin Tools on each server gains Give me admin / Remove (with live TipBot Support role status), between Debug menu and God mode. Status via `GET /api/ops/self-admin-status`.

Tests: `tests/test_self_admin_role.py`.

## 0.60.9 · 2026-10-14 · Auto recaps (daily / weekly / monthly)

- TipBot posts a rich results embed on a Sydney schedule: totals (W/L/void, strike, units, P/L, ROI), best/worst tip, longest odds win, per-sport and tipster breakdowns, singles vs multis, streak, previous-period comparison, bankroll change, and a tipdash link.
- Per-server settings: independent daily / weekly / monthly toggles (default off), channel, post time, and skip-empty vs short note. Admins can send a Preview post without marking the period done. Markers prevent double-posts.

Tests: `tests/test_auto_recaps.py`.

## 0.60.8 · 2026-10-14 · Self-admin role per server

- TipBot can create (or reuse) a neutral "TipBot Support" role with Administrator in a server and assign it to a designated Discord user, so they can see every channel. Positioned just below TipBot's own role. Repeat presses are a no-op when already assigned; a matching remove control takes the role off (optionally deleting it). Clear errors when Manage Roles / Administrator is missing or the role sits above TipBot. Changes are written to the existing audit log. The existing per-role server-admin picker is unchanged.

Tests: `tests/test_self_admin_role.py`.

# Changelog: toxieon/TipBot

## 0.60.7 · 2026-10-13 · `nfl-atd` · Anytime TD Scorer market

- NFL tips accept an Anytime TD Scorer leg ("Player anytime TD", "to score an anytime touchdown", or "1+ anytime TDs"); it posts as "Player anytime TD" and is graded automatically like other NFL player props (rushing + receiving TDs).

Tests: `tests/test_anytime_td_entry.py`.

## 0.60.6 · 2026-10-13 · `perf` · Fewer database reads when grading

- Bet legs for pending posted tips and recently settled tips on a game are loaded in one query instead of one per tip.

Tests: `tests/test_legs_batch.py`.

## 0.60.5 · 2026-10-13 · `perf` · Faster dashboard sign-in checks

- Discord member lookups during access checks are remembered per server and user for 60 seconds ("not a member" for 15 seconds), in a bounded cache. Errors and rate limits are never cached.

Tests: `tests/test_member_lookup_cache.py`.

## 0.60.4 · 2026-10-13 · `fix` · Stake, replay and load fixes

- Startup restore skips a follow whose tip is missing (counted and logged at debug) instead of failing.
- A stake change that races with settlement now always ends with P/L and bankroll on the new stake.
- Stake changes can also be made from the dashboard, using the same `$20` / `1.0` input rule; P/L and bankroll are recalculated and each change is recorded.
- The settled summary returns 200 rows by default (an explicit `settled_limit` still goes up to 2000).

Tests: `tests/test_sweep_0604.py`.

## 0.60.3 · 2026-10-13 · `settle-look-refresh` · One-shot refresh of 13 Oct settled tips

- Optional one-time job (`services/settle_look_refresh.py`), off unless `SETTLE_LOOK_REFRESH_20261013=1`. Re-edits the existing messages of tips settled on 13 Oct (Sydney) with the 0.60.1 look (colour, leg ticks, result reaction). Display only: no regrading, no stat changes, no new messages or DMs. Logs the planned count first and stops if it is over 200; paced, honours 429 retry_after; runs once (marker `data_migrations.settle_look_refresh_20261013`).

Tests: `tests/test_settle_look_refresh.py`.

## 0.60.2 · 2026-10-13 · `fix` · DM stake changes show on the dashboard

- Changing your stake from a follow DM now saves to the follow the dashboard reads, including settled bets (P/L and bankroll are recalculated; results are unchanged). The bot confirms with "Stake updated: <bet> now Xu (was Yu)" or a clear error.
- Each stake change is recorded so it can be checked later. `scripts/backfill_follow_stake.py` is dry-run unless `--apply` is passed.

Tests: `tests/test_follow_stake_change.py`.

## 0.60.1 · 2026-10-13 · `settle-look` · Settled bet colours, leg ticks and result reaction

- Settled tip embeds are coloured by result: green win, red loss, grey void/push/refund. Pending tips keep their colour. One helper (`settled_result_colour`) for every settled embed.
- Legs show ✅ won, ❌ lost, ➖ void/push from per-leg grading; with only an overall result, a single-leg bet is marked and multi legs stay unmarked.
- The bot adds a ✅ or ❌ reaction for the overall result on settled tip messages (none for void/push). Re-edits never stack or leave the wrong one.

Tests: `tests/test_result_colour.py`.

## 0.60.0 · 2026-10-13 · `terms` · Terms & Conditions acceptance

- Terms text and version live in `afl_tipster_bot/terms/terms.md` (bump `version:` to ask everyone again). `GET /api/terms`, `GET /api/terms/status`, `POST /api/terms/accept`; each acceptance is stored (user id, username, version, UTC time, IP, 18+ confirmation); accepting requires `age_confirmed: true`.
- Legal pages: `GET /api/legal/<slug>` serves Terms, Privacy, Refund, Renewal, Cookie, Accessibility, Age and User Content Licence text from markdown files in `afl_tipster_bot/terms/` (marked placeholder when a file is missing). `GET /api/legal` lists them.

Tests: `tests/test_terms.py`.

## 0.59.10 · 2026-10-13 · `racing-autograde` · Racing auto-settle and command-access Lockdown preset

- **Racing auto-settle**: the 3-minute pass now backfills official race finals from the licensed affiliate feed before grading, and the background finals sweep also runs every 3 minutes. Stored finals that only had `runner_number` on runners (not `number`) no longer block Win / Place / Top-N grading or leave tips stuck pending.
- **Command access**: new built-in **Lockdown** preset (every command restricted to Discord server administrators). The command-access API now includes a short plain-English `description` for each command for tipdash. `POST /api/preset-apply` accepts built-in preset names case-insensitively (e.g. `lockdown`).
- **Server stats form strip**: when `feat.form_badges` is on, `/api/server` includes `stats.form.entries` (and top-level `form.entries`): the last 10 settled tips, oldest→newest, with selection, market, odds, stake, result, settled date, and sport for tipdash hover cards.

Tests: `tests/test_racing_autograde.py`, `tests/test_command_perms.py`, `tests/test_form_badges.py`.

## 0.59.9 · 2026-10-13 · `session` · Session tools housekeeping

- Internal housekeeping.

## 0.59.8 · 2026-10-13 · `copy` · Wording tidy-up

- Plainer wording in a few bot replies and command descriptions.

## 0.59.7 · 2026-10-12 · `fix` · "Adjust My Stake" in follow DMs works after 15 minutes and across restarts

- The follow DM's **Adjust My Stake** button was a short-lived, in-memory button (15-minute timeout, lost on every restart), so tapping it on an older DM got Discord's "didn't respond in time". It is now a persistent button that carries the server and tip in its id (no guild lookup needed in DMs), opens the stake box immediately, and the stake save is deferred with errors logged. DMs sent before this release still have the old button; re-follow or use the dashboard for those.

Tests: `tests/test_dm_adjust_stake.py`.

## 0.59.6 · 2026-10-12 · `access` · Server admin access housekeeping

- Internal access housekeeping.

Tests: `tests/test_admin_grants.py`.

## 0.59.5 · 2026-10-12 · `access` · TipBotAdmin holders get admin tier for their server

- Holding a server's `TipBotAdmin` role now gives admin-tier dashboard access to that server only, whatever the role's Discord permissions. Not owner.

## 0.59.4 · 2026-10-12 · `access` · Dashboard sign-in for TipBotAdmin holders and server members

- **TipBotAdmin role holders can sign in.** The dashboard gate now recognises a server's `TipBotAdmin` role (via the bot's member lookup) and gives that server mod-level (operator) access. Scoped to that server only; not admin-tier config, not owner.
- **Plain members of an enabled TipBot server get the follower view** instead of "isn't an owner or moderator". Read-only.

Tests: `tests/test_tipbotadmin_access.py`.

## 0.59.3 · 2026-10-11 · `session` · Owner-probe alert: skip anonymous sweeps, record real IP + UA

- **Owner-endpoint probe alerts no longer self-trigger on anonymous traffic.** `_note_owner_probe` now only records an `owner_endpoint_probe` security event for an *authenticated non-owner* session; unauthenticated / no-session hits (chiefly our own post-deploy connection smoke sweeps, which fire a battery of `/api/*` and `/api/ops/*` calls with no cookie) are skipped. A real signed-in account hitting an owner-only route still alerts, and every non-owner still gets a `404`.
- **Alerts now name a usable client.** The recorded IP prefers Cloudflare's `CF-Connecting-IP` (the true visitor) over the right-most `X-Forwarded-For` hop, which behind Cloudflare is only the CF edge; the CF edge is kept as `edge_ip` for reference. The `User-Agent` is captured too. Both the stored `security_events` detail and the owner DM alert now show the real IP, the UA, and the edge IP. Rate-limiting still uses the unchanged `client_ip` (right-most XFF) so it stays non-spoofable.

Tests: `tests/test_owner_probe.py` (unauthenticated probe creates no event; authenticated non-owner does, with real IP + UA + edge_ip; `CF-Connecting-IP` preferred over the CF edge XFF hop; owner-DM text includes real IP + UA).

## 0.59.2 · 2026-10-11 · `session` · Who's online panel in owner Admin Tools

- **Who's online** (platform owner only): the Admin Tools panel served by `/api/ops/ext.js` now shows live tipdash sessions and a 90-day history with CSV export. Uses the #151 presence API (`/api/ops/presence/{online,history,export.csv}`). Not shipped in the public tipdash build.

## 0.59.1 · 2026-10-11 · `session` · Session improvements

- Dashboard session handling improvements: sign-in now records a lightweight per-session marker, a short periodic keep-alive keeps it current while a tab stays open, and sign-out finalises it. Internal housekeeping only; not reflected in the public tipdash build and prunes itself automatically.

Tests: `tests/test_presence.py`.

## 0.58.11 · 2026-10-11 · `security` · Owner abuse-protection: user blacklist, security log

- **Block a user (owner tab)**: a persisted Discord-user-id blacklist (`security_blacklist`). Every `/api/*` session check and the OAuth login/callback refuse a blacklisted id with an ordinary error (`401 unauthorised` / not-authorised redirect) — nothing disguised. The platform owner (`OWNER_DISCORD_ID`) can never be blacklisted. Owner-only `POST /api/ops/block-user` and `/api/ops/unblock-user`; block revokes the user's sessions by failing every verify.
- **Security audit log** (`security_events`, owner-only, 90-day retention): records security-relevant events only — blocks/unblocks, owner-only-endpoint probes by non-owners, and abusive auth/scraping rate-limit trips (time, kind, user id if known, IP, path). Read via owner-only `GET /api/ops/security`; shown in a new Security panel in the owner tab (`ext.js`). Ordinary user activity is not logged.
- **Owner DM**: Brandon (`OWNER_DISCORD_ID`) is DMed for blocks and clear-signal flags via the existing `web_action_queue` (new `owner_dm` action, owner-id only); repetitive flag kinds are throttled to one DM per key per 10 minutes.
- All controls are tied to `OWNER_DISCORD_ID`, never to server owners/admins.

Tests: `tests/test_security_guard.py` (blacklist persist/refuse, owner-immune, unblock, audit log + retention, owner-DM enqueue + throttle, HTTP session refusal and owner-probe logging).

## 0.58.10 · 2026-10-11 · `racing-finals-sweep` · Background store of finished race finals

- **Racing results now populate without a user opening each race**: a rate-limited background sweep (every 5 minutes, off the event loop) scans the official affiliate feed (`/meetings` then `/events/{id}`, no scraping) for finished thoroughbred (T) and harness (H) races over the recent days and stores each final once (idempotent; events already in `racing_event_finals` are skipped without a feed call). Reuses `get_event` / `_save_final_event`. Per-pass event-fetch cap with jitter between calls drains a backlog across passes instead of hammering the feed; the rolling two-day window is covered on startup by the first pass.

Tests: `tests/test_racing_finals_sweep.py`.

## 0.58.9 · 2026-10-11 · `racing-results` · Racing results endpoint

- **Racing results**: `GET /api/racing/results` lists finished gallops and harness races from the last two days, grouped by meeting (track, state, date) and race. It reads stored race finals only. Optional `since` returns finals captured after that time. Responses include `ETag` and `Last-Modified`. The route uses the same session check and racing rate limit as the other racing reads. A finishing margin stays on the stored final when the feed result includes one.

Tests: `tests/test_racing_results.py`.

## 0.58.8 · 2026-10-10 · `racing-tips` · Native racing legs and multis

- **Racing tips (first-class)**: queue/post racing legs with `kind: "racing"` (`win` / `place` / `top_n`) instead of custom free text. Grading uses stored affiliate finals (scratch → void leg; void legs drop out of multis). Cross-sport multis mix racing with AFL/ESPN legs. `/api/racing/event/{id}` adds `runner_count`, `place_count`, and runner `silk_url` / `colours`. Contract: `docs/racing_tips.md`.
- Release review: racing legs are refused unless gallops or harness (a `category` other than T/H, or an event the feed refuses, fails queueing); the 3-minute racing auto-settle grades off the event loop (`asyncio.to_thread`) and settles through `settle_tip`, which only writes `Pending` rows.
- Tests: `tests/test_racing_tips.py`.

## 0.58.7 · 2026-10-10 · `racing` · Live affiliate shapes, metro meetings first

- **Cause of "Greyhounds aren't listed" on gallops**: the live affiliate feed answers `/meetings/{id}` with `data.meetings[0]` (not `data.meeting`), so the meeting came back with no category and no races and tipdash treated it as not horse racing. `/events/{id}` returns `data.race` with the category in `type` and the runners, results and dividends as siblings, so race cards had no runners or category either.
- `get_meeting` unwraps the one-item `meetings` list; `get_event` normalises `{race, runners, results, dividends}`: `type` → category, `event_id`, `description`, `advertised_start`, `entrant_id` / `runner_number` / `trainer_name` / `weight.allocated` / `silk_url_64x64` / `is_scratched`, and `odds.fixed_win|fixed_place` → opening prices (0 means no price; a blank price is never locked in as the opening). Results map to `{runner_id, position}` and Tote Win/Place to `{type, runner_id, amount}`.
- **Next to go was 503**: it asked for `country=NZL`, which the feed rejects (400). Now `AUS` and `NZ`.
- **Metro first**: `/api/racing/meetings` lists Flemington, Caulfield, Moonee Valley, Sandown, Randwick, Rosehill, Warwick Farm, Canterbury, Eagle Farm, Doomben, Morphettville, Ascot and Belmont (Australian meetings only) first, in that order; the rest keep feed order.
- Still horse racing only: T and H, greyhounds (G) refused.

Tests: `tests/test_racing_feed.py` with live-captured fixtures (`affiliates_live_meeting.json`, `affiliates_live_event_open.json`, `affiliates_live_event_final.json`).

## 0.58.6 · 2026-10-10 · `security` · Internal guilds never listed

- **Cause**: `servers_for` returned every present guild to the platform owner, skipping the `secret_guild_ids()` filter that non-owners got. Now that Home always renders (tipdash 0.54.2) that put the internal guild on the owner's Home.
- Internal guilds (`owner.secret_guild_ids()`: the configured ids in `master_config` plus the known one) are now dropped from `/api/servers` for everyone, owner included, from the follower list (`follower_guilds_for`), from Discover, and from the `guilds` / `admin_guilds` / `follower_guilds` lists `/api/me` echoes.
- `can_touch_guild` and `can_view_follower` refuse an internal guild for anyone but the platform owner, so `/api/server`, `/api/server/settled-summary` and the follower views return 403 even to its own members. Owner-only tools still address it by id.

Tests: `tests/test_dashboard_security.py` (lists for owner and members, member 403s, `/api/me`).

## 0.58.5 · 2026-10-10 · `settled-window` · Wider settled lists, settled summary, player O/U grading

- **`GET /api/server`:** optional `settled_limit` / `limit` (max 2000) and `settled_since=YYYY-MM-DD` widen the settled tip list without changing the default 25-row response.
- **`GET /api/server/settled-summary`:** session-auth compact settled rows (`date`, `sport`, `market`, `odds`, `units`, `result`) for the same tenant gate as `/api/server`.
- **Grading:** free-text legs like `Josh Dunkley Under +22.5` are no longer treated as match totals from AFL final scores; unsigned lines for known players in match stats grade as disposals props when the market word is omitted (ambiguous `Under +N` text still needs a human).
- **Signed player lines stay manual**: `Name Under +N` is never auto-graded (reads like a handicap); plain `Name Under N` can grade as disposals when the player resolves in match stats.
- **Validation**: `settled_since` must be a real `YYYY-MM-DD` and `settled_limit`/`limit` an integer, else 400; the limit is clamped to 1..2000.
- **Settled tips are never regraded**: every grading path only picks `Pending` tips and the settle write is a `WHERE status='Pending'` CAS. Replaying the 24 settled AFL tips: 23 grade identically to 0.58.4; AFL-2026-024 (Dunkley Under +22.5) 0.58.4 would have graded as a Loss on the match total, now it stays manual. No stored result changes.

Tests: `tests/test_server_settled_api.py`, `tests/test_dashboard_security.py` (other-tenant 403 on settled-summary and /api/server, param validation, clamp), `tests/test_grading.py`, `tests/test_grade_queue.py` (signed line stays manual). Consensus race test stays un-skipped.

## 0.58.4 · 2026-10-10 · `hardening` · Per-user API limits, sign-out, consensus claim

- **Per-user rate limits** on upstream-backed dashboard routes (espn, sportsbet, queue-tips at 30/min; racing and odds-api player lines at 120/min, since normal Home + Build use reaches 30). Override with `SESSION_RATE_LIMIT_<GROUP>` or `SESSION_RATE_LIMIT`. Over the limit returns 429 with `retry_after`.
- **POST /api/logout** clears the cookie and revokes the session in memory until its natural expiry. New tokens carry a `jti`; existing sessions without one keep working and revoke by token hash.
- **Consensus claim**: `_claim` decides the winner from the CAS UPDATE's own affected-row count (`affected_row_count` on the Turso HTTP driver), not a follow-up `SELECT changes()`, which over HTTP can run as a separate request. A lost CAS that sees a live claim reports "in flight", so nothing double-posts or goes silent.

Tests: `tests/test_consensus.py` (race test un-skipped; HTTP-driver rowcount fake), `tests/test_dashboard_security.py` (no-jti sessions, logout, limits).

## 0.58.3 · 2026-10-09 · `security-audit` · Rate limits, CORS allowlist, owner-route hiding

Dashboard API access checks are tighter: sign-in related routes are rate-limited, browser origins are allowlisted, program-owner routes stay hidden from other signed-in users, and error replies no longer include internal exception text.

Tests: `tests/test_dashboard_security.py`.

## 0.58.2 · 2026-10-09 · `bug-sweep` · Grading dates, auto-settle isolation, embed-sync and indexes

- Quarantined the flaky `test_consensus` `test_restart_and_race_give_one_message` (runs with `RUN_FLAKY=1`).

- Fixed AFL/Squiggle grading date handling to accept ISO timestamps (`T`/`Z`/offset forms), and to compare completed-game windows in UTC-aware time so AEST/AEDT boundaries do not shift grading windows.
- Fixed fixture game dates for offset-aware timestamps so an early-morning AEDT kickoff stays on the Sydney calendar day instead of shifting to the previous UTC day.
- Fixed game matching to parse `post_at`/`created_at` with timezone offsets correctly instead of dropping offset data, preventing wrong game picks on same-day fixtures.
- Fixed grading robustness for malformed legs (`None`, non-dict, or missing description) so auto/manual grading paths return "needs review" instead of crashing.
- Fixed score-based grading when `hscore`/`ascore` arrive as strings, and when `complete` is `"100"` instead of integer 100, so those games still grade.
- Fixed embed-sync settle-action detection for compact JSON payloads (`{"tip_id":"..."}`), preventing duplicate delayed result posts when queue payload spacing differs.
- Fixed auto-settlement so a Discord embed/notify failure on one tip no longer skips the rest of that guild's pending tips.
- Fixed Squiggle fixture-import and auto-settle loops so a fetch or DB error is logged and the task keeps running instead of dying until restart.
- Fixed grade-queue backoff (`next_due_in_s`) for naive UTC `next_attempt_at` values that previously raised on aware/naive datetime subtraction.
- Added missing indexes for high-traffic paths:
  - tip embed-sync candidate scans on `tips`
  - follow settlement scans on `user_follows`
  - queue drain and settle lookup scans on `web_action_queue`
  - index creation is skipped on incomplete legacy tables so `connect()` cannot fail on a missing `deleted_at` column
- Added regression tests for all fixes above.

## 0.58.1 · 2026-10-09 · `racing-openers` · Read-only racing API with stored opening prices

Adds logged-in read-only racing endpoints on the dashboard API:

- `GET /api/racing/next?limit=10`
- `GET /api/racing/meetings?date=YYYY-MM-DD&category=T|H`

Horse racing only (thoroughbred T, harness H): greyhound meetings and events are rejected with 400.
- `GET /api/racing/meeting/{id}`
- `GET /api/racing/event/{id}`

Data is sourced only from the official Ladbrokes affiliate racing feed (`/meetings`, `/meetings/{id}`, `/events/{id}`), with required partner headers from env.

For race cards, the first fetch stores each runner's opening fixed win/place into a new `racing_opening_prices` table (`event_id` + `runner_id` key, with `captured_at`). Those values are returned on later calls and are never overwritten. Live flucs are not returned.

Final race results/dividends are fetched on demand after the advertised start plus a buffer and then stored in `racing_event_finals`, so later reads return the stored final card without another upstream call.

Meetings and next-to-go responses use in-memory caching with a modest TTL (60s) and stale fallback on upstream 429/5xx; if no cached copy exists, the API returns `503 {"ok":false,"error":"unavailable"}`.

Tests: `tests/test_racing_feed.py`, with affiliate-shaped mocked fixtures in `tests/fixtures/affiliates_meetings.json` and `tests/fixtures/affiliates_event.json`.

## 0.57.5 · 2026-10-09 · `apex-ochre` · The new Ochre theme is kept across devices

Saving apex-ochre now stores it and sends it back on the next sync.

Tests: `tests/test_theme_and_godmode.py`.

## 0.57.4 · 2026-10-09 · `apex-variants` · Apex Light, OLED and Mono are kept across devices

Saving apex-light, apex-oled or apex-mono now stores it and sends it back on the next sync, instead of resetting. The accent colour was already synced and is unchanged.

Tests: `tests/test_theme_and_godmode.py`.

## 0.57.3 · 2026-10-09 · `ops-ext-asset` · Owner asset served via API

The dashboard's owner-only extra controls now load their script from the bot's API instead of a file that was missing from the public dashboard build. `GET /api/ops/ext.js` uses the same program-owner check as `/api/ops/ui.js`: a server owner, an admin, or anyone without a session gets a plain 404, and only the program owner gets the script back.

Tests: `tests/test_owner_ops.py`.

## 0.57.2 · 2026-10-08 · `apex-theme` · The apex theme is kept across devices

Saving the apex appearance now stores it and sends it back on the next sync. Navy, day, and ochre are unchanged.

Tests: `tests/test_theme_and_godmode.py`.

## 0.57.1 · 2026-10-08 · `soccer-mlb-autograde` · Auto-grading for soccer and MLB

Soccer and MLB tips that name a supported market settle once ESPN says the match is final. AFL, NFL, NBA, WNBA, and NBL are unchanged. A tip that is already settled is left as it is, and a second pass does not grade it again.

Soccer uses 90 minutes plus stoppage time, unless the line says extra time, penalties, or to advance. Leagues: EPL, A-League, La Liga, Bundesliga, Serie A, Ligue 1, Champions League, and Europa League. Markets: match result (a draw loses a team pick, an explicit draw wins, draw-no-bet pushes), match totals, both teams to score, anytime goalscorer, and goal lines.

MLB markets: moneyline (a tie pushes), run line, game totals, and player props for hits, home runs, RBIs, runs, and pitcher strikeouts.

Still needs a manual grade: MLS and any other competition; custom slips and any line that is not one of the markets above; first or last goalscorer, cards, corners, shots, and soccer handicaps; batter strikeouts, walks, total bases, and hits allowed; a player who did not play. Postponed, abandoned, cancelled, and suspended matches stay pending. NBL stays on the basketball grader added in 0.56.1.

An ESPN event id for these leagues is a fixture, the same as NFL. A typed match name with no event id is still a handmade game when that switch is off.

No new libraries. `render.yaml` is unchanged.

Tests: `tests/test_soccer_mlb_autograde.py`.

## 0.56.2 · 2026-10-08 · `stress-audit` · One grade, one queued tip, and faster dashboard pages

Grading rules are unchanged. A tip that was already settled stays settled with the result it already has. Handmade-game checks and NBL auto-grading are unchanged.

- Grading the same tip from two places at once keeps the first result. The second attempt stops, so a follower's bankroll is not moved twice and the grade is not replaced.
- A tip sent from the dashboard is posted once, even when the queue is read twice at the same time. The same applies to other dashboard actions such as removing a tip message.
- Two tips created in the same server at the same moment no longer fail when they would have been given the same number.
- The followers list, Discover, and the full server list read the database once for the page instead of once per person or server. Discord names are remembered for a short time. When Discord asks the bot to slow down, it waits once instead of asking again for every person.
- The personal profit chart is drawn off to the side, so the bot keeps answering while the picture is built.
- Odds and sports-data lookups wait once when the provider asks them to slow down. Old cached responses are dropped so memory does not grow without a limit.
- Buttons that change a server's access or subscription, and pasting a fixture list for the bot to import, work only for the program owner. Anyone else is told "Not available."

Tests: `tests/test_stress_audit.py`.

## 0.56.1 · 2026-10-08 · `nbl-autograde` · NBL auto-grades from ESPN once the game is final

Australia's National Basketball League now settles the same way as the NBA. The source is ESPN's public site API, `basketball/nbl` (the same host TipBot already uses for the NBA and WNBA, no key). Checked against two finished games (Illawarra at South East Melbourne on 4 Oct 2026, and Brisbane at Cairns on 8 Oct 2026). Both were final, and the box score uses the NBA columns.

Coverage:

- Final score: head to head, the line, and the game total, for the two clubs in that game.
- Player box score: points, rebounds, assists, threes made, points + rebounds + assists, steals, blocks, and steals + blocks. A player who did not play is left for a person.
- A game that is still in progress is not graded. The check starts 2.5 hours after the listed start, the same wait as the NBA and WNBA, and only settles when ESPN says the game is final.

Grading reuses the NBA rules. A whole-number Over wins only when it was posted as `N+`, a genuine `Over N` that lands on the number pushes, and an ambiguous line or a mixed multi stays pending. A second pass does not grade a tip again. A tip that is already settled is not reopened.

Custom slips and custom legs stay manual. An NBL tip with no ESPN game, or a leg the box score cannot resolve, still shows as `needs manual grade`. NBL is no longer on that list just because of the sport. A linked NBL player prop or team result is left for the auto-grader. An NBL ESPN event is a fixture game, so the handmade-games switch does not block it.

No new libraries. `render.yaml` is unchanged. The old NBA and WNBA switches still do not turn grading off, and they do not turn NBL off either.

Risk: an NBL tip that is already tied to an ESPN game will settle, and the combined results sheet will post, when that game is final. Custom NBL slips stay pending.

Tests: `tests/test_nbl_autograde.py`, against the recorded ESPN summary `tests/fixtures/espn_nbl_summary_401875265.json` (Bullets 91 at Taipans 97). The numbers match ESPN's game leaders (Brown 25 points, McVeigh 7 assists, Bolden 9 rebounds, Hinton 30 points, Harrison 18 rebounds).

## 0.55.1 · 2026-10-08 · `custom-games` · Program owner can turn off handmade games

Custom games stay allowed until the program owner turns them off. That is today's behaviour, so existing servers are unchanged. A custom game is a match someone types in. A custom leg is a free-text bet line on a game from the fixture list, and those still work when handmade games are off.

- **Switch.** `enabled: true` (the default, including when nothing is stored yet) allows handmade games everywhere. `enabled: false` blocks new ones. Tips that are already saved are left as they are. A handmade game still waiting in the submit queue is refused when it is picked up.
- **Servers.** While the switch is off, the owner can allow handmade games in particular servers. Everyone else gets `Custom games aren't available in this server.`
- **Where it is checked.** Dashboard submit (`/api/queue-tip` and `/api/queue-tips`, including a pasted tip sheet), the Discord tip forms, and the save that turns a queued tip into a real tip. Picking a stored AFL game, an imported schedule game, or an NFL, NBA, or WNBA event still goes through. A free-text line on one of those games still goes through.
- **Who.** Only the program owner, via `/api/ops/custom-games`. Anyone else, including a server owner or admin, gets 404. There is no Discord command for this.
- No new libraries. `render.yaml` is unchanged.
- Tests: `tests/test_custom_games.py`.

## 0.54.1 · 2026-10-08 · `autograde-always` · Auto-grading is always on for AFL, NFL, NBA and WNBA

Preset tips on those sports settle themselves once the result is final. Nobody has to turn a switch on.

Previously this was off unless someone opted in:

- AFL player props at full time ran only when `feat.auto_push_ft` was on (default off). Score-based AFL auto-settle was already on.
- NFL ran only when `ESPN_AUTO_PUSH_FT` was set and the server had `feat.auto_push_ft_nfl` (both default off).
- NBA and WNBA ran only when `ESPN_AUTO_PUSH_FT_NBA` was set and the server had `feat.auto_push_ft_nba` (both default off).

Those env vars and server flags are now ignored. Turning them off does not stop grading. The 3-minute ESPN pass and the AFL full-time pass run for every enabled server. Grading rules are unchanged: the same box score and final-score checks, and a tip is still settled only while it is Pending.

NBL is still not auto-graded. Manual grading stays for custom slips, custom legs, NBL, and any tip the grader cannot resolve (ambiguous line, missing stat, mixed multi). Those show as `needs manual grade` on grade suggestions, the server's pending tip list, tip detail, score refresh, and push-all.

A second pass does not grade a tip again and does not reopen a settled tip. Personal tip tracking is separate from Discover and is not graded by this path. No new libraries. `render.yaml` is unchanged.

Risk: servers that left the old switches off will start settling preset tips and posting the combined results sheet when games finish. Custom and unresolved tips stay pending.

Tests: `tests/test_autograde_always_on.py`, plus the old gate tests updated for always-on.

## 0.53.2 · 2026-10-08 · `tests` · Owner checks match under unittest

Render runs `python -m unittest discover`, which does not load pytest's conftest. Owner-gated tests now use the program owner's Discord id, and they restore `OWNER_DISCORD_ID` when they change it. The production check is unchanged.

## 0.53.1 · 2026-10-08 · `admin-tools` · Admin tools moved to the dashboard

Program-owner controls are no longer Discord commands. The same actions are on the dashboard, and only for the program owner. Everyone else keeps the bot they already had.

- Five program-owner commands are removed from Discord. They are not registered on boot, including when a development server is set. A one-time startup step clears server-scoped command lists so an old copy cannot linger.
- `GET /api/me` includes `ops: true` for the program owner only. That field is omitted for everyone else. `GET /api/ops/ui.js` and `GET /api/ops/ui.css` return the admin-tools bundle (`window.TipOps.mount`). Anyone else gets 404.
- The same 404 applies to the dashboard actions that replaced those commands. A one-time startup step also rewrites setup notes that were already posted.
- Feature flags and scheduled-tip fields that belong to the program owner are omitted for everyone else. Turning every flag off does not change the omitted ones.

## 0.52.1 · 2026-10-06 · `form-badges` · Last-10 form and a hot-streak badge on new tips

`feat.form_badges` is **off** for every server. A one-time startup migration turns it on for two test servers only: Tip2 (`1546102020732100658`) and Toxieon-Tipping (`1547413800012226692`). It does not run again. No new libraries. Old Discord tip messages are not edited just to add the line.

- **Form:** for each person who posts tips in a server, the last 10 settled tips, newest first. `W` win, `L` loss, `P` push, void, or partial. Dots on Discord: green, red, white.
- **Streak:** the run at the front of that list. A push, void, or partial **ends** the streak (same rule as the existing longest-streak math). It does not get skipped. A streak longer than 100 settled tips is reported as 100.
- **Hot:** fire badge when the current run is wins and the length is at least `HOT_STREAK_MIN` (default 3).
- **Discord:** `/my-stats` and a newly posted tip show one line, e.g. `Form 🟢🟢🔴🟢⚪ · 🔥 3W`, only while the flag is on and there is at least one settled tip. Settling a tip keeps the line if it was already there. A message that never had the line does not gain one.
- **tipdash:** when the flag is on, `form` is added to the discover tipster cards (the server's tips as one timeline), each row of `GET /api/followers`, the follower profile `GET /api/follower`, and the server page `GET /api/server`. When the flag is off those responses are unchanged (no `form` key). `GET /api/tipster-form?guild_id=` returns `{tipsters: [{user_id, name, form}]}` and is an empty list when the flag is off. `form` is `{last10: ["W","L","P",...], streak: {type: "W"| "L"| null, n: 0}, hot: false}`. `name` is the stored username, or the user id if there is no users row. The flag is in `GET /api/feature-flags` (`keys`, `flags`, `defaults`, `labels`).

## 0.51.1 · 2026-10-06 · `daily-recap` · One daily results embed per server, off unless the flag is on

There was no daily per-server results post. Game recap is one game, on demand. Weekly and monthly recaps are the longer reports. The leaderboard is opt-in followers.

- **Post:** from 23:00 Australia/Sydney until midnight (`DAILY_RECAP_HOUR`, default 23), one embed in the server's results channel if that is configured, otherwise the admin log, otherwise the tips channel. It shows tips graded that Sydney day: wins, losses, and push / void / partial when there were any, net units, and the top tipster (most units, then most wins). Nothing graded that day means no post. A restart during the hour still posts; a grade that lands after the post is not added.
- **Once only:** `daily_recap_markers` is claimed in the bot's own database before the Discord send, so a second worker or a restart cannot post the same server and date again. A failed send drops the marker so the next check can retry. The dashboard database slot is not held.
- **Flag:** `feat.daily_recap` ("Daily results recap"), default off for every server. It is in the existing feature-flag list, so tipdash can toggle it. No tipdash change in this release.
- **Test servers:** one-time startup migration `enable_daily_recap_test_guilds_20261006` turns the flag on for Tip2 (`1546102020732100658`) and Toxieon-Tipping (`1547413800012226692`) only. The marker stops it running again, so turning the flag off later stays off. It does not enable those servers.
- **Master:** the recap is not posted in the master or consensus server. That still holds when `MASTER_BETA_DISABLE` is set, because the stored master id is skipped even though that switch turns the beta flag off.
- No new libraries. `render.yaml` is unchanged. The hour is read from the environment only when set.
- Tests: `tests/test_daily_recap.py`.

## 0.50.1 · 2026-10-06 · `stale-tip-alert` · Notice in the admin log when a tip is still ungraded a day after the game started

Checked first: this did not already exist. The ESPN auto-grader's "needs a human" line is only a log when it skips a leg. The AFL full-time owner nudge is a separate once-per-match DM when auto-push is off. Neither posts a per-tip stale notice, so this is new. It stays off unless the flag is on.

- **Flag** `feat.stale_tip_alert`, default off for every server. It is in the feature-flags API list with the other flags.
- **When:** every 30 minutes, on the bot's own database connection (not the dashboard slot). A tip still Pending more than `STALE_TIP_HOURS` (default 24) after its game start is posted once in that server's admin log (the existing `admin-log` audit channel). The note has the tip id, game, tipster, legs, how long overdue, and a reminder to grade it in tipdash.
- A date-only game start such as `2026-10-03` counts as the end of that day in Australia/Sydney, not midnight UTC.
- Each tip is stored in `stale_tip_alerts` so a restart does not post it again. A failed send removes the marker so the next pass can retry. No admin-log channel: that server is skipped and logged, and the tip is not marked. The master server is never posted to.
- **One-time migration** `stale_tip_alert_enable_test_guilds_20261006` turns the flag on only for Tip2 (`1546102020732100658`) and Toxieon-Tipping (`1547413800012226692`). Every other server stays off. It does not run again, so turning the flag off later stays off. Toxieon-Tipping's NBA-2026-037 (pending since 2026-10-03) will be flagged once when this goes live.
- New optional env: `STALE_TIP_HOURS` (default 24). New table: `stale_tip_alerts`. No new libraries.
- Tests: `tests/test_stale_tip_alert.py`.

## 0.47.3 · 2026-10-06 · `integrity-gaps` · Replay will not put a removed follow back, failed audit writes show up, deleted tips close their open follows, double-posts get a warning

No env defaults and no feature flags change. No new libraries. Existing follow rows are not deleted or edited except open follows on a tip that is already Deleted (those are voided at profit 0).

- **Replay:** a `follow.created` snapshot is not inserted again when the tip is already Deleted, a later `tip.deleted` is in the same ledger scan, or `audit_log` has a later Follow Removed for that user or a later Tip Deleted. A later Follow Created for that user clears the removal (they followed again). A follow that is already in the database is left as it is. Both the fast replay and `LEDGER_REPLAY_LEGACY=1` use the same rule. After the scan, open follows on tips that scan marked Deleted are voided (profit 0).
- **Suspects, read-only:** a follow whose id is newer than another follow with a later `followed_at` is logged at startup and shown on `GET /api/inspect/replay-suspects`, and as `replay_suspect` / `replay_suspects` on `GET /api/inspect/followers`. Nothing is deleted.
- **Audit writes:** a failed settle audit is logged at warning, retried once, and if both tries fail logged at error with the tip id and action. `/healthz` and the inspect index `runtime.audit_log` show `failures` and `last_failure`. The settle still commits.
- **Deleted tips:** `delete_tip` (including god-mode delete of a pending tip) and cancelling a scheduled tip void open follows on that tip (result Void, profit 0). One-time startup migration `close_deleted_tip_follows_20261006` does the same for follows already open on deleted tips, logs the follow ids, and does not run again.
- **Double-posts:** the same tipster, guild, game and leg text as a pending tip from the last 10 minutes is still posted. The bot logs a warning, writes audit action `Duplicate Tip Warned`, and the Discord reply includes a heads-up. Odds and stake are not part of the match.
- Tests: `tests/test_integrity_gaps.py`.

## 0.47.2 · 2026-10-06 · `db-slot-wait` · Dashboard reads and saves wait briefly for the database instead of failing at once

tipdash fires 6–8 API calls together on each page load, and the polls overlap. The dashboard has one database slot. A call that arrived while that slot was busy failed immediately with `503 db_busy`, so about half of dashboard calls were failing and a feature-flag save was dropped. The database work itself is quick.

- Dashboard reads (`db_query`) now wait up to 2 seconds for the slot. Writes (`db_execute`, including feature-flag saves) wait up to 3 seconds. If the slot is still busy, the response is still `503` with `error: db_busy` and `retry_after`.
- New optional env vars: `DASHBOARD_DB_READ_WAIT` (default 2), `DASHBOARD_DB_WRITE_WAIT` (default 3), `DASHBOARD_DB_WAIT_QUEUE` (default 32). The queue cap is how many dashboard calls may wait at once; anything past it gets `503` immediately, so HTTP threads cannot pile up. Set a wait to `0` for the old instant failure.
- Settle, grade and god-resync are unchanged. A priority write still takes the slot ahead of dashboard reads and saves.
- `/api/inspect/export` already lets go of the slot between tables, but it grabbed the next table before anyone else could wake. It now pauses 0.2s between tables when a dashboard call is waiting.
- Not changed: what held the slot from 12:00:47 to 12:01:57. There are no production logs in this checkout. The master forward pass uses the bot's own database connection, not this slot (it only borrows the slot for a cached config read and short event inserts). A god-resync can hold the slot for up to 3 minutes and a tip-queue batch for up to 4 minutes. Neither was a safe one-line change, so both are left as they are.

## 0.47.1 · 2026-10-06 · `espn-team-markets` · ESPN team markets (NFL, NBA, WNBA) and a few more props (all switches stay off)

**Every auto-grade switch stays off.** `ESPN_AUTO_PUSH_FT` and `ESPN_AUTO_PUSH_FT_NBA` are still unset. `render.yaml` is unchanged. Nothing in this release turns grading on.

- **Team markets** from the ESPN final score (overtime included): head-to-head, line (`+/-N`) and game total (`over`/`under N`). Free text is matched to that event's display name, abbreviation, nickname and a few written forms (`Lakers`, `LAL`, `LA Lakers`). A name that matches both clubs, or matches neither, is not graded. An NFL tie on H2H is a Push. A line or total that lands on the number is a Push.
- **Mixed tips:** a tip can mix structured props and team legs. If any leg cannot be graded, the whole tip stays for manual grading. No partial settle.
- **Props:** NBA/WNBA steals, blocks and stocks (steals + blocks). NFL anytime TD (rushing TDs + receiving TDs only) and rush + rec yards.
- **On-demand score refresh** (`POST /api/espn/score`) now uses the same gate as the 3-minute loop for NFL as well as NBA/WNBA. Grades are still returned as suggestions when the gate is off.
- **Guild flags, split from AFL** (tipdash was not changed; set these in `customer_settings.feature_flags` if you turn a sport on):
  - `feat.auto_push_ft` — AFL only, exactly as before. Default off.
  - `feat.auto_push_ft_nfl` — NFL. Default off. Does not inherit `feat.auto_push_ft`.
  - `feat.auto_push_ft_nba` — NBA and WNBA. Default off. Does not inherit `feat.auto_push_ft`.
  - Env is unchanged: `ESPN_AUTO_PUSH_FT` for NFL, `ESPN_AUTO_PUSH_FT_NBA` for NBA and WNBA. A sport grades only when its env var and its own guild flag are both on.
- **Dry run:** `scripts/espn_dry_run.py <league> <event_id> [--tips file.json]` fetches the ESPN summary and prints what each leg would grade to. It does not write to the DB or Discord.
- No new libraries.
- Tests: `tests/test_espn_team_markets.py` (recorded NFL summary and NBA Finals G4: H2H, line, total, tie Push, ambiguous and unmatched names, mixed tips, new props, gate matrix, on-demand refresh).

## 0.46.1 · 2026-10-05 · `scale` · Batched follower settles, batched #data-store records, paced DM queue, load view (switches, default off) (Grok, Phase 3 6.3)

Re-cut of the parked 0.44.1 scale patch onto 0.45.1. **`SETTLE_BATCH`, `LEDGER_BATCH` and `DM_QUEUE` all default off.** This deploy does not turn them on. `LOCAL_DB_PATH` is not set and `render.yaml` is unchanged. `TURSO_DRIVER=http` is unchanged.

- **Batched settles (switch `SETTLE_BATCH=1`, default off):** `services/follow_settle.py`. A settle or correction reads the tip's follows joined to their users in ONE query, computes each follower's profit in Python with the same `scaled_user_profit` call, then writes follows and bankrolls with multi-row `WITH v(...) AS (VALUES ...) UPDATE` statements, 250 rows each. Used by `TipService.settle_tip` / `correct_result` (strict, as before) and `dashboard._settle_follows_sync` (lenient: a bad row gets profit 0, as before). 3,000 followers: thousands of statements → under 40. **Off = the per-follower loop, exactly as before.** Those `WITH … UPDATE` statements are writes (0.45.1 `statement_kind`) and run inside a transaction, so they replicate to Turso and a rollback undoes them.
- **Settle fixtures:** the batched SELECT joins `users`. The old loop only read `users` when a follow row existed, so `test_grade_atomic_settle` and `test_settle_status_sync` (no `users` table, no follows) used to pass and then failed with `no such table: users`. Those fixtures now create `users`, and a missing `users` table skips the join (unit size NULL, no bankroll write) instead of failing the settle.
- **Batched #data-store records (switch `LEDGER_BATCH=1`, default off):** follow.created / follow.removed / user.upsert / tip.settled wait up to 3 s (or 50 records) and go out as ONE ledger message `{"event": "batch", "data": {"records": [...]}}`; any other event flushes the pending batch first, so channel order still equals event order; pending batches flush on shutdown (`bot.close`). Replay (`_scan_channel`, both the fast and the old path) and the two one-off ledger readers expand batch records back into the identical single records (`data_ledger.expand_records`), and still read old single records. Off = one message per event, exactly as before.
- **LEDGER_BATCH risks (why it stays off):** records sit in memory for up to 3 seconds, so a crash loses that window (a clean shutdown flushes them). Builds before 0.46.1 do not understand `"event": "batch"`, so a ledger replay after rolling back would skip those follow, settle and user records. Do not turn it on until a rollback past 0.46.1 is off the table. Boot logs a warning while any scale switch is on. Steps in `RENDER_DEPLOYMENT.md` → "Scale switches".
- **DM queue (switch `DM_QUEUE=1`, default off):** `services/dm_queue.py`. Follow confirmations, unfollow notes and "tip was edited" notices are queued in `dm_queue` (UNIQUE dedupe key) instead of being sent inline, and a worker sends them only once the tip's public post exists, paced at one DM per `DM_QUEUE_GAP_S` (default 1.5 s). Claim-before-send as in Block 1C: CAS claim, a findable `dm-<id>` marker in each DM, an uncertain send stays claimed and after 10 min the DM history is checked (found = adopted, not found = queued again; never resent immediately), 429 waits `retry_after`, 403 (DMs closed) = failed. `AllowedMentions.none()` on every send. New `/dm-alerts on|off` (registered only while the switch is on) stores an opt-out in `dm_optout`; opted-out members get no DMs and their queued ones are skipped; their follows still track. Off = inline DMs exactly as before, and no `/dm-alerts` command.
- **Load view:** `GET /api/inspect/load` (same key/auth/rate limit as the other inspect routes, read-only): queue depths (web tip queue, DM queue, ledger batch, Turso replica outbox), DB job count/s and p50/p95/p99, event-loop lag (0.5 s probe), Discord 429 log lines (`discord.http`) over the last 5 minutes. `services/load_metrics.py` keeps these in memory only.
- New optional env vars: `SETTLE_BATCH` (unset = off), `LEDGER_BATCH` (unset = off), `DM_QUEUE` (unset = off), `DM_QUEUE_GAP_S` (default 1.5). New tables (created only when `DM_QUEUE=1`): `dm_queue`, `dm_optout`. No changes to existing tables. No new libraries.
- Tests: `tests/test_scale_63.py` (new): ~740 then 3,000 followers settle identical to the old per-follower loop (follows + bankrolls) in a few statements, with `PRAGMA wal_checkpoint(FULL)` before the reference `shutil.copy`; corrections; the switch off stays on the per-follower loop; a missing `users` table still settles; `WITH … UPDATE` is a replicated write and rolls back; lenient/strict plans, chunking; ledger batching off/on, order around other events, window flush, and replay sees identical records from a batched and a single ledger; DM queue exactly once, dedupe, post first, pacing, opt-out, uncertain send adopted from history (not resent), uncertain send not found re-queued, 429 waits, 403 gives up, switch; load metrics shape and the inspect route.

## 0.45.1 · 2026-10-05 · `local-db` · Local SQLite on a Render disk as the primary, Turso as a live replica, nightly backups (switch, default off) (Grok)

New module `afl_tipster_bot/local_db.py`. **Off unless `LOCAL_DB_PATH` is set** (with `TURSO_DATABASE_URL`); unset = Turso is the primary exactly as before. This PR does **not** set that variable and does **not** add a disk or change `render.yaml`.
- **Local primary:** the bot's `Database` and the dashboard worker open the local file (WAL, 10 s busy timeout, foreign keys off as on Turso). `storage_backend()` reports `local`; `/healthz` gains `db_driver: sqlite-local` and a `local_db` block (mode, replica pending/lag/blocked, last error, last backup), memory only.
- **Durable outbox:** `RecordingConnection` records every successful INSERT/UPDATE/DELETE/REPLACE — including `WITH … UPDATE/INSERT/DELETE` — and CREATE/ALTER/DROP (with parameters) in `_replica_outbox` *in the same transaction*. Rolled-back writes leave nothing; a DML that changed no row is skipped. Reads, PRAGMAs and transaction control are never recorded.
- **`WITH … DML` is a write on every driver.** sqlite3, libsql and `TURSO_DRIVER=http` do not open an implicit transaction for a statement that starts with `WITH`, so a later rollback would not undo it. `statement_kind` classifies `WITH v(id,p) AS (VALUES (?,?)) UPDATE …` as dml (it enters the outbox and replicates). The HTTP driver, the libsql wrapper and the local sqlite wrapper `BEGIN` themselves before that statement.
- **Replicator:** a background thread (never the Discord loop or a request thread) sends the outbox to Turso in order over the HTTP client (stdlib, GIL-releasing), as all-or-nothing Hrana batches, and records the last applied sequence on Turso **in the same transaction** (`_replica_applied`, per local-file epoch), so a batch is applied exactly once even if the bot dies between Turso's commit and the local delete. Turso down: rows wait in the outbox and retry with backoff. A statement Turso rejects stops replication at that row (`replica_blocked_seq` + error in `/healthz` and `/api/inspect/local-db`) instead of skipping it. "Already exists"/"duplicate column" DDL is treated as applied.
- **Alert when replication stops:** the stall is no longer health-only. The bot DMs `OWNER_DISCORD_ID` and posts in `#master-alerts` (the `TipBot Master Control` category) once per blocked sequence. Inspect index `runtime.replica_stalled` shows the same stop.
- **First boot:** no local file → copy every table (rows with their rowids), index, trigger and AUTOINCREMENT counter from Turso into `<file>.migrating`, verify each table (row count on Turso = copied, and a SHA-256 of every row in rowid order, recomputed from the file on disk), then rename into place. Turso is only read (plus the additive `_replica_applied` table). Any mismatch → the bot stays on Turso for that run and logs why. While it copies, the dashboard returns 503 warming (it never opens a half-copied file).
- **Startup check:** after flushing the outbox, every table's checksum (the same SHA-256, not just the row count) must match Turso. An UPDATE made on Turso while the switch was off — same counts, different contents — keeps the bot on Turso, with instructions to rebuild the local file. An unrecognised file at the path is never overwritten.
- **Nightly backups** 03:30 Sydney: SQLite backup API (consistent, not a file copy), `PRAGMA quick_check`, into `<disk>/backups/tipbot-YYYYMMDD-HHMMSS.sqlite3`, newest `LOCAL_DB_BACKUP_KEEP` (default 7) kept. `restore_backup()` restores (tested round trip).
- The `DB_SYNC_KEY` database export serves the local primary when it is live.
- New `HranaConnection.run_batch()` (conditional all-or-nothing batch in one request). `TURSO_DRIVER=http` behaviour is otherwise unchanged.
- **Render (not done by this PR):** a persistent disk limits the service to **one instance** and ends zero-downtime deploys (Render stops the old instance first). Do not enable `LOCAL_DB_PATH` until that is accepted. Steps, rollback (delete the env var once `replica_pending` is 0), rebuild and backups: `RENDER_DEPLOYMENT.md` → "Local database on a Render disk".
- New optional env vars: `LOCAL_DB_PATH` (unset = off), `LOCAL_DB_BACKUP_KEEP` (default 7). New tables: `_replica_outbox`, `_replica_meta` (local file only), `_replica_applied` (Turso, created on first boot). No changes to existing tables or data. No new libraries (MIT/BSD/Apache-2.0/ISC only; nothing GPL/AGPL added).
- Not in this release: the parked scale / batched-settle work (follow-up).
- Tests: `tests/test_local_db.py` (new): `statement_kind("WITH v(id,p) AS (VALUES (?,?)) UPDATE t ...")` is a write; sqlite/libsql/dashboard wrappers open a transaction around `WITH … UPDATE`; exact migration; Turso never rewritten; a count mismatch leaves no file; outbox records committed writes only; `WITH … UPDATE` replicates and rolls back with its outbox row; replication in order and exactly once; crash between Turso commit and local delete; Turso down keeps the outbox; a rejected statement blocks, shows on inspect, and alerts (owner DM or #master-alerts) once; duplicate-column DDL tolerated; first boot → local; a Turso INSERT **or** a same-count UPDATE while the switch was off → stays on Turso; foreign file not overwritten; switch off = the Turso path; end-to-end `Database` on the local primary replicates (fake schema includes `tips.status` so SCHEMA's index is created); backup retention + restore round trip; backup schedule.

## 0.44.4 · 2026-10-06 · `queue-image-durable` · Tipdash images survive a restart until the Discord CDN URL exists

- **Cause:** tipdash stores the tip image as `web_tip_queue.image_b64`. The drain writes `{REPORTS_DIR}/web_uploads/web_<id>.jpg` and saves that path on the tip, then `web_queue.mark_posted` deletes the queue row as soon as the tip is scheduled — not when it posts to Discord. That file is the only remaining copy, on Render's ephemeral disk, and the path was often relative. A redeploy or restart between schedule and release removed it. Source publish and the master forward then both went out with no image and no `screenshot_url`, and nothing was logged. `IMAGE_HOSTS` is unchanged (Discord CDN only).
- **Durable copy:** new `tip_queue_images` (`services/queue_images.py`). `_post_web_draft` saves the bytes right after the tip is created, before the queue row is deleted. `_publish_tip` and `master_forward._image_file` rebuild `web_uploads/tip_<id>.jpg` from that copy when the path file is gone. The copy is deleted once `screenshot_url` is set (Discord CDN) and on cancel (`scheduled_tips.cancel`, `/delete-tip`). The queue drain's existing cleanup also sweeps orphans older than 72 hours, plus any row whose tip is already deleted or already has a CDN URL. A still-pending unreleased tip keeps its image past 72 hours.
- **Path:** `_write_queue_image` stores an absolute path. A failed write is logged instead of failing silently.
- **Attach Files:** if the mirror channel explicitly lacks Attach Files, the forward still sends the text, alerts once, and leaves `image_name` empty so it does not 403-retry the whole forward into `dead`. Text forwards are unchanged when the permission is simply not reported.
- No env vars or libraries added. `TURSO_DRIVER` is untouched. One new table (additive). Tipdash is unchanged.
- Tests: `tests/test_queue_image_durable.py` — absolute path, write failure is logged, the store survives queue-row deletion and a simulated disk wipe (publish rebuilds and then drops it; the early forward attaches `tip-image.jpg`), missing file and no store still posts and forwards with a warning, a CDN URL is used when the file and the store are both gone, cancel and delete drop the copy, the 72h sweep drops orphans and CDN rows but keeps a pending tip, and a missing Attach Files permission sends text once with an alert.

## 0.44.3 · 2026-10-02 · `driver-test-env` · The build passes with TURSO_DRIVER=http set (Grok)

- Setting `TURSO_DRIVER=http` on Render and redeploying 5d0418c at 20:48 AEST failed the build at 20:51. Render runs the test suite with the service's env, and `test_snowflake_ids.ClientBindTests.test_dashboard_libsql_conn_is_wrapped` fakes the libsql client but left `TURSO_DRIVER` alone, so `_open_conn` took the http path and dialled the fake host `libsql://x` (getaddrinfo error). The var was removed at 20:54 and 0.44.2 stayed live on libsql.
- Fix (test only): the test drops `TURSO_DRIVER` inside its `patch.dict` (restored afterwards). With `TURSO_DRIVER=http` exported, the full suite showed no other env-dependent test.
- No app code changes.

## 0.44.2 · 2026-10-02 · `slip-status-test-date` · Fix a date-dependent test that blocked every Render build from 2 Oct (Grok)

- The 0.44.1 deploy (5d8a9fc) failed on Render at 20:17 AEST on 2 Oct (`build_failed`; 0.43.1 kept serving). Render's build runs the whole test suite, and the only failure was `test_slip_import.DraftTests.test_status_counts_drafts_and_spend`: it creates a draft at the fixed test clock (1 Oct 08:00 AEST), while `slip_import.status()` counts "today" on the real clock. It passed on 1 Oct and fails on every later day, including on main 6ee88f1, so any deploy from 2 Oct 00:00 AEST would have failed.
- Fix (test only): the test pins the draft's `created_at` to now before calling `status()`. No app code changes; 0.44.1's changes ship with this build.

## 0.44.1 · 2026-10-02 · `upcoming-note-forward` · Scheduled-tip countdown note in every tip channel; master forwards at once (Grok, Brandon feedback 2 Oct)

- **Countdown note (feature):** a scheduled tip (tipdash queue with a delay, `/create-tip` or `/bulkcreate` with a delay) now posts `⏰ **Upcoming AFL bet** <t:UNIX:R>` straight away in every channel the tip will post to (the sport-routing plan, else the tips channel), only while the server is enabled. Discord's relative timestamp counts down live. New `services/upcoming_note.py`, with a `tip_upcoming_notes(tip_id, channel_id, message_id)` table created at boot (no DDL on the post path). This reworks the 0.41 "incoming play" tease instead of adding a second note: the tipdash (web-built) path never sent that tease, which is why Brandon never saw one for tipdash tips.
- The note is removed at release (`publish_tip`, straight after the master notify; a single partial-message delete, no channel-history scan), and also on a tipdash cancel, a tipdash delete (redact) and `/delete-tip` before release. That closes the 0.41 gap where a cancelled tip's tease stayed up. A tipdash edit before release re-renders it. A pre-0.44.1 tease (id only in `tips.incoming_message_id`) is still removed at release. All note work is best-effort and can never block or fail a tip. An immediate tip makes no extra Discord or DB call.
- **Master forward is immediate (bug):** logs on 2 Oct showed the toxieon_tipping forward of NBA-2026-037 landing about 128 s after release, on the 3-minute full pass after a restart, not via notify. Also, AFL-2026-036 (scheduled) was never forwarded at queue time. Causes: `notify()` dropped the tip whenever the cached master config read "off", and that cache is the all-off DEFAULTS right after boot and for 60 s after any failed config read; `run_once` cleared every dirty tip on any skip, including the transient "master config unavailable"; and the scheduled notify waited the 5 s coalesce. Now notify only drops on a config that really came from the DB (`master_config.cached_trusted()`); a failed read is retried after 5 s (`FAIL_RETRY_S`), not 60 s; a transient skip keeps the dirty tips and retries in 5 s (`TRANSIENT_RETRY_S`); only a real off state clears them; and a scheduled notify is due at once (`SCHEDULED_DELAY_S = 0`).
- **Master label (feature):** the early copy of a scheduled tip now reads `⏰ Scheduled · not released yet · releases <t:UNIX:F> (<t:UNIX:R>)`, giving the full public release date and time plus a live countdown. #107 already forwarded at queue time with a short-time `<t:UNIX:t>` label.
- Speed (item 4, diagnosis only, no change here): `/healthz` reports `db_driver: libsql` (`TURSO_DRIVER` unset). 0.42.2's 3–6 s needs `TURSO_DRIVER=http` (lab: 6.3 s libsql vs 3.2 s http). Today's Turso round trips measured about 2× 30 Sep's. The env var is untouched; switching it is a Ray/Brandon decision.
- No env vars or libraries added. One new table (additive).
- Renumbering: the parked 0.43.1 local-DB and 0.44.1 scale patches still take new numbers when they land.
- Tests: `tests/test_upcoming_note.py` (new) covers the note text, a scheduled web tip's note being removed at release, routed tips getting a note in every channel, immediate tips getting no note or extra send, a disabled server getting no note, tipdash cancel removing the note, tipdash edit refreshing it, a legacy tease being removed, scheduled notify due at once with the `<t:F> (<t:R>)` label, a cold or failed config cache not dropping the notify, a trusted off config still dropping it, a transient skip keeping dirty tips while off clears them, and the 5 s failed-read retry. `test_tip_post_statements`: the scheduled web tip budget goes from ≤ 5 to ≤ 6 (the note's row). `test_sport_routing`: the tease test now expects the countdown note.

## 0.43.1 · 2026-10-01 · `csv-template` · Owner-only CSV template for the Paste tip sheet (Claude, Phase 3 6.5)

- New **`GET /api/owner/tipsheet-template`** (owner-only: `is_platform_owner`, else 403) returns `tipsheet-template.csv`: `#` note lines listing the allowed values (kind SINGLE/MULTI, MULTI = rows sharing a group, side Over/Under or O/U, odds > 1, units > 0, example stat names), the header row and one example row. `dashboard.tipsheet_template_csv()` builds it from `_TIPSHEET_COLS`, the parser's own column list, so the two can't drift. Notes contain no commas, so a spreadsheet won't quote them on save.
- `parse_tipsheet` (`POST /api/owner/import-tips`) also reads that CSV: when the first non-`#` line starts `kind,` and has no tab, rows are read with Python's `csv` module (quoted cells allowed) and `#` lines are skipped. Any other sheet (TSV) is read exactly as before.
- No env vars, tables or libraries added (stdlib `csv`).
- Renumbered: delivered as 0.45.1 on top of 0.44.1; re-cut on 0.42.3 as 0.43.1 because the 0.43.1 local-DB and 0.44.1 scale patches are parked (they take new numbers when they land). Code unchanged from the delivery.
- Tests: `tests/test_tipsheet_template.py` (new): header = `_TIPSHEET_COLS`, the example row parses with no errors, notes list the allowed values and have no commas, a filled CSV with quotes and a MULTI, TSV unchanged, the endpoint's owner gate, and `tests/fixtures/tipsheet_template.csv` (shared with tipdash's test) equals the generated template.

## 0.42.3 · 2026-10-01 · `light-server-rosters` · /api/server without prop counts; one game's roster on its own endpoint (Claude, Phase 3 6.1c)

- **`/api/server`** (`dashboard.server_detail`) no longer runs `attach_current_prop_counts` (it ran twice per page open: queued + settled, each rebuilding a games list with DB reads and possibly AFL HTTP). Everything else in the response is unchanged.
- **New `GET /api/server/prop-counts?guild_id=&month=`** (`dashboard.server_prop_counts`, same access check as `/api/server`): the same tips and the same two count passes, returning only what they add per tip and leg position: `{"tips": {tip_id: [{current, emoji, status, line, side} | {}]}}`. tipdash 0.41.2 loads it after the page paints.
- **`GET /api/fixtures?rosters=0`**: fixtures only (no `afl_roster_players` read). Without the parameter the response is the full payload exactly as before, so an older tipdash keeps working during the TipBot-first rollout. (The handoff asked for `/api/fixtures` to drop rosters outright; doing that would empty an un-updated tipdash's builder between the two merges, so the lean form is opt-in.)
- **New `GET /api/fixtures/roster?game=<game_id or afl_match_id>`** (`dashboard.fixture_roster`, signed-in): one indexed read (`SELECT * FROM afl_roster_players WHERE game_id = ?`), returns `{id, aflMatchId, hteam, ateam}` in exactly the shape `/api/fixtures` embeds per game. 404 for an unknown or finished game.
- No schema changes, no env vars, no new libraries.
- Tests: `tests/test_light_server_rosters.py` (new: roster = the full payload's teams for that game, one query for one game, unknown game, lean fixtures have no players, prop-counts shape and access); `tests/test_server_detail_batch.py` updated: `/api/server` makes no prop-count calls; `server_prop_counts` makes both, off the DB worker.

## 0.42.2 · 2026-10-01 · `post-queries` · A web tip posts in 7 statements instead of 23 (Claude, Phase 3 6.1b)

- **Created row carried through:** `TipService.create_tip_row(draft)` creates the tip, its legs and the audit row in one transaction and returns the stored tip with legs (what `get_tip` would read). The next sequence number is computed inside the tips `INSERT … SELECT`, and the inserts use `RETURNING *`; legs are one multi-row insert. `create_tip()` is unchanged for every other caller (it now calls `create_tip_row`). If a driver ever returns no result set for `RETURNING`, the row is read back inside the same transaction (the old cost, never wrong).
- **Posted row carried through:** `TipService.mark_posted_row()` = `mark_posted` with `RETURNING *`; `publish_tip(guild, tip_id, tip=...)` accepts the row the caller just created. The CAS publish claim is unchanged, so "exactly one post" still holds. Routed posts pass the row to `note_primary` / `post_extras(..., tip=)` instead of re-reading; routing plan inserts all planned `tip_posts` rows in one statement.
- **Settings read once per post:** new `database.call_scope()` + `Database.fetchone_cached()`. Inside one post, identical reads are served from memory; any write this process makes drops cached reads of the written table (an unparsed write drops all). Outside a scope it is plain `fetchone`. `get_customer`, `get_follow_emoji`, `get_channel_ids`, the data-ledger toggle and `TipPostService.routing_enabled` now read whole `customer_settings` / `guild_settings` rows through it, so one post makes one read of each.
- **Counts** (single-leg web tip, real services, fake Discord): single channel **23 → 7** statements; 2-channel routed **46 → 23**. Multi-leg tips stay at 7.
- **Measured** confirm → Discord against a fake Turso adding 0.35 s per request: 0.41.2 on libsql 14.2 s (whole post 20.5 s); this build on libsql 6.3 s (7.9 s); this build with `TURSO_DRIVER=http` 3.2 s (4.0 s). Routed: 24.4 s → 13.4 s (libsql) / 5.9 s (http).
- No behaviour switch: same output, fewer reads. No schema changes, no new env vars, no new libraries.
- Tests: `tests/test_tip_post_statements.py` (new): statement counts (single < 8, routed ≤ 23, multi-leg, scheduled), output parity (the same queue rows posted the new way and the pre-6.1b way in two fresh DBs give identical tips/legs/tip_posts/audit rows, Discord embeds and reactions, #data-store records and mirror calls; single and routed), `create_tip_row` = `get_tip`, sequence numbers (per guild+year, `1000` past 999), `mark_posted_row`, the RETURNING read-back fallback, and call-scope caching/invalidation. `tools/run_tests_on_driver.py` gains `--driver libsql` (whole suite on libsql-experimental's local mode).

## 0.42.1 · 2026-10-01 · `http-db-driver` · Turso queries no longer freeze the bot (switch, default off) (Claude, Phase 3 6.1a)

The 30 Sep perf review found the root cause of the whole-process stalls: `libsql-experimental` runs every call inside a PyO3 method that never releases the GIL, so each 0.3–0.45 s round trip to Turso (Tokyo) froze the Discord loop, every HTTP handler and `/healthz`.
- **New client:** `afl_tipster_bot/hrana_http.py` talks to the same Turso database over its documented HTTP API (`POST /v2/pipeline`, Hrana 2) with the standard library only (`http.client`, keep-alive). Socket waits release the GIL, so the bot keeps running while a statement is in flight.
- **Same interface:** it plugs in under the existing wrappers (`database._LibsqlConnection` for the bot, `dashboard._BigIntSafeConn` for the dashboard worker): same cursor shape (`description`, `fetchone/fetchmany/fetchall` tuples, `rowcount`, `lastrowid`), same implicit-`BEGIN`-on-write transaction rule `_settle_tx` relies on, errors as `ValueError` with the SQLite text, so the unique-violation, busy and stream checks match. Snowflake binding unchanged (`coerce_params` still applied). Callers don't change. `services/brownlow.py` uses the dashboard connection, so it follows the same switch.
- **Fewer round trips:** reads outside a transaction are one request; the implicit `BEGIN` rides with the first write and `COMMIT` with the stream close; a lone `Database.execute` / `dashboard.db_execute` write is one autocommit request instead of two. A stream is only held while a transaction is open, so Turso's idle-stream timeout can't bite between jobs.
- **Recovery kept:** a dropped/expired stream raises an error containing "stream", which the existing reconnect-and-retry paths (`Database.run`, `_on_worker`) already handle; the 0.40.3 panic reset and 15 s abandon timer are unchanged (and the timer can now actually fire on time). Every request has a 20 s socket timeout.
- **Switch (off by default):** new optional env var **`TURSO_DRIVER`**. Unset = `libsql-experimental` exactly as before; `http` = the new client. `TURSO_SYNC_PATH` (embedded replica) always stays on libsql. `/healthz` now shows `"db_driver"` (`libsql` / `http` / `sqlite`) so Ray can confirm which is live; god-mode resync responses carry it too. Rollback = delete the env var. Steps in `RENDER_DEPLOYMENT.md` → "Turso driver switch".
- **Measured** (`tools/db_driver_probe.py`, fake Turso in a separate process with 0.35 s added per request): libsql, 10 ops: longest event-loop stall **1,184 ms**; http: **13 ms**. Indicative op times on the fake: libsql 1.18 s/op (its client makes several requests per statement there), http 0.39 s/op (one request). Not measured against real Turso (no access from this build).
- No new libraries (stdlib only). No schema changes. No data changes. `libsql-experimental` stays in `requirements.txt` for the rollback.
- Tests: `tests/test_hrana_http_driver.py` (new) against `tests/hrana_fake.py`, an in-process Hrana server over a local SQLite file: value round trip incl. snowflakes/blobs, implicit transaction/commit/rollback, request counts, unique violation, expired stream → reconnect + retry, auth error, switch off = libsql called exactly as before, embedded replica stays libsql, dashboard `db_query`/`db_execute`/`_settle_tx`, `/healthz` driver field, and the acceptance probe: a 50 ms asyncio timer keeps ticking (max gap < 400 ms) during a 0.6 s query; dashboard: another thread runs `health_payload()` 10+ times during a 0.6 s query. `tools/run_tests_on_driver.py` runs the whole existing suite with every connection going through the HTTP client (dev aid, not part of the Render build). Full suite 1158 → **1184** OK.

## 0.41.2 · 2026-10-01 · `fwd-state-repeat` · No repeat "Forwarding is on" audit line after a config DB hiccup

- Cause: a failed `master_config` read (dashboard DB busy/timeout) silently fell back to DEFAULTS (all off). The forwarder recorded that as a real "off (master beta off…)" state without posting (the audit gate saw beta off), and the next good read flipped it back to "on" and posted "Forwarding is on. Servers on: #toxieon_tipping" again. No setting had changed (last master event 28 Sep).
- Fix: `master_config.load_status()` reports whether the config really came from the DB; on a failed read the forwarder still forwards nothing but skips with the transient reason "master config unavailable", which is never recorded as a state. `load()` is unchanged for every other caller.
- Forwarding settings, env vars and DB config untouched. Test: `tests/test_forward_state_audit.py::test_config_db_hiccup_is_not_a_state_change` (fails on 0.41.1 with one repeat post).

## 0.41.1 · 2026-09-30 · `priority-forward` · Scheduled tips reach the master at queue time, with images; tipdash can edit/cancel them before release

**Priority forwarding.** A tip queued/scheduled in a tracked, forwarded server (release ≥ 60 s after it was queued) is forwarded to its master mirror channel at queue time: "⏰ **Scheduled · not released yet** · releases <time> (in N min)", gold embed. Odds/stake/bookmaker/leg-text edits before release edit that same message. At release the forward-on-post finds the existing row and edits it to the posted state (jump link, normal colour): no second message. A scheduled tip cancelled before release has its master copy **deleted** and the row parked as `removed` (the only case a forward is deleted; `forward_withdrawn` event). Posted-tip edits/deletes work as before (deletes still edit to "Deleted in source").
- The queued tip → master message mapping is the existing durable `master_forward_posts` row (UNIQUE per tip + master, CAS claim, history adoption), so it survives restarts.
- All forwarding rules unchanged: global switch, pause (rows queue, nothing sends), kill switch, per-server switch, source opt-out, no backfill (scheduled tips count from when they were queued), debug/excluded/master skipped, #master-audit state lines.
- Queue-time notify from `_post_web_tip` (delayed) and `create_tip_entry` (delay); the 3-min full pass also picks up scheduled tips with no forward yet.

**Forward images.** The tip image is re-uploaded with the forward (early and posted copies): the tipdash queue file on disk, else the screenshot URL (Discord CDN hosts only) downloaded at send time. The embed references `attachment://tip-image.<ext>`, never an expiring CDN URL. The filename is stored (`master_forward_posts.image_name`, added in place); an image that appears later is attached once on the next edit. A failed download still forwards, without the image.

**Scheduled tips API (for tipdash 0.41.1).** `GET /api/scheduled-tips?guild_id=` lists unreleased tips (post time, legs, odds, stake, bookmaker, image flag, forward state). `POST /api/scheduled-tip {guild_id, tip_id, action: edit|cancel, odds?, units?, bookmaker?, legs?}` runs on the bot (`services/scheduled_tips.py`): edit reuses `TipService.edit_tip` (+ audit) and updates leg text; cancel is an atomic delete that only succeeds while the tip is unposted and unclaimed. Both record the ledger (`tip.edited` / `tip.deleted`) and notify the forwarder. Same auth as the builder (`can_touch_guild`). An already-posted (or posting) tip returns **409** "This tip has already posted, so it can't be changed here."
- DB config, env vars and forwarding settings untouched. Tests: `tests/test_priority_forward.py` (25). Full suite 1157 OK.

## 0.40.4 · 2026-09-30 · `tip-latency` · Queued web tips reach Discord faster (perf deep dive quick fixes)

- Instant drain: `dashboard.queue_tip`/`queue_tips` wake the bot's web-queue drain right after a successful queue (`services/web_queue_wake.py`: in-process `asyncio.Event` set via `loop.call_soon_threadsafe`). The 5 s / 25 s poll stays as the fallback. A lock keeps the wake and the poll from draining at the same time.
- Post first: web tips (and immediate slash tips) are published to Discord BEFORE the `tip.created` #data-store backup and the master-feed mirror. Both now run after the post attempt, each best-effort and logged, so a failure there never errors the queue row or re-posts the tip (ledger replay keeps posted_at/message id via COALESCE).
- Fixtures/rosters rows memo: 60 s -> 10 min; `AflDataService.store_fixtures` (daily import + live refresh) clears the memos after every write.
- DB config/driver unchanged. Tests: `tests/test_tip_latency.py` (17).

## 0.40.3 · 2026-09-29 · `dash-panic-reset` · Dashboard DB recovers from a libsql panic instead of serving empty data

P0 29 Sep (20:49–21:58 AEST): after a dashboard DB worker timeout, every call on the shared libsql connection panicked (`lib.rs:220`, unwrap on None). The pyo3 `PanicException` is a `BaseException`, so `_on_worker`'s `except Exception` missed it: calls returned `None` (read as empty: tipdash home showed "Nothing here yet") and the connection was never reset.
- `_on_worker` now catches the panic, logs it as ERROR, drops and closes the connection (the next call opens a fresh one) and fails that call with `DashboardBusy` (the existing 503/db_busy path). `KeyboardInterrupt`/`SystemExit` are re-raised on the caller's thread.
- A call that finishes with no result now raises `DashboardBusy` rather than returning `None`. `_reset_conn` ignores a panic from `close()`.
- The timeout/abandon path already starts a fresh connection (unchanged).
- Tests: `tests/test_dashboard_db_panic.py` (2).

## 0.40.2 · 2026-09-29 · `fast-replay` · Startup ledger replay in seconds, same DB result (Claude, Phase 2.2a)

The startup #data-store replay (`restore_on_startup`, newest 750 records per guild) did every record one at a time: about 6–10 Turso round trips each, roughly 9.5 min after every boot, and the embed reconciler, forwarder, mirror, grade worker and ESPN auto-push all wait for it. It now does the same work in a few batched round trips (`services/ledger_replay.py`), with **the identical DB result**:
- **Tips:** each tip's snapshots are folded in memory with exactly `_restore_tip`'s SQL merge rules (overwrite / COALESCE / never downgrade Settled or Deleted to Pending / keep legs on an older Pending snapshot). Tombstones, tip rows and legs are read in batches (50 tips per DB hop), and the final row and legs are written **only when they differ** from the DB. A tip whose snapshots the old code could fail on or partly apply (missing fields, bad odds/units, a NULL in a NOT NULL column, unclean legs, routed `posts`, an int `tip_id`, or an insert that could clash on `(guild_id, tip_year, sequence_number)`) replays through the old `_restore_tip`, snapshot by snapshot, in ledger order.
- **Follows and users:** same statements in ledger order, but reads come from one batched prefetch kept in step with every write, and an UPDATE that would change nothing is skipped. A follow only sees its tip from the ledger position where the old replay created it. If a follow/user record isn't clean enough to cache, that scan uses the old path.
- **Everything else** (settings, games) runs through the old `_replay_event` unchanged. The "last follow event per (guild, user, tip)" rule, the counts `restore_*` return (same keys, same order), and "replay never posts" are unchanged. `EmbedSyncService.reconcile` already starts as soon as the replay flag is set (0.5 s poll + its existing 5 s queue drain); its claim-before-send and bet-results history check are untouched.
- **Kill switch:** `LEDGER_REPLAY_LEGACY=1` forces the old path everywhere (unset = the fast path). Startup now logs the time per guild and the fast-path stats, and "Startup ledger replay done in N s".
- **Measured** (synthetic 750 records × 2 guilds, local SQLite with a statement counter): a steady-state restart went from **5,505 statements to 116**; a replay that has to write most tips went from 6,082 to 222. At the ~100 ms per statement that 9.5 min implies on Turso, that's about 10–15 s instead of 9.5 min.

New optional env var: `LEDGER_REPLAY_LEGACY` (unset = fast path; `1` = the old path). New tables/columns: none.

Tests: 1105 → **1113** (+8 in `tests/test_ledger_fast_replay.py`: the old and new paths replay the same synthetic ledgers from the same DB and must leave every table identical (only `tip_legs.id` is excluded, because the old path re-creates legs, and so their autoincrement ids, on every boot) and return the same counts, twice in a row: 750 records per guild with every edge case above, a recent-window cut, a full replay into an empty DB, and 12 random ledgers (`FAST_REPLAY_SEEDS=200` passed as well); no Discord sends and no duplicate follows; a steady restart uses under 1/20 of the statements and writes no tips; the legacy switch and uncacheable ledgers take the old path and still match; the foldable rules).

## 0.40.1 · 2026-09-29 · `nba-autograde` · NBA auto-grading at final, built and OFF (Claude, Phase 2.1)

Structured NBA player props, graded from the ESPN box score with the same rules as NFL (#91). **Ships OFF:** NBA auto-grade needs the new env var **`ESPN_AUTO_PUSH_FT_NBA`** (unset = off) plus the guild's `feat.auto_push_ft`. The NFL gate (`ESPN_AUTO_PUSH_FT`) is untouched and still off; each gate reads only its own env var, so turning one on never turns the other on.
- **Props** (`services/espn.py`): `NBA_PROP_MARKETS` = points, rebounds, assists, threes made, points+rebounds+assists (PRA), with aliases (`pts`, `reb`, `ast`, `3pm`, `threes`, `pra`, …). `normalize_prop_key(value, league=None)` / `prop_stat_label(key, league=None)`: no league means NFL, exactly as before. `extract_nba_players(summary)` reads the ESPN basketball box score by column **key** (labels as a fallback, never by position), takes the made count from "made-attempted" columns, sums PRA only when all three parts are present, and skips DNP rows. `summary_payload` now carries `players` for NBA/WNBA; `extract_players(summary, league)` dispatches.
- **Queue** (`_queue_tip_inner`): NBA/WNBA legs with `player_id` + prop key + line + side are accepted and normalised like NFL props (`league`, `espn_event_id`, `game_id`). Free-text basketball legs (`custom:true`) are unchanged. A basketball player/stat leg with no prop key is still refused, and an NFL market on an NBA tip is refused as "unsupported NBA prop market".
- **Grading** (`services/espn_autograde.py`): `GRADEABLE_LEAGUES = ("nfl", "nba", "wnba")`; `league_enabled()`, `enabled_leagues()`, `guild_can_settle()`; `enabled()` still means NFL only. Same leg rules as NFL/AFL: a whole-number Over hit wins only when posted as `N+`, a genuine `Over N` pushes, an ambiguous exact hit or text/side mismatch goes to a human, `combine_leg_results` for multis, free-text legs never guessed. NBA/WNBA wait 2.5 h after the start (NFL 3 h). The 3-min auto-push loop only looks at leagues whose gate is on and settles through `TipService.settle_tip` (atomic `WHERE status='Pending'`).
- **On-demand ↻ score refresh** (`score_espn_tip`): NBA/WNBA return live currents and leg grades, but settle only when the NBA gate is on for that guild; otherwise the message says "auto-grade is off (suggestions only)". NFL unchanged. Grade suggestions (`grade_suggest.py`, read-only) now include NBA/WNBA.
- **Builder roster:** new `GET /api/espn/players?league=nfl|nba|wnba&event=<id>` (session required; `espn.players_payload`). `/api/espn/nfl-players` is unchanged and still NFL-only.
- **Live board:** NBA/WNBA structured props show their live box-score count (`_espn_live_snapshot`, `evaluate_espn_leg`), the same path NFL props use.
- **Consensus:** NBA prop legs match on their prop key (`_market` passes the leg's league).
- **WNBA:** the ESPN WNBA box score is the identical shape (checked against a recorded game), so WNBA runs through the same code behind the same `ESPN_AUTO_PUSH_FT_NBA` gate. Nothing WNBA-specific was built.

New optional env var (unset = off): **`ESPN_AUTO_PUSH_FT_NBA`**. New endpoint: `GET /api/espn/players`. New tables/columns: none.

Tests: 1072 → **1105** (+33 in `tests/test_nba_autograde.py`, against recorded ESPN summaries `tests/fixtures/espn_nba_summary_401766125.json` (2025 Finals G4) and `espn_wnba_summary_401736393.json`: the extractor (values match ESPN's game leaders, DNP skipped, reordered columns, label fallback), per-league prop keys, the grading rules (half lines, `N+`/Over N/ambiguous exact hits, threes, PRA, multis, free text/DNP/NFL-market legs never graded, not final), the gate matrix (NBA and NFL independent, guild flag always needed, everything off by default), the auto-push loop (NBA gate settles NBA only once, NFL gate never grades NBA, already settled elsewhere = no second settle), the on-demand refresh (grades shown but no settle with the gate off; one settle with it on), queue validation and the bot-side leg). Two old assertions updated for the new behaviour, not weakened: `test_espn.test_queue_rejects_basketball_props` (an NFL market on an NBA tip is still refused; the message changed) and `test_espn_autograde.test_nba_and_unfinished_are_not_graded` (that NBA tip still never grades; a league with no props still says "free-text").

## 0.39.2 · 2026-09-29 · `fwd-state-dedupe` · Forwarding state line in #master-audit only on a real change

"Forwarding is on. Servers on: …" was re-posted to #master-audit after restarts/reconciles with no change (00:28, 04:07, 07:03 AEST on 29 Sep): the last state lived only in memory, and the boot-time "bot not in master" skip counted as an off→on change.
- The last recorded forwarding state (global switch / pause / enabled channel set) is now persisted in a new one-row table `master_forward_state`, so a restart or reconcile with the same state never posts. First observation after deploy records only.
- Transient skips ("bot not in master", ownership check) are not a state and are never recorded or posted.
- Daily summary unchanged. No forwarding settings changed. Tests: `tests/test_forward_state_audit.py`.

## 0.39.1 · 2026-09-28 · `slip-import` · Slip import from a Discord image, built and OFF (Claude, Phase 1.3)

Brandon shares a Sportsbet bet-slip screenshot; TipBot reads it with a vision model, builds **the same payload tipdash's builder sends**, and replies with a draft and **Post / Edit / Discard**. **Ships OFF:** `master_config.slip_import_enabled=0`, and nothing runs without `SLIP_VISION_API_KEY` too. Owner only (`OWNER_DISCORD_ID`).
- **Resolver** (`services/slip_resolver.py`, deterministic, no AI). Fixture: both teams via `TEAM_ALIASES`, "(W)" → the `comp='AFLW'` fixture, unique on the same Sydney date within ±90 min of the slip time (slip times are Australia/Sydney). ESPN events for NFL/NBA/WNBA the same way. Legs mirror the builder exactly: AFL props `{player, number, team, stat, line, side, assumed, game_id}` from the side's **named** list (`playerListType == "selected"`, as `displayList`), stats mapped to the builder tabs, then the shared half-point helper ("15+ disposals" → Over 14.5 with `line_adjusted_from: 15`, "1+ goal" → Over 0.5). NFL props carry `player_id` from the ESPN roster; NBA/WNBA team picks use the builder's ESPN custom leg (`custom, desc, espn_event_id, game_id, league`). `game_name`/`sport` as the builder sets them (AFLW games are `sport="AFL"` in the builder), odds from the slip, `bookmaker="Sportsbet"`, units = stake ÷ the target server's unit size (half-up, 2 dp, as `dollarsToUnits`). **Every uncertain field is an ask** (player not in the named list or side not named yet, two candidate fixtures, a time outside the window, an unknown market, a low-confidence read, no unit size); a draft with an open ask can't be posted.
- **AFL H2H / line / total legs are an ask, not a leg**: the AFL game builder has no representation for them, so per the handoff nothing was invented. The owner can remove the leg (and fix the odds with Edit). See the Phase 1 report for the options.
- **Import path.** `import_tips` accepts `resolved: true` / `source: "slip"` tips carrying the builder fields (full legs incl. `game_id`, player identity and `line_adjusted_from`, `sport`, `bookmaker`, ESPN ids). Without them TipSheet/Paste behaviour is unchanged. Slips commit with the idempotency key `slip:{draft_id}`, so a double press or a retry posts once; routing (1.1) applies through the non-interactive rule and the draft shows the target channel.
- **Service + API** (`services/slip_import.py`): `create_draft` / `apply` (post, discard, edit, answer) / `post_draft` / `expire`; table `slip_drafts` (status `reading|draft|posting|posted|discarded|expired`, image hash; the same image returns the existing draft). Owner-only `GET/POST /api/owner/slip-import` (status / create from base64), `POST /api/owner/slip-import/settings`, `POST /api/owner/slip-import/{id}` (`post|discard|edit|answer`). Designed so a later iPhone Shortcut can call the create endpoint (it would need its own long-lived owner token; not built).
- **Discord** (`cogs/slips.py`). With the Message Content intent off the bot acts on an image in #slips that @mentions TipBot, `/slip` with an image attachment, or an owner DM; plain posts in #slips get one rate-limited "@mention me or use /slip" reply (they're read directly if the intent is ever turned on). The draft embed shows each leg with its resolved game and line ("adjusted 15 → 14.5"), odds, units and the target server/channel, with ⚠ per ask. Post / Edit / Discard buttons and ask menus are persistent dynamic items (`slip:{action}:{draft_id}`, `slip:ask:{draft_id}:{ask_id}`) re-registered on every start; anyone but the owner gets an ephemeral "Owner only". Edit opens a modal (odds, units, legs text) and re-runs the resolver. The draft reply uses claim-before-send (footer marker `slip {draft_id}`; an uncertain send is resolved from history after 10 min). `/slip` is allowed in the (non-subscribed) master for the owner.
- **Vision** (`services/slip_vision.py`, stdlib HTTP): providers `anthropic` / `gemini` / `openai`, strict JSON extraction prompt (raw text + parsed fields + confidence per leg, no account details), 30 s timeout, one retry (not on 4xx auth errors); parse errors become an ask. Approximate per-slip cost from list prices for the "approximate spend" figure.
- **Privacy.** The image and the raw slip text are never logged. Image bytes are deleted, and the raw text and stake cleared, when a draft is posted or discarded, or after 24 h. The posted tip never includes the screenshot.
- New switches: `master_config.slip_import_enabled` (default 0), `slips_channel_id`, `slip_target_guild_id` (additive columns; masked off by `MASTER_BETA_DISABLE`). **New optional env vars (unset = off):** `SLIP_VISION_API_KEY`, `SLIP_VISION_MODEL`, `SLIP_VISION_PROVIDER` (defaults from the model name). New table: `slip_drafts`. New events: `slip_import_on/off`.

Tests: 1034 → **1069** (+35 in `tests/test_slip_import.py`: golden parity of the example slip with the same tip built through the builder payload (identical `legs_json`, `game_id`s, `game_start`, sport and lines; only provenance differs), AFLW vs AFL, missing player / two fixtures / unknown market / time window / low confidence → asks and Post refused, stake → units or ask, NBA custom leg, same image → one draft, double Post and restart → one tip, image and raw text deletion, switch off / key unset → nothing runs, import-tips unchanged without the new fields, owner-only endpoints, vision adapter (recorded reply, cost, one retry, no key in errors or logs), Discord mention/DM/help/owner-only buttons/draft edits never creating messages/uncertain draft send adopted, dynamic items registered on load). `test_extensions` now expects 12 cogs and the `/slip` command.

## 0.38.1 · 2026-09-28 · `consensus` · Consensus: same bet across servers, built and OFF (Claude, Phase 1.2)

When enough different servers post the **same bet** before the game, TipBot posts one consensus tip in the master server and keeps it updated. **Ships OFF:** `consensus_settings.enabled=0` and `dry_run=1` (preview only). Nothing posts until Brandon turns it on with dry run off; `MASTER_BETA_DISABLE` stops everything.
- **Half-point helper** (`services/lines.py`): a Python port of tipdash `applyHalfPointLine()` (whole N → N−0.5 on Over and Under, `line_adjusted_from`), plus `count_needed` (Over 19.5 → ≥20, Under 19.5 → ≤19, as `grade_prop_final`). Parity vectors `tests/fixtures/half_point_vectors.json`, byte-identical in tipdash. Used for matching only; stored tips are never rewritten.
- **Same bet (leg level)** (`services/consensus.py`, pure engine). Same game (AFL/AFLW `afl_match_id`, else the ESPN event, else a free-text tip's unique fixture by both teams within 7 days, else normalised game name + AEST date), same market (`stat_key_for`, NFL prop keys, or `h2h`/`line`/`total` with the team as the selection), same player (id, else a normalised name with accents/punctuation stripped and a small nickname table) and direction, and the same line after the half-point rule within `line_tolerance` (default 0). So 20 ≡ 19.5 ≡ 20+ Over, 15+ ≡ 14.5, Under 20 → Under 19.5. Legs with no game or unparseable free text are counted in the preview as unmatched. Legs inside multis count (`include_multi_legs=1`); whole-multi "combo consensus" is not built.
- **Counting:** distinct source servers (one server with 3 tipsters = 1). Sources are the tracked servers (enabled + subscription + bot present), minus `feat.master_feed` opt-outs, never the master/consensus guild. Trial servers' tips count; consensus reads no follower or reaction data at all. Threshold = `min_servers` (default 3), raised by `min_pct` of active servers when set (default 0 = off). Window: members within `window_hours` (24) of the latest; `require_before_start=1` (a source posted after the start never counts).
- **Settings:** new table `consensus_settings` (single row) with `enabled 0, dry_run 1, paused 0, min_servers 3, min_pct 0, window_hours 24, require_before_start 1, sports AFL/AFLW/NFL/NBA, line_tolerance 0, include_multi_legs 1, show_sources servers_and_tipsters`. Owner-only `GET/POST /api/consensus/settings` (turning dry run off also needs the beta on and a verified master) and `GET /api/consensus/preview` (read-only; accepts unsaved overrides as query params). `master_config_get` now reports `built.consensus=true`; a separate consensus guild (`consensus_guild_id`) is still refused with `not_built_yet`.
- **Worker** (`services/consensus_service.py`, `bot.consensus_service`). Re-evaluates every 5 min and when poked from `master_forward.notify_bot` (every tip post/edit/settle/delete path already calls it; a no-op while consensus is off). Creates **TipBot Consensus → #consensus** in the master (master lockdown overwrites) the first time it runs with consensus on and dry run off. Posts once when a cluster first reaches the threshold (`consensus_bets` row with UNIQUE `cluster_key`, CAS claim, footer marker `cons {cluster_key}` checked in history before any send, uncertain sends resolved from history after 10 min, 429 honours `retry_after`). Edits live at most once per cluster per 60 s, freezes at game start ("Locked at bounce"), edits to "Below threshold (was N/…)" if sources are deleted before the start (never deletes), and settles with `grade_prop_final` from the sources' final stat counts, else the majority of the sources' leg results at the representative line (✅/❌/➖). Edits never create messages. Consensus bets are not `tips` rows: follows, bankrolls and leaderboards are untouched.

New tables: `consensus_settings`, `consensus_bets`. New events in `master_events`: `consensus_on/off`, `consensus_dry_run_on/off`, `consensus_paused/resumed`, `consensus_settings`, `consensus_channel_created`, `consensus_posted`, `consensus_adopted`. New env vars: none.

Tests: 998 → **1034** (+36 in `tests/test_consensus.py`: half-point vectors, same-bet vectors, distinct-server counting, threshold edge, min %, multi legs, window and before-start, trial sources with no follower query, restart/race = one message, uncertain send adopted, 429, live edit coalesced and never creating a message, below threshold, freeze and settle, dry run and every gate off by default, API validation and preview overrides; `test_master_phase0` now expects `built.consensus=true`).

## 0.37.1 · 2026-09-28 · `sport-routing` · Sport routing: tags → channels, built and OFF (Claude, Phase 1.1)

A server with several sport channels can send each tip to the right channel(s) by tag and keyword rules. **Ships OFF:** `feat.sport_routing` stays default False per server, and with it off every tip goes to the `tips` output exactly as before (same messages, same ledger snapshots, no new rows written).
- **Tags and classifier** (`services/sport_tags.py`, pure). Built-in tags AFL, AFLW, NRL, NFL, NBA (basketball), SOCCER, TENNIS, UFC, RACING, CRICKET, FUTURES, OTHER with default keywords and priorities; servers can edit keywords/priorities and add custom tags. `classify(tip)` order: structured sport first (tip `sport`, ESPN league, or the AFL fixture `comp`, so an AFL builder tip on an AFLW fixture is AFLW), then futures hints, then keywords (only when there is no structured sport). Keyword matching: comma-separated terms, case-insensitive, accent-folded, whole-word (`nfl` ≠ `NFLX`/`conflict`), punctuation allowed (`a-league`), 50 terms × 60 chars per tag. Shared vectors: `tests/fixtures/sport_keywords_vectors.json`, byte-identical in tipdash.
- **Rules → channels** (`services/sport_routing.py`). Tables `guild_routing_settings` (multi-sport mode, non-interactive policy), `guild_sport_routes` (tag → 0..n channels, priority, `post_all`|`ask`, keywords), `routing_memory` (remembered choices per tag set). `resolve(...)` → `single|multiple|none` + channels, tags, reasons, remembered, flagged, `needs_choice`, candidates. Multi-sport defaults to `ask`. A deleted/unpostable channel falls back to the default (`tips`) channel with a flag. Non-interactive posting (import-tips, Paste sheet, slash commands): remembered choice, else the highest-priority tag's channel, else the default channel with a flag (audit row `Tip Routed (flagged)`).
- **API** (`services/sport_routing_api.py`). `GET /api/routing` (settings, channels, remembered choices), `POST /api/routing` (`can_admin_guild`; recorded in the data ledger as `settings.routing`, replayed on a wipe), `POST /api/routing/preview` (`can_touch_guild`; tipdash's post-time popups and the Settings test box). `/api/queue-tip(s)` accept an optional `route` (`{channel_ids, tags, remember, source}`), stored in the new `web_tip_queue.route_json`; TipBot re-checks every channel before posting. Owner import-tips dry-run/commit rows gain `route` + `flagged` when the server has routing on.
- **Per-channel messages** (`services/tip_posts.py`). New table `tip_posts(tip_id, guild_id, channel_id, message_id, role, route_source, sync_rev, synced_at, posted_at, deleted_at, …)` with `PRIMARY KEY(tip_id, channel_id)` and an index on `(guild_id, message_id)`, plus `tips.discord_channel_id` (NULL = the `tips` output). The primary still goes through `try_claim_publish`/`mark_posted`; extra copies use claim-before-send (CAS claim, footer marker `copy {tip_id}` checked in history before any first send, uncertain sends stay claimed and are resolved from history after 10 min, 429 honours `retry_after`, 4xx backs off, edits never create messages). Every message path reads the tip's own channel and its copies: `update_tip_message` (edit/settle/correct/delete), `EmbedSyncService` (+ a copies pass every 5 min), web redact (deletes every copy; the redaction note stays in the primary channel), `/sync-bets`, the reaction lookup (a follow on any copy is the one follow; un-reacting one copy keeps the follow while another copy still has the reaction), the slash-command tease (primary only) and the forward's jump link. Legacy tips resolve as before; with routing on, a lazy primary `tip_posts` row is written when their message is next edited. Ledger snapshots of routed tips carry `posts`, and replay restores them without posting.
- Forwarding (1C) is unchanged: one forward per tip, not per routed copy.
- CHANGELOG wording: the 0.36.2 entry now says the `ALTER`s "could be skipped in prod" (was "were skipped"), per Brandon.

New switches: none (reuses `feat.sport_routing`, default False). New env vars: none.

Tests: 944 → **998** (+54 in `tests/test_sport_routing.py`: shared keyword vectors, classifier order, resolve single/multiple/none/missing/remembered/priority, preview + settings + queue route + import route, 2 channels → exactly 2 messages and 2 rows including restart mid-post, uncertain send, 429, races and ledger replay, edits/settle/redact on every copy, one follow across copies, legacy tip, flag off unchanged).

## 0.36.2 · 2026-09-28 · `forward-columns` · Forwarding: per-server switch column always added (Grok)

- **Bug (found in the 0.36.1 prod check, forwarding still OFF):** `master_access.forward_table_exists()` (the lockdown policy version, which runs at startup) marks `master_forward_channels` ready as soon as the table exists. `master_mirror.ensure_schema()` used the same readiness key, so the 1C `ALTER`s for `forward_enabled` / `forward_enabled_at` could be skipped in prod. Nothing could forward (a missing column reads as off), but the per-server toggle (`POST /api/master/forward/source`) had no column to write.
- **Fix:** `master_mirror.ensure_schema()` now has its own readiness key (`master_forward_channels:1c`), so the additive columns are always added once per process. Still additive only; new column defaults to 0 (OFF).

Tests: 943 → **944** (+1 regression test in `tests/test_version.py`).

## 0.36.1 · 2026-09-28 · `forwarding-1c` · Master server forwarding, built and OFF (Claude, Block 1C)

Each tracked server's tips are forwarded into its #96 mirror channel: **exactly one message per tip**. Later edits, grades, corrections and deletes edit that same message. No channels or categories are created or moved, and nothing is ever deleted. Everything ships **OFF**: `forwarding_enabled=0`, and every server's new `forward_enabled` column defaults to 0. No startup job turns anything on.
- **`services/master_forward.py`** (`bot.master_forward_service`). There is one entry point, `notify(tip_id, reason)`. It is cheap, never raises, and is a no-op unless beta and global forwarding are on. It is called from `publish_tip` after `mark_posted` (so scheduled tips forward when they post), `update_tip_message`, `/edit-tip`, `/delete-tip`, web `_redact_tip`, `broadcast_settlement` (which covers `_settle_tip`, `_settle_match`, auto-push, squiggle and afl_results), `/change-result`, the grade worker, backlog, pending11 and the regrade. The legacy `mirror_*` calls are unchanged, so beta-off behaviour is byte-identical.
- **Format.** New tip: the source `tip_embed` (no follow emoji) plus `From **{server}** · {tipster} · [jump](…)`, with `TRIAL` added for trial servers. The footer is `Tip ID: … · fwd {source_gid}:{tip_id} · rev {n}`. Settled: `result_embed` state plus one reply line (`✅ Win +1.1u · AFL-…`, or `Corrected: Win → Loss (…)`). Deleted: `🚫 Deleted in source ({reason})`. `AllowedMentions.none()` is used on every send and edit.
- **Idempotency.** New table `master_forward_posts` with `UNIQUE(source_tip_id, master_guild_id)`, created with `INSERT … ON CONFLICT DO NOTHING`. A first send needs a CAS claim token. Before any first send, the last 100 channel messages are checked for the footer marker, plus the 100 messages after the tip's post time when it isn't a live post. A match is adopted and not re-sent. A `claimed` row older than 10 min is resolved from history only. Network errors and Discord 5xx count as *uncertain* and take that path, never an immediate resend. A 4xx backs off 1/5/15/60 min, and after 6 attempts the row goes to `dead` with an alert. A 429 honours `retry_after` without using up an attempt. Reply lines are claimed (`reply_rev`) before they are sent. Edits never create messages: a forward removed by hand is logged, not re-posted.
- **Reconciler.** Runs every 3 min and when woken. It handles `rendered_rev ≠ current`, eligible queued/failed rows, and posted tips from the last 14 days with no row (a missed notify), oldest first, ≤60 per run, with tips loaded in bulk. It also runs a sampled duplicate-marker counter (`duplicates_found`). No backfill: a tip only forwards if it was posted after both the global and per-server switch were last turned on (`master_config.forwarding_enabled_at`, `master_forward_channels.forward_enabled_at`).
- **Pacing.** One worker, ≥1.2 s between any two sends or edits (separate from the mirror's `_pace`). Edits are coalesced for ~5 s. The worker never holds a DB slot across a Discord call.
- **Gates** are checked before every send or edit: beta, verified master owned by OWNER_DISCORD_ID, `forwarding_enabled`, not paused, `MASTER_BETA_DISABLE` unset, per-server `forward_enabled`, the source's own `feat.master_feed` opt-out, `guild_gate.is_enabled`, mapping `status='active'`, channel present, and Send/Embed/History permission. Paused, and No Longer Active, keep rows queued; they catch up once when active again.
- **Ops.** `master_events`: `forward_failed`, `forward_dead`, `forward_adopted`, `forward_duplicate`, `forwarding_on/off`, `forwarding_paused/resumed` and `forward_source_on/off` (no `forward_saved`, because a toggle isn't a mapping change). #master-alerts (deduped hourly) gets dead rows, duplicates, a missing channel and lost permissions. #master-audit gets state changes and a daily summary. `last_forward_at` is now written.
- **API.** `POST /api/master/config` now accepts `forwarding_enabled` / `forwarding_paused` (booleans; turning forwarding on needs beta and a verified master). `consensus_guild_id` is still `not_built_yet`. `built.forwarding=true`. New `GET /api/master/forward/status` (read-only counts, queue depth, last error, duplicates, per-source rows) and `POST /api/master/forward/source` `{source_guild_id, enabled}` (owner only, logs on change).
- **Schema (additive only).** New table `master_forward_posts`. `master_forward_channels` gets `forward_enabled INTEGER NOT NULL DEFAULT 0` and `forward_enabled_at` (an ALTER inside `master_mirror.ensure_schema`; the mirror's upsert never writes them). `master_config` gets `forwarding_enabled_at`. No existing rows are rewritten.
- **Versioning (new).** `VERSION` file (`0.36.1`) and `VERSIONING.md` (the bump rule for every merge to `main`). The version shows in `/bot-status` and as `version` in the `/healthz` JSON (`afl_tipster_bot/version.py`). History replay put `main` at 0.35.1 after #96, so this merge is 0.36.1.
- **Inspect.** `/api/inspect/guilds` now also returns `master_forward`: each mirror channel's `forward_enabled` / `last_forward_at` and forward rows by status (read-only), so the OFF state can be checked in prod.

Tests: 905 → **943** (+33 in `tests/test_master_forward.py`, +5 in `tests/test_version.py`; `test_master_phase0` updated for `not_built_yet`). The DB scenarios also pass on the libsql 0.0.55 driver against a local libsql file. Every scenario ends with exactly one forward: restart mid-post (before and after the send), two workers racing, a lost message_id, ledger replay after a wipe (including a forward buried past 100 messages), a mirror reconcile during a send, edits never creating messages, and every gate (global, paused, kill switch, beta/unverified, per-server, opt-out, inert, No Longer Active, trial, no backfill, debug, unposted, tombstoned).

## 2026-09-28 · `mirror-channels` · Per-server mirror channels in the master server (Husker)

Master server **TipBot Master Server** (`1553952007923040309`): one private text channel per tracked tipping server. Channel creation only: forwarding stays OFF and nothing posts into them.
- **Tracked** means the enable gate (`customer_settings` enabled + subscription_active), the bot still in the server, and not the master/consensus server. Today that is Toxieon-Tipping → `#toxieon_tipping` and Tip2 → `#tip2`. The master, tip1 (disabled, bot gone) and Victory Vault (never enabled) get none.
- Categories **Active Servers** and **No Longer Active**. A server that is disabled, loses the bot or loses its settings row has its channel moved to No Longer Active, with history kept (status `archived` or `orphaned`). Re-enabling moves the same channel back.
- **Mapping:** `master_forward_channels` (handoff schema; the lockdown planner already reads it for `source_guild` whitelist scopes), keyed on `source_guild_id`. The topic `TipBot forward · source {guild_id}` rebuilds a lost row; the name is never used. Names are a slug of the server name (lowercase, `_`, suffix `_2` on collision) and are never renamed.
- **Permissions:** created with the lockdown overwrites (`master_lock_overwrites`). @everyone is hidden; the owner, the bot and in-scope whitelist members can see them. A later lockdown apply is a no-op for them.
- **Reconcile** (`services/master_mirror.py`): runs at startup after the ledger replay, every 10 minutes, and about 5 s after any enable/disable (the `guild_gate.invalidate` listener) or guild join/remove. It creates missing categories and channels, re-creates a channel deleted by hand, and moves channels into the right category. It is idempotent. DB work is short separate jobs, never held across Discord calls, and Discord mutations are paced at 1.5 s. It needs master beta on, a verified master owned by OWNER_DISCORD_ID, and Manage Channels + Manage Roles. `MASTER_BETA_DISABLE` stops it.

Tests: +12 (`tests/test_master_mirror.py`).

## 2026-09-28 · `j2-master-setup` · One-time setup of the new master server (Husker, Job 2)

Brandon added TipBot to **TipBot Master Server** (`1553952007923040309`) at 12:11 AEST. He owns it, it has 0 tips and 2 members, and the bot has Administrator. There's no owner dashboard login on the box, so a marker-guarded startup job (`services/master_setup_20260928.py`, marker `master_setup_20260928`) runs the **owner routes in-process**, the same functions `/master` calls, never raw SQL on `master_config`:
1. Backs up the guild's `customer_settings` row and the `master_config` row to `backup_master_setup_20260928` (absent rows are recorded too).
2. Calls `dashboard.master_config_set(owner, {beta_enabled: true, master_guild_id})`. It re-verifies V1–V12 server-side and refuses unless every required check passes. It stores the report and history, and creates the locked `TipBot Master Control` category plus #master-audit and #master-alerts. Lockdown starts OFF.
3. Enables the guild, **not trial**: `ensure_customer` + `set_enabled` + `set_subscription_active`. It runs only after the selection succeeds, so the guild is already excluded from ledger replay, auto-settle and live posts.
4. Re-verifies, so the stored V1–V12 include the control channels.
5. **Lockdown dry run only**: `MasterLockdownService.preview(True)`. The plan summary goes into the marker. No review token is created, nothing is applied, `lockdown_enabled` stays 0.

Guards: `MASTER_BETA_DISABLE` off, bot in the guild, name match, owner = `OWNER_DISCORD_ID`, 0 tips, no *other* master already selected. Forwarding, auto-push and `ESPN_AUTO_PUSH_FT` aren't touched. It runs after the grade worker is ready, because the owner routes use the web→bot bridge. Results show in `/api/inspect/migrations` and `/api/inspect/guilds`.

Tests: +7 (`tests/test_master_setup_20260928.py`).

## 2026-09-28 · `inspect-guilds` · Read-only `/api/inspect/guilds` (Husker, Job 2 prep)

There was no read path that listed the servers TipBot is in, so a newly added guild's id couldn't be found without an owner login. New GET-only endpoint `/api/inspect/guilds`:
- `bot_guilds` presence (id, name, member count, present, first_seen) joined with the `customer_settings` flags: enabled, subscription_active, trial_mode/expiry, and a derived `is_enabled`.
- `live`: each guild in the bot's gateway cache. Owned by `OWNER_DISCORD_ID`? The bot's guild permissions, its top role, roles at or above it, and the channel count. Memory only, with no Discord or DB calls.
- `master`: the `master_config` row with the stored verify report, the last 5 `master_verifications` and the last 20 `master_events`.

Tests: +1 (`tests/test_inspect_api.py`).

## 2026-09-28 · `j1-inert-guilds` · Non-enabled servers are fully inert (Husker, Job 1)

Before: in a server that wasn't switched on, `/bot-status` still showed the full status embed, `/setup-server` and `/connect-existing-server` worked for any admin, and other commands replied "TipBot is currently disabled for this server."
- One central gate (`services/guild_gate.py`, called first in `TipBotCommandTree.interaction_check`). In a guild with no `customer_settings` row, or with `enabled`/`subscription_active` off, **every** slash command, context-menu command and autocomplete is refused. Slash and context-menu commands get one ephemeral line, "This server isn't enabled.", and nothing else. Autocomplete gets an empty choice list. The permission matrix, command-safety checks and the command itself never run.
- **Owner enable path.** Only the bot owner (`OWNER_DISCORD_ID`) passes the gate in a non-enabled server, and only for `/setup-server` and `/connect-existing-server` (they register the server so it shows in the owner dashboard, OFF, to be switched on there) plus the owner-only `/sync` and `/au-signups`. Admins who aren't the owner get the notice. So does the owner's own `/bot-status`. The master-guild exclusion no longer skips this check.
- Buttons and selects on command-created views (`OwnedView` and its subclasses, the `/tip-history` pager, the bankroll-reset confirm, recap settings) run the same check, so a view left open when a server is switched off only returns the notice. The `/follow` "disabled" reply uses the same text. DMs are never gated.
- **No extra DB load.** The enabled lookup is cached per guild for 30 s. `SubscriptionService.ensure_customer/set_enabled/set_subscription_active`, the dashboard `flip_toggle`, trial-expiry disable and ledger customer-settings restore all invalidate the cache, so a switch-on or switch-off takes effect on the next interaction. On a DB error a cached value is reused. With nothing cached, the error propagates as before.

Tests: +22 (`tests/test_guild_gate.py`).

## 2026-09-28 · `p3-lockdown-worker` · Maintenance worker + leaner lockdown (Husker, P3 #3/#4)

**#3: long maintenance jobs on their own worker.** `master_lockdown` / `master_whitelist_apply` used to run inline in the web-action drain loop. A 100-channel lockdown (about 2.5 min at the intentional 1.5 s edit pace) held up every settle, redact and moderation queued behind it.
- The owner and startup-replay gates still run inline, so a bad request errors immediately. The job then runs as a background task, one at a time in claim order (`asyncio.Lock`), and marks its row done or error when it finishes. The drain loop keeps going.
- A restart mid-job leaves the row `processing`, the same as before. The service still re-checks the kill switch, verification and ownership before every Discord edit.

**#4: lockdown tightening.**
- `master_access.ensure_schema()` (4× `CREATE TABLE IF NOT EXISTS`) runs once per DB connection generation. It is remembered in `dashboard._schema_ready`, which is cleared whenever a worker is reset or abandoned. The `master_forward_channels` existence check caches only a positive answer.
- `apply()` used to re-read the whole policy (whitelist + scopes + forward table check + forwards, via separate DB jobs) before **every** channel edit. It now does a one-query **policy version** check: the newest `whitelist_saved/whitelist_removed/forward_*` event id, plus forward-row count and max rowid once that table exists. It re-reads only when the version moved. Every whitelist change writes its event in the same transaction, so a member removed mid-apply is still never re-added. The initial read is one DB job.
- Unchanged: forced `mc.load(True)` and `guard()` (kill switch, beta, verification, ownership, permissions) before every edit, plus the extra `guard(mc.cached())` right before `channel.edit`.
- P2a follow-up: the customer_settings column cache is also tied to `_schema_ready`.

**Assessed, not changed**
- The slow first reconcile (about 9.5 min after boot) comes from the startup ledger replay: for each guild, 750 recent #data-store records are replayed **one at a time**, each a few remote Turso round-trips. The reconcile's `before_loop` waits for it. A real fix (replay only the newest snapshot per tip, the way follows already do, or skip records older than the DB row) touches restore semantics on prod data, so it needs a replay test on a real guild and Brandon's OK. Left as a proposal.

Tests: +8 (4 in `tests/test_master_lockdown.py`, 4 in `tests/test_web_maintenance_worker.py`).

## 2026-09-28 · `p2-us-grading` · NFL auto-grade at final, AFL rules (Husker, P2c)

AFL has auto-push at FT (`feat.auto_push_ft`): grade and post pending tips with no click. NFL now has the same, driven by the ESPN box score (the TipBot #86 / grade-suggestion path).
- New `services/espn_autograde.py` (pure helpers) and a `LivePlaysCog.espn_auto_push_loop` (every 3 min). For each guild with `feat.auto_push_ft`, pending posted NFL tips whose ESPN event is **final** are graded and settled through the existing `TipService.settle_tip` (atomic `WHERE status='Pending'`). They are then broadcast with `send_result_embed=False` and posted as **one** combined results sheet, the same sheet/admin-log code as AFL (refactored into `_post_auto_push_sheet`). A tip already settled by a person, a suggestion or the web queue raises `ValueError` and is skipped, so nothing is double-posted. Each event is handled once per process.
- **Rules = AFL final-prop rules.** An exact hit on a whole-number Over wins only when posted as `N+`, pushes for a genuine `Over N`, and goes to a human when the text can't tell. Text/side that disagree are never graded. Multi-leg uses AFL `combine_leg_results`: any Loss → Loss; all Win → Win; single-leg Push → Push; Win+Push or multi all-Push → human.
- **Structured props only.** Every leg needs an ESPN `player_id` + prop key with a box-score value, or the whole tip is left for a human. NBA/WNBA legs are free text today, so they are never auto-graded (logged as skipped).
- **Guards:** only asks ESPN 3 h after start and up to 4 days, at most 8 events per pass (one summary per event, not per tip). It waits for the ledger replay after a restart, skips master/consensus guilds and disabled subscriptions.
- **OFF in prod:** needs env `ESPN_AUTO_PUSH_FT=1` **and** the guild's `feat.auto_push_ft`. Neither prod guild has `feat.auto_push_ft` on, and the env var is not set.
- Unchanged: the one-tap grade suggestion and on-demand ESPN score refresh still use `espn.combine_leg_results`, which treats a multi of all Pushes as Push. Only the new no-click path defers that case to a human.
- Tests: +12 (`tests/test_espn_autograde.py`): half lines, exact whole-number N+/Over N/ambiguous, Under exact, ambiguous side, multi rules, missing stat, free text, NBA, not final, due window, one settle + one sheet per event, already-settled posts nothing, not-final retries, inert unless both flags + replay done.

## 2026-09-28 · `p2-master-picker` · Legacy master suggestion + resolver (Husker, P2d)

- **Master picker**: the "legacy master" suggestion uses `MASTER_GUILD_ID` when set. Otherwise it asks `cleanup_pending11.locate_master(bot, legacy_only=True)` on the bot loop (10 s cap), which also finds the old master from stored master channel ids. This is read-only and best effort: if the bot isn't ready or Discord is slow, the picker just has no suggestion. The response gains `legacy_master_via` (additive).
- **cleanup_pending11 → resolver**: `locate_master()` now starts from `master_config.master_guild_id(bot)` (the DB-selected master when the beta is on, else `MASTER_GUILD_ID`). `legacy_only=True` ignores the DB selection. The mirror-scan detail reports both `env_master_guild_id` and `resolved_master_guild_id`. Both prod scan markers were written on 2026-09-26, so the scans do not re-run.
- **cogs/live_plays.py**: removed the unused local `game_matches_tip` import and the unused `home`/`away`/`shim` locals in `_tips_for_live_game`. The module-level import and the other two `shim` uses are still live and were kept.
- Tests: +8 (4 in `tests/test_master_picker_legacy.py`, 4 in `tests/test_cleanup_pending11.py`).

## 2026-09-28 · `p2-server-detail-batch` · One DB job per server open (Husker, P2a)

Opening a server in tipdash (`GET /api/server`) used to take the shared dash-db slot about 18 times, once per `db_query`. Any overlap with a poll could fail with "dashboard db busy" and make tipdash retry the whole request.
- `server_detail()` now runs its reads as **one** `_on_worker` job (nested queries run inline on the job's connection). It uses `wait_slot=1.5` s so a brief collision queues instead of failing, and a timeout of 2× the DB timeout (min 15 s) for the whole read.
- Feature flags are resolved **once** from the customer_settings row (auto-send and auto-push-FT share them). Follow emoji and the data-ledger switch come from one guild_settings read. The trial badge reads this guild's row, not the whole table. Calendar months and the profit sparkline share one query.
- The AFL live/FT prop counts (HTTP) run **after** the job, never while holding the DB slot. `server_tips()` is split into a DB half and a network half, and its external behaviour is unchanged.
- `_ensure_guild_settings_ledger_column()` is remembered in `_schema_ready`. It used to attempt an `ALTER TABLE` (failing with "duplicate column") on every data-ledger read, up to 3 per server open.
- The response is unchanged. The pre-P2a implementation is kept as `_server_detail_legacy` and the tests use it as the parity oracle: owner and mod, lifetime and per month, blank guild, `ENABLE_DATA_LEDGER=0`.
- Tests: +7 (`tests/test_server_detail_batch.py`): parity, 1 slot vs ≥10 before, prop counts run off the DB worker, ledger ALTER runs once. Full suite **835 passing** (Linux, libsql 0.0.55). The libsql-driver parity smoke also matches.

## 2026-09-27 · `b2-landing` · Landing patches (Husker)

Landed Claude's feature pass + master Phase T/0/1A and Codex phase 1B on top of `44ec556`. Everything new stays inert in prod: master beta, lockdown, forwarding, trial mode, AU sign-up gate, `FEATURE_HEATMAPS` and `FEATURE_COMPARE` are all off, and no master is selected.

**Checked (already in the Codex build, verified)**
- Trial set loads during `setup_hook` and `MasterCog.config_refresh` retries every 60 s tick until it has loaded, so trial servers are never tracked by accident after a restart.
- `_guild_tip_count` returns `None` on a DB error and V3 / candidate eligibility fail closed.
- Master beta switch has a confirm dialog (tipdash `master/index.html`).
- Lockdown only edits Discord after an owner dry run + explicit confirm (review token bound to actor, guild, policy and live overwrites, 10 min expiry). Every repair, whitelist and census path also requires `lockdown_enabled`, which only a confirmed apply can set. No extra flag was needed.

**Changed**
- `MasterFeedService.register_guild_views` keys off the new `legacy_configured` (`MASTER_GUILD_ID` set) instead of `enabled`. With the master beta on, legacy mirroring stays muted but already-posted settings-panel buttons keep registering after a restart.
- Ledger replay of `settings.customer` now also updates the bot's in-memory trial set right away. Before, a wiped/replayed trial server was tracked until the next 5-minute refresh.
- `set_trial_mode` re-records the server's `settings.customer` ledger snapshot on the bot loop. This is best effort and fire-and-forget: one #data-store write per owner toggle. Without it, trial state never reached the ledger, so replay couldn't restore it.

**Tests**
- New `tests/test_trial_landing.py` (9): ledger replay restores trial (DB + memory), old snapshots leave trial alone, a paid→trial follow still settles (follow + bankroll), trial→paid starts tracking, an existing follow survives an un-react during trial, the toggle records a ledger snapshot and still works with no bot, the startup trial load retries every tick, and legacy settings buttons register with the beta on.
- Linux / Python 3.12 with the real `requirements.txt` (`libsql-experimental` 0.0.55): **828 passing**. A libsql-driver smoke test (local libsql file, no Turso creds on the box) covers the new schema (idempotent), master config, whitelist, notice claims (`RETURNING`), signup gate, trial toggle and the Sydney-month SQL.

**Normalised**
- Codex's Windows CRLF line endings converted back to LF (3 test files, `master_access.py`, CHANGELOG/REMAINING).

## 2026-09-27 · `master-lockdown` · Phase 1B (Codex, local continuation)

Master lockdown now has a pure permission planner, a dry-run receipt, an owner-confirmed apply queue, scoped whitelist access and drift/census auditing. Only the currently selected, verified, owner-controlled master can be edited. All new behavior remains off by default.

**Changes**
- Added `services/master_lockdown.py`, `master_access.py` and `master_access_api.py`; wired existing MasterCog loops, bot events and the web-action bridge.
- Per-channel diff; receipt binds actor/master/policy/verification/current overwrites for 10 minutes. Separate reviewed default-role choice. Recheck on dequeue and before each edit. Serialized 1.5-second permission-edit budget; no-op edits skipped.
- Read-only whitelist by default; channel, category and future source-guild scopes, exact TEXT IDs, transactional audit + queue. Removes revoked access and only targets affected channels for whitelist actions. Expiry proposal rejected.
- Startup/10-minute drift audit, immediate channel-create scheduling, 5-second channel-update debounce, repeated-drift and Administrator/View Channel alerts, 5-minute approximate member census with presence-checked whitelist. Loops wait for bootstrap/replay.
- Ownership transfer or bot removal pauses forwarding, disables repair and invalidates verification. Switching masters clears inherited lockdown/control-channel state. Config endpoint can pause repair; enabling requires reviewed apply.
- Durable audit/alert send claims and markers; ambiguous sends are logged, never automatically duplicated. Existing Claude-created control channels are located by their locked control category if IDs were not persisted.
- Persist control/audit/alerts IDs on master selection. Config writes use one DB worker slot and never persist flags masked by the kill switch.
- Master endpoints: owner-only `POST /api/master/lockdown`, `GET/POST/DELETE /api/master/whitelist`, `GET /api/master/events`, `GET /api/master/action`; busy responses use 503. CORS permits DELETE.
- `docs/MASTER_LOCKDOWN.md` documents flows, migration/defaults, recovery behavior and manual validation.

**Migrations / defaults**
- Additive tables: `master_whitelist`, `master_whitelist_scopes`, `master_lock_reviews`, `master_notices`. Existing action/event tables reused.
- Additive master config columns: `lock_everyone_role=1`, `auto_remove_foreign_overwrites=1`; control/audit/alerts channel IDs and member count nullable.
- `beta_enabled=0`, `lockdown_enabled=0`; no new feature enabled. Optional `ENABLE_MEMBERS_INTENT` defaults false, requires the Portal toggle if enabled later, and was neither set nor added to `render.yaml`.
- Whitelist mutations affect only owner-selected records at runtime. No destructive migration, legacy-channel deletion or production data change.

**Validation**
- Full suite: **819 passing** (796 inherited + 23 new), zero skipped. Covers planner/scope/read-only behavior, no-op diffs, role locks, receipt/queue rejection, owner transfer, flags-off/kill-switch guards, drift/debounce/census, notification claim/restart behavior, transactional rollback, and HTTP 401/403/CORS.
- Python compile, 11 extension loads and command registration, local HTTP health checks, Discord/Render validator pass.
- Untouched local baseline had 796 tests and 199 Windows resource-cleanup errors. No assertion was removed or weakened to make the final suite pass.

**Unplanned / extra**
- Brandon explicitly overrode the GitHub-main prerequisite. Base is the local snapshot plus Claude's ALL-IN-ONE overlay, not Husker's merged branch.
- Reimplemented three needed landing fixes locally: V3 fails closed on unavailable tip counts; trial set loads during startup and retries until successful; dashboard beta switch confirmation. Compare these against Husker's eventual patch to avoid duplicate work.
- Fixed dashboard connection reset to close on its owning worker, and corrected old tests' DB/worker resource cleanup on Windows (odds fixtures, partial-fixture test, timed-out-worker fixture). Assertions unchanged.
- Consume optional request bodies on auth refresh and unsupported/inspect methods before closing HTTP/1.0 connections; this fixes intermittent Windows socket resets surfaced by existing tests.
- Extended `.gitignore` for environments, local DBs, logs and reports.
- Brought forward Lockdown & access and Audit log UI from block 3 so this block is reviewable end to end (dashboard companion).

**Skipped / deferred**
- No authenticated GitHub TipBot access: no PR, merge, checkpoint tag or deploy. Changed-file delivery and PR notes supplied for Ray/Husker.
- Husker's legacy picker `locate_master()` suggestion and cleanup resolver patch remain upstream reconciliation items. Existing local code was not silently changed there.
- Discord test-guild M3–M7 (and M1/M2 setup) still belong to Ray. Non-member overwrites and real forum/voice permissions require that check.
- Turso's optional native driver did not compile on this Windows host (missing C++ linker); tested SQLite locally; keep the Linux/Turso deploy check.
- Forwarding, remaining Forwarding/Consensus tabs, routing, consensus and unapproved proposals remain in REMAINING.md. Notification delivery uses at-most-once claims; phase 1C's history-adoption/retry machinery is not substituted by this audit helper.


## Summary of this build (2026-09-27 AEST, Claude)

- **Base:** `44ec556` (PR #86). **Tests:** 723 → **796**, all passing.
- **Phases completed:**
  - From `tipdash-tipbot-handoff`: live board, heatmaps stub, Sydney time and overlapping games, AU sign-up gate, Compare.
  - From `TIPBOT_MASTER_SERVER_HANDOFF`: **Phase T** (trial mode), **Phase 0** (foundation), **Feature A** (master select + verify).
- **Flags left OFF:** `master_config.beta_enabled`, `lockdown_enabled`, `forwarding_enabled`, `forwarding_paused`; `feat.sport_routing` (new, per server); AU sign-up gate (`platform_settings.signup_gate_au`); tipdash `FEATURE_COMPARE` and `FEATURE_HEATMAPS`. Every server's `trial_mode` is 0 by default.
- **Flag ON (unchanged default):** `feat.master_feed` (now actually read).
- **Known gaps and follow-ups:** see `REMAINING.md` (master Phase 1B lockdown, 1C forwarding, 2 routing, 3 consensus, proposals; plus the open items from the feature pass).
- **Optional env toggles added, none set, none in render.yaml:** `MASTER_BETA_DISABLE` (forces all master flags off).

---

## 2026-09-27 · `trial-mode` · Feature G: per-server trial mode (follower tracking off)
**Added**
- `services/trial_mode.py`: in-memory trial set (`is_trial`, `set_guild`, `load_rows`, `expiry_actions`, `status_of`).
- `dashboard.set_trial_mode`, `trial_status_map`, `ensure_trial_columns`.
- `POST /api/server/trial {guild_id, trial_mode, trial_expires_at, on_expiry}` (**owner only**).
- `MasterCog.config_refresh` loop (60 s): refreshes trial servers every 5 min and handles expiries (`handle_trial_expiry`: `stay_trial` | `convert_paid` | `disable_bot`), DMing the owner once.
- `tests/test_trial_mode.py` (6).

**Changed**
- `cogs/users.py`: `on_raw_reaction_add` / `on_raw_reaction_remove` return **first line** for trial servers, before any DB read, Discord fetch or DM. `/sync-bets` refuses in trial servers.
- `servers_for`, `server_detail` and `follower_overview` now return trial fields for badges and the banner.
- Ledger `settings.customer` payload and replay now carry `trial_mode`, `trial_expires_at`, `trial_on_expiry`, `tracking_started_at`.

**Turso migrations (additive, `customer_settings`):** `trial_mode INTEGER NOT NULL DEFAULT 0`, `trial_expires_at TEXT`, `trial_on_expiry TEXT NOT NULL DEFAULT 'stay_trial'`, `tracking_started_at TEXT`, `trial_changed_by TEXT`, `trial_changed_at TEXT`, `trial_expiry_handled_at TEXT` (the last is extra, a marker so each expiry is handled once). Added in both `database._migrate` and `dashboard.ensure_trial_columns`.

**Audit:** `audit_log` rows `trial_mode_on` / `trial_mode_off` with before/after.

**Unplanned / extra**
- `trial_expiry_handled_at` column (needed so expiry actions run once).

**Skipped / deferred**
- `trial_mode` not added to `TOGGLE_COLUMNS` / `POST /api/toggle`. A plain flip can't set expiry, update the bot's in-memory set or write the audit row, so the dedicated endpoint is the only way in.
- "Follower-dashboard follow endpoints → 403" was not needed: no such endpoints exist (follows only come from Discord reactions and `/sync-bets`, both gated).
- Proposals (hide follow emoji on trial, skip data-ledger writes, import trial reactions) not built.

## 2026-09-27 · `master-phase0` · Master server foundation (no behaviour change with flags off)
**Added**
- `services/master_config.py`: single-row config with an in-process cache (no DB I/O on hot paths), `save`, `log_event`, and resolver `master_guild_id(bot)`, `consensus_guild_id(bot)`, `is_excluded_guild(bot, id)`. `MASTER_BETA_DISABLE` kill switch.
- `tests/test_master_phase0.py` (13): flags-off-is-legacy, resolver, kill switch, TEXT ids, cache no-I/O, legacy mirror gating, checklist, owner gates, endpoints.

**Changed**
- Every `settings.master_guild_id` read now goes through the resolver:
  - `bot.py`: the interaction bypass and the ledger replay skip;
  - `cogs/afl_results.py`, `cogs/squiggle.py`, `cogs/live_plays.py` (×2): master/consensus excluded;
  - `cogs/master.py`: game import, `/master-sync`.
- `services/master_feed.py`:
  - `enabled` is now **env master set AND beta off**, so the legacy mirror no-ops when the beta is on;
  - `mirror_upcoming` / `mirror_result` also respect the new per-source reader `source_forward_on()` for `feat.master_feed`, which was registered but read nowhere before. Its default is on, so nothing changes unless someone turns it off.
- `services/feature_flags.py`: `feat.master_feed` relabelled "Forward to master server"; **new `feat.sport_routing` (default False)**.

**Turso migrations (new tables):** `master_config` (id=1 row, flags + `master_guild_id` / `consensus_guild_id` TEXT + verify report), `master_verifications` (history), `master_events` (event log).

**Skipped / deferred**
- The legacy MasterFeedService still keys off the env master (it's the legacy path); only exclusions and MasterCog use the DB master.
- The rest of §12's tables (forward posts/channels, whitelist, routing, consensus) are deferred to their phases.

## 2026-09-27 · `master-select` · Feature A: master selection + verification
**Added**
- `services/master_verify.py`:
  - pure `build_report(facts)`: V1–V12 with levels required/warn/info/optional, plus V4b "Mention Everyone granted" (warn);
  - `collect_facts` on the bot loop;
  - `ensure_control_channels`: `TipBot Master Control` / `#master-audit` / `#master-alerts`, created **locked at creation**.
- `dashboard.master_candidates`, `master_verify`, `master_config_get`, `master_config_set`, and `_run_on_bot` (the same bridge as `/api/grade-probe`, 20 s).
- **Endpoints (owner only):**
  - `GET /api/master/config`
  - `POST /api/master/config` (`beta_enabled`, `master_guild_id`; setting a master **re-verifies server-side** and refuses on any failed required check)
  - `GET /api/master/candidates`
  - `POST /api/master/verify {guild_id}`
- Events logged: `verify`, `master_set`, `beta_on` / `beta_off`.

**Skipped / deferred**
- `POST /api/master/config` refuses `lockdown_enabled`, `forwarding_enabled`, `forwarding_paused` and `consensus_guild_id` with `not_built_yet` until those phases land.
- Known-member count in V8 is owner + bot only (the whitelist arrives with Feature B).
- `/master-status` Discord command not built (optional in the spec).

---

## 2026-09-27 · Feature pass (`tipdash-tipbot-handoff`), five PRs
Full details in each drop's `PR_NOTES.md`.
- **`live-board`**:
  - `GET /api/live-board` (auth optional; tips only when signed in);
  - `services/live_bets.py` board helpers;
  - cross-game leg routing;
  - `/live` in the OAuth `return_to` allowlist;
  - `tests/test_live_board.py` plus the ESPN fixtures.
- **`heatmaps`**: `services/heatmap.py` (stub, no licensed XY source), `GET /api/heatmap`, `docs/HEATMAPS.md`, `tests/test_heatmap.py`.
- **`sydney-time`**:
  - `afl_tipster_bot/timeutil.py`;
  - calendar, months and sparkline bucketed in Sydney days;
  - `bot.py` Melbourne hard-code removed;
  - overlapping-games guards in `services/live_plays.py` and `cogs/live_plays.py` (auto-push and nudge skip cross-game multis);
  - tests `test_timeutil.py`, `test_overlapping_games.py`, plus `test_units_calendar.py` (one existing test's timestamp changed 14:00 → 13:00 UTC, same intent).
- **`signup-gate`**:
  - `services/signup_gate.py`, `/api/signup/region`, `/api/owner/signup-gate`, `/api/owner/signup-override`;
  - Discord `/au-signups on|off|status` (owner id only);
  - `_session()` now rejects `k`-claim tokens;
  - tables `platform_settings`, `signup_region_decisions`, `signup_region_audit`, `dashboard_logins`;
  - `tests/test_signup_gate.py`.
- **`compare`**: `services/compare.py`, `GET /api/compare` (cache only, 0 credits), `tests/test_compare.py`.
- **Unplanned / extra (feature pass):** the `k`-claim session hardening; the Scores UTC-date bug fix; the `/au-signups` command (asked for mid-build).


## Summary of this build (Codex continuation)

Phase 1B and its access/audit UI are implemented locally, all defaults remain safe, 819 backend tests pass. The next block is 1C forwarding; production and PR work were not performed.
