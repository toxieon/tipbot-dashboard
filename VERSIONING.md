# Versioning

This rule is for any AI or person merging changes into `main`.

- The version lives in the `VERSION` file at the repo root (just the number, e.g. `0.36.1`). Versioning started at `0.1.1`.
- **Minor patch** (bug fix, tweak, one-off cleanup): bump the last number. `0.36.1` becomes `0.36.2`.
- **Major patch** (a new feature): bump the middle number and reset the last number to 1. `0.36.4` becomes `0.37.1`.
- **Every merge to `main` bumps the version exactly once**: update `VERSION` and add a `CHANGELOG.md` entry headed with the new number (`## 0.36.2 · YYYY-MM-DD · \`slug\` · summary`).
- The version must stay visible in the app. For tipdash that is the `tipdash vX.Y.Z` line at the bottom of the ⚙ Settings menu (`#dd-version` in `index.html`). tipdash has no build step, so update that label together with `VERSION`; `tests/version.test.js` fails if they differ.

History: replaying the merge history under this rule put `main` at `0.35.3` after #88. The master forwarding merge (Block 1C) is `0.36.1`, the first release with a `VERSION` file.
