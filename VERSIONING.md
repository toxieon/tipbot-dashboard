# Versioning

This rule is for any AI or person changing this repo.

- The base version lives in the `VERSION` file (`x.y.z`). Each release PR (the fast-lane "Update dashboard" PRs) bumps the last number once: `0.66.8` becomes `0.66.9`. A PR that is not a release leaves `VERSION` alone.
- A release PR adds one heading for the new number to `CHANGELOG.md` (`## x.y.z · YYYY-MM-DD · \`slug\` · summary`) and to `PUBLIC_CHANGELOG.md` (`## x.y.z`). Notes stay generic ("Maintenance / Internal updates") unless the owner asks for more.
- Source pages keep the `__TD_VERSION__` placeholder in cache-bust query strings and in the settings label (`#dd-version`). Do not edit those strings to chase a version number.
- On push to `main`, `scripts/bump-version.mjs` runs before the public build. It stamps the placeholder into the built site only: `VERSION` plus the short commit sha, or the next patch number when no sha is available.
