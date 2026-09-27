# Remaining work after Codex phase 1B

Updated 2026-09-27. This file supersedes the older Claude remaining list for this working copy.

## Completed locally

Claude's original feature pass, trial/foundation/master selection, plus Codex phase 1B: permission dry run and reviewed apply, whitelist, drift audit, member census, ownership safety and access/audit UI. Validation: 819 backend tests, 8 dashboard tests; browser flows at 375px/1280px.

## Next blocks

Estimates below are the original handoff's **unverified effective-token estimates**, not measurements or promises from this build.

| Block | Work remaining | Inherited estimate |
|---|---|---|
| 1B deployment validation | Ray's test-guild M1/M2 then M3–M7; reconcile with Husker; open/review PRs | External validation, not estimated |
| **1C forwarding — next** | Durable claim before send; UNIQUE tip/master; footer marker + history adoption; hooks, channel maps, edit sync, reconciler, backfill preview, rate limits and duplicate counter | 5–7M |
| Master UI | Forwarding tab and status details; Consensus tab with block 5. Access/audit tabs are done | Part of original 1.5–2M UI estimate remains |
| Phase 2 routing | Sport classifier + JS vectors, per-channel tracking, publish/reactions/updates/replay, settings and post-time decisions | 7–10M |
| Phase 3 consensus | Leg normalization, clusters, thresholds, preview, durable post/edit, freeze/settle, target selection | 6–8M |
| NFL/NBA grading parity | Reuse ESPN box scores and AFL final-prop rules | 1.5–2.5M |
| Player history | Additive per-game stats, forward fill, L5/VS and Compare form | 3–4.5M |
| TipSheet polish | Needs a real sheet from Brandon | 1–1.5M |
| Optional proposals | None approved; each separately flagged | 0.5–2M each |

## Integration and validation

- Brandon authorized a local base; originals remain untouched. Do not overwrite a later GitHub main blindly with the full working folders. Apply/reconcile the changed-file delivery using its base hashes.
- Private TipBot GitHub authentication was unavailable, so no PRs or tags were created. Required merge order remains TipBot → test deployment/health → dashboard. Reviewers create checkpoint tags before merging.
- Three planned Husker fixes are now local: trial startup load/retry, fail-closed V3, beta confirmation. The legacy picker `locate_master()` suggestion and cleanup resolver patch still need upstream reconciliation.
- Run real Discord M3–M7 on disposable test guilds, including whitelisting an absent member, forum/thread and voice read-only behavior, permission failures, owner transfer and restart during partial apply.
- The local suite used SQLite. The optional Turso native driver could not compile on Windows; validate Linux/Turso during deployment. requirements.txt and render.yaml were not changed.
- Audit notifications are at-most-once: ambiguous sends produce `notice_uncertain` and are not resent. DB events remain authoritative. Phase 1C still needs its full history-adoption/retry design.
- If an apply crashes after enabling lockdown, startup audit repairs remaining channels. Its old queue row may still show processing; inspect audit events and run a fresh dry run for an explicit action result.

## Decisions / assumptions

Read-only whitelist, optional default-role lock checked in dry run, alert-only unknown joins, Members intent off. Brandon confirms real permission changes in the UI. Forwarding remains off; recommended future defaults from CODEX_HANDOFF.md still apply. No master is chosen by the build.

Still needs Brandon: proposal choices; approval before player-history backfill; real TipSheet input; domain decision. Odds Auto prod checks and FEATURE_COMPARE activation remain Ray/Brandon work. No new blocker was added to phase 1C.
