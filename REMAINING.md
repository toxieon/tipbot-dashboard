# What still needs doing

_Updated 27 Sep 2026, 10:30 pm AEST, after Claude's build._

Costs are **estimated effective tokens** (the same measure as `CHANGELOG.md`; tonight's whole feature pass was about 10.3M). They assume a **fresh session** per block, which is noticeably cheaper than continuing a long one.

## Done tonight (for reference)
| Item | Status |
| --- | --- |
| Live page, heatmaps stub, Sydney time and overlapping games, AU sign-up gate (+ `/au-signups`), Compare | ✅ drops 01–05 |
| **T** Trial mode | ✅ drop 06 |
| **0** Master foundation (resolver, tables, legacy gating, `feat.master_feed` wired) | ✅ drop 06 |
| **1A** Master select + verify | ✅ drop 06 |
| **1-UI** Master page: Overview and Master server tabs | ✅ drop 06 (Lockdown, Forwarding, Consensus and Audit tabs are placeholders) |

## Master server handoff: still to build
| # | Item | What's left | Est. tokens | Risk | Blocked on |
| --- | --- | --- | --- | --- | --- |
| **1B** | Lockdown + whitelist + audit | Pure `master_lock_overwrites()`, dry-run diff, apply queue (1 edit per 1.5 s), whitelist tables + UI, 10-min drift repair + event handlers, owner-transfer auto-pause, unknown-join polling (no members intent) | **3–4M** | Med (edits Discord permissions) | Your answers to Q5 (whitelist read-only?) and Q7 (`@everyone` role lock OK?) |
| **1C** | Forwarding | `master_forward_channels` / `master_forward_posts`, claim-before-send + footer-marker history check, notify hooks in ~12 places, reconciler loop, backfill (dry-run count), rate limits, auto-create channel on join, duplicate counter | **5–7M** | **High** (double-post history) | Q3 (which servers forward), Q4 (mark vs delete on source delete) |
| 1-UI | Remaining Master page tabs | Lockdown & access, Forwarding (per-source table, backfill, retry), Audit log | 1.5–2M | Low | 1B / 1C |
| **2** | Sport routing (Feature D) | `sport_tags.py` + JS twin, `tip_posts` per-channel tracking through publish / edit / reactions / redact / ledger, settings block, post-time popups, TipSheet non-interactive rule | **7–10M** | **High** (core posting path) | Q12, Q13, Q14 |
| **3** | Consensus (Features E+F) | Leg normalisation (Appendix A), clustering, thresholds, dry-run preview, post + live edit, freeze at start, settings tab | **6–8M** | Med | Q8–Q11 |
| 4 | Proposals (17) | Each separately flagged, only the ones you approve | 0.5–2M each | Varies | Your picks |
| — | Changelog upkeep | Required per PR | ~0.1M per PR | — | — |

**Total left for the master handoff: about 23–31M, plus any proposals.**

## Feature-pass leftovers (older handoff)
| Item | Est. tokens | Notes |
| --- | --- | --- |
| NFL/NBA prop auto-grade parity | 1.5–2.5M | ESPN box scores already fetched |
| Player history table (per-game stats) → builder L5/VS chips + Compare form panel | 3–4.5M | Backfill needs your OK |
| TipSheet / paste-sheet polish | 1–1.5M | Please supply a real sheet |
| Odds Auto E2E re-check | 0 | Needs prod; Ray's smoke test |
| Turn on `FEATURE_COMPARE` | ~0.05M | After a prod smoke test |
| Domain (CNAME tipdashhq.com vs tipbothq.com) | ~0.05M | Your decision + DNS |

## Needs Ray (not buildable from Claude's workspace)
- Deploy order: TipBot, then the slash-command sync (`/au-signups`), then tipdash.
- Prod smoke tests listed in each drop's `PR_NOTES.md` (Compare hand-off to the builder; the master checklist on a real test guild).
- The master handoff's manual script (§20.2 M1–M14) on a **test master guild**. Claude can't reach Discord from its workspace.

## Your decisions (answer before the next session to avoid paying twice)
1. Which server is the master? (The picker suggests the old one if it still exists.)
2. Forward disabled / trial servers too, or only active ones? (Q3)
3. Source tip deleted: **mark** the forward (recommended) or delete it? (Q4)
4. Whitelisted users read-only (recommended) or can post? (Q5)
5. OK to remove View Channel from `@everyone` in the master? (Q7)
6. Unknown joins: alert only, or auto-kick? Turn on the Server Members intent? (Q6)
7. Consensus target, thresholds, and whether the same tipster in several servers counts once. (Q8–Q10)
8. Trial expiry default is "stay on trial + alert"; change it? Skip ledger writes for trial servers? (Q15)

## Cheapest next step
Answer 2–5, then run **1B + 1C + their UI tabs** in one fresh session (~10–13M). That gives you a working, locked master with every bet forwarded. Leave routing and consensus for after.
