# Remaining work (updated 2026-09-28 after the overnight phase 2/3 run)

Everything from Claude's feature pass, Codex phase 1B and Husker's phase 2/3 run is merged and deployed. All of it is inert in prod: master beta, lockdown, forwarding, trial mode, the AU sign-up gate, `FEATURE_HEATMAPS` and `FEATURE_COMPARE` are off, no master is selected, and NFL auto-push needs `ESPN_AUTO_PUSH_FT=1` plus a guild flag. Tests: TipBot 863 passing (Linux, libsql 0.0.55); tipdash 13 passing.

## Done tonight (2026-09-27/28)

- P2a: opening a server reads everything in one DB job (TipBot #89).
- P2b: All-communities concurrency cap of 4, in-flight GET dedupe, single-flight builder live refresh (tipdash #87).
- P2c: NFL auto-grade at final from the ESPN box score with AFL final-prop rules, off by default (TipBot #91). This closes the NFL half of "NFL/NBA grading parity".
- P2d: the legacy master picker suggests via `locate_master()`; cleanup_pending11 uses the resolver (TipBot #90).
- P3 #3/#4: long master jobs run on their own worker; lockdown schema is cached and the policy refreshes only when its version changes (TipBot #92).

## Next blocks

The estimates are the original handoff's **unverified effective-token estimates**.

| Block | Work remaining | Inherited estimate |
|---|---|---|
| 1B deployment validation | Ray's test-guild M1/M2 then M3–M7 on disposable guilds | External validation |
| **1C forwarding: merged OFF in 0.36.1** (2026-09-28, `forwarding-1c`) | Brandon: run the §4 manual test plan in Discord (Tip2 only first). Not built, by design: backfill posting and the optional backfill dry-run count | Done; follow-ups are small |
| Master UI | Consensus tab with block 5 (the Forwarding tab is done, 1C) | Part of 1.5–2M |
| Phase 2 routing | Sport classifier + JS vectors, per-channel tracking, publish/reactions/updates/replay, settings and post-time decisions | 7–10M |
| Phase 3 consensus | Leg normalization, clusters, thresholds, preview, durable post/edit, freeze/settle, target selection | 6–8M |
| NBA grading | NBA/WNBA legs are free text today. Needs structured NBA props in the builder plus a box-score extractor, then the same path as NFL | ~0.5–1M |
| Faster first reconcile | Startup ledger replay handles 750 records per guild one at a time (about 9.5 min after boot). Replay only the newest snapshot per tip, or skip records older than the DB row; needs a real-guild replay test | ~0.3–0.6M |
| tipdash split (#5) | Lazy-load builder/admin JS. The 431 KB main block is one closure (the builder alone references `BUILD` 436×, 347 top-level functions), so a safe split means exposing shared state first. Wire size today is 139 KB gzip | ~1–1.5M |
| Player history | Additive per-game stats, forward fill, L5/VS and Compare form | 3–4.5M |
| TipSheet polish | Needs a real sheet from Brandon | 1–1.5M |
| Optional proposals | None approved; each separately flagged | 0.5–2M each |

## Integration and validation

- Brandon authorized a local base; originals remain untouched. Do not overwrite a later GitHub main blindly with the full working folders. Apply/reconcile the changed-file delivery using its base hashes.
- Every PR tonight was merged after a `checkpoint-pre-<name>-2026-09-2x` tag on the previous main.
- The legacy picker `locate_master()` suggestion and the cleanup resolver patch are merged (TipBot #90).
- Run real Discord M3–M7 on disposable test guilds, including whitelisting an absent member, forum/thread and voice read-only behavior, permission failures, owner transfer and restart during partial apply.
- The suites run on Linux with the prod libsql driver (0.0.55) against a local libsql file; there are no Turso credentials on the box.
- Audit notifications are at-most-once: ambiguous sends produce `notice_uncertain` and are not resent. DB events remain authoritative. Phase 1C forwards use their own claim + footer-marker history adoption (see CHANGELOG `forwarding-1c`); the audit/alert notices stay at-most-once.
- If an apply crashes after enabling lockdown, startup audit repairs remaining channels. Its old queue row may still show processing; inspect audit events and run a fresh dry run for an explicit action result.

## Decisions / assumptions

Read-only whitelist, optional default-role lock checked in dry run, alert-only unknown joins, Members intent off. Brandon confirms real permission changes in the UI. Forwarding remains off; recommended future defaults from CODEX_HANDOFF.md still apply. No master is chosen by the build.

Still needs Brandon: proposal choices; approval before player-history backfill; real TipSheet input; domain decision. Odds Auto prod checks and FEATURE_COMPARE activation remain Ray/Brandon work. No new blocker was added to phase 1C.
