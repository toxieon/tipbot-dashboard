# Handoff note: tipdash-lazy-views (job 03)

Branch `claude/tipdash-lazy-views`, cut from main `9fdb3b6` (0.66.3).

**Rebased on 18 Oct (evening) onto tipdash main `c025ebd` (0.66.7)**, which moved after the pack was written. `index.html` merged cleanly. One conflict was in `tests/form_badges.test.js`, where main dropped its `VERSION` read; resolved by keeping both changes. On the new main, `TD.version` is the `__TD_VERSION__` publish placeholder, so `tests/lazy_views.test.js` now expects that, the same way main's `split.test.js` does. Its fake-DOM server id is now the made-up `100000000000000001`, matching main's change to `split.test.js`. Results on 0.66.7: `npm test` 440 pass on main, 447 on this branch. `build-public` ok (142 → 144 files). e2e: main 21 pass and 4 fail; this branch 24 pass and the same 4 fail (the `follower-live` specs launch their own browser, which this sandbox can't run; main has fixed the old CORS smoke failures). Sizes on 0.66.7: index.html 531,234 B → 493,884 B (−37,350 B raw, −8,207 B gzip), the same saving as below. The rest of this note was written against 0.66.3.

## What changed
- **`assets/follower-views.js`** (new, 397 lines). This is the Followers view (`openFollowerView`, `renderFollowerView` and its all-time units helpers), the all-communities rollup (`openFollowerAllView`, `renderFollowerAllView`, `ROLLUP_CONCURRENCY`), the promo chip (`promoChipHidden`, `dismissPromoSlot`, `mountFollowerPromoChip`) and My Tips (`openMyTips`). It's a verbatim move with a header comment, ending in `TD.loaded["follower-views"]=true;`.
- **`assets/discover.js`** (new, 195 lines). This is Discover: `dcGuildAvatar`, `dcRecentVals`, `dcMiniSpark`, `pickFeaturedTipster` and `openDiscover`. It's a verbatim move, ending in `TD.loaded["discover"]=true;`.
- **`index.html`**:
  - There are now 4 one-line placeholders: `openFollowerView`, `openFollowerAllView`, `openMyTips` and `openDiscover`.
  - A small `lazyView(name, fn, pane, self, args)` helper paints the panel's existing NDSkeleton straight away on the first open, then goes through the existing `TD.call` loader. If the file can't load, `TD.call` shows its toast ("Couldn't load the follower screens / Discover page. Check your connection and try again."), and the panel shows "Couldn't load this screen" with a **Try again** button rather than a blank screen.
  - After the `load` event, an idle-time `TD.load` warms both files. It uses `requestIdleCallback`, with the same `setTimeout` 2.5 s fallback the Stats warm-up uses, because Safari has no `requestIdleCallback`. I didn't use `<link rel="prefetch">` because iOS Safari ignores it.
  - **Also kept in index.html, even though the brief listed them for moving.** `tipTimeMs` stays because the upcoming tips list calls it (about line 6516 on main). `unmountFollowerPromoChip` stays because `panel()` calls it on every panel switch: a placeholder there would load the file on every switch.
  - **One wording change outside the moved blocks:** `TD.call`'s failure toast now names the two new files. It used to say "admin tools" for anything that wasn't the builder.
- **Tests**:
  - New `tests/lazy_views.test.js` (7 tests). It checks that each placeholder loads the right file and paints the right panel, that neither file is a `<script src>`, and that each file compiles, stays sloppy-mode, declares its entry points and sets `TD.loaded` last. It checks that no moved helper is referenced by index.html or any other `assets/*.js`, that the two files don't overlap, and that the idle warm-up and public-build inclusion are in place. It also runs a mocked-API smoke (copied from `split.test.js`'s fake DOM): a cold load fetches neither file; the first open shows the skeleton straight away; follower-views.js is fetched once for all three follower screens and discover.js once; and a failed load gives the toast plus the panel retry, which then works.
  - New `tests/e2e/lazy-views.spec.mjs` (3 tests at 390×844). From a cold load, it opens the Followers view, then My Tips via the promo chip, goes Back, opens Discover via the chip, and goes Back again. It also covers the all-communities rollup, and a hard refresh on `#/discover` and `#/mytips`. It asserts no page errors, no horizontal overflow and **no new tab or window**.
  - I updated 6 existing tests that read view code out of index.html so they read index.html plus the lazy files, with the assertions themselves unchanged: `apple_design` (navNote check), `discover_sports`, `follower_live`, `follower_units` (one slice end moved from `unmountFollowerPromoChip` to `openMyTips`), `form_badges` and `home`.

## Caller map (grepped on main before moving)
| Function | Callers outside the moved block |
|---|---|
| `openFollowerView` | router `#/s/<id>/follow` (index ~1863), home follower card click and keyboard (~2876–2877), `enterHome` single-follow (~5137), Game view back (~5425), owner "view as follower" button (~7625), Discover cards and My Tips back (now inside the lazy files), tests |
| `openFollowerAllView` | router `#/following` (~1874), home "All communities" card (~2868–2869), `enterHome` (~5138), tests |
| `openMyTips` | router `#/mytips` (~1871), the promo chip (now in follower-views.js), tests |
| `openDiscover` | router `#/discover` (~1872), the promo chip (now in follower-views.js), tests |
| `unmountFollowerPromoChip` | `panel()` (~1821) and Discover, **so it stays in index.html** |
| `tipTimeMs` | upcoming list sort (~6516), **so it stays in index.html** |
| everything else moved | nothing outside the block |

None of `assets/routing.js`, `discover-sports.js`, `follower-units.js`, `follower-live.js` or `server-view.js` calls a moved function: they only provide helpers that the moved code calls.

## Size
| | Raw | gzip -9 | Lines |
|---|---|---|---|
| index.html before | 522,285 B | 137,559 B | 8,714 |
| index.html after | 484,935 B | 129,332 B | 8,170 |
| **Saved** | **37,350 B (7.2%)** | **8,227 B** | 544 |
| follower-views.js (lazy) | 29,195 B | 7,931 B | 397 |
| discover.js (lazy) | 11,756 B | 4,018 B | 195 |

**The 60 KB target isn't met.** The blocks the brief names add up to about 41 KB of source, and nothing else in index.html is used only by these views (I checked every top-level function). Reaching 60 KB would mean going past this job's scope. Two options for Husker:
1. Move the Discover and promo-chip CSS (about 9 KB) into the lazy files. That's awkward, because `.dc-empty` and `.tb-comm-chip` are also used by other screens, and `theme-apex.js` and `theme-apex.css` style `.dc-*`, so it needs a careful cascade check.
2. Move the Followers management screen (`openFollowers`/`renderFollowers` plus moderation and map, about 11.5 KB of the region the brief says to keep) behind its own placeholder.

On first-load transfer: the home screen now downloads 37 KB less HTML before it can parse. Both lazy files arrive later, at idle. `npm run perf` (`scripts/perf-headless.mjs`) times out waiting for the app on main as well as on this branch, so I measured with Playwright instead: index.html went from 522,285 B to 484,935 B on a cold home load. Neither lazy file is requested before the `load` event, and both show up afterwards at idle.

## Visual check (pixel for pixel)
I ran the new e2e spec against main and against this branch, with `reducedMotion: "reduce"` to stop the Apex background glow from animating, and diffed the screenshots:
- Followers view, all-communities rollup and Discover: **identical**.
- My Tips: zero pixels differ by more than 8/255 (sub-pixel anti-aliasing only).

Without reduced motion the only differences come from the animated glow and the top loading bar.

## Tests
| | Before (main) | After |
|---|---|---|
| `npm test` | 420 pass | 427 pass |
| `node scripts/build-public.mjs` | ok, 141 files | ok, 143 files (both new files are under `assets/`, which is allowlisted and not in `ASSET_DENY`); term scan clean |
| `npm run test:e2e` | 14 pass, 10 fail | 17 pass, the same 10 fail |

The 10 e2e failures are the same on main, and they're environmental or already there, not caused by this branch:
- 6 smoke tests fail on a CORS console error for `/api/ground/scene`. The mock replies `Access-Control-Allow-Origin: *` to a credentialed fetch.
- 4 `follower-live` tests call `chromium.launch()` themselves. That ignores the config's browser path, and this sandbox only has Playwright's older Chromium.

To run e2e here, I used a local config override pointing at `/opt/pw-browsers/chromium`. No repo config was changed.

There are no `console.*` calls, no `window.open` or `target="_blank"`, and no owner-only code in either new file (the tests check this).

## Manual check for Husker (iPhone, 390px)
Cold-load home as a follower with two communities, then: tap a community (the skeleton should show, then the view), tap My Tips, use back-swipe, tap Discover, use back-swipe. Then hard-refresh on `#/discover` and `#/mytips`. Turn on Airplane mode before a first open to see the "Try again" path.

## Suggested changelog line
"Faster first load on iPhone: the follower, My Tips and Discover screens now load the first time you open them (about 37 KB less to download up front)."

## Notes
- `npm run perf` is broken on main. It waits 45 s for the app and times out, possibly because the API mock doesn't cover a call made during boot. That's worth a separate look.
- `tests/split.test.js`'s fake DOM is now copied into `lazy_views.test.js`. A shared `tests/_fake_dom.js` would remove the copy (left alone, since `split.test.js` is out of scope).
