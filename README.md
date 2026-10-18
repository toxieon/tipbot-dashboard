# tipbot-dashboard

Static web control panel for the AFL Tipster Discord bot (GitHub Pages).

**Bot source of truth:** private repo `toxieon/TipBot` (Discord bot + Render API).

This repo keeps the dashboard SPA and helpers only (`index.html`, fixture/bookie/player JSON, scripts). Do not copy TipBot Python modules here.

## Version and changelog

Do not bump `VERSION` in a pull request, and do not edit `?v=` query strings or the settings label. Source pages keep the `__TD_VERSION__` placeholder. On push to `main`, `scripts/bump-version.mjs` runs before the public build and stamps that placeholder into the built site only, using `VERSION` plus the short commit sha, or the next patch number when no sha is available.

For a user-visible change, add a note under the current heading in `CHANGELOG.md`. Add the same note to `PUBLIC_CHANGELOG.md` when it should ship. Do not open a new version heading.

## Skill and rule scan

Before adding a skill or rule folder, scan it on this machine. The command is
dev-only. The site build does not install or run it.

```text
pip install -r requirements-dev.txt
python scripts/scan-skills path/to/skill-or-rules
python scripts/scan-skills path/to/skills --recursive
```

`scripts/scan-skills` runs NVIDIA SkillSpector 2.12.0 (Apache-2.0) with static
checks only. It passes `--no-llm`, clears language-model credentials, sets the
supply-chain lookup timeout to 0, and refuses outbound connections. A remote
URL is rejected. A score above 50 exits 1. Do not add a folder whose report
says `DO_NOT_INSTALL`.
