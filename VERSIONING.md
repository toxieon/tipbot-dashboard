# Versioning

This rule is for any AI or person changing this repo.

- The base version lives in the `VERSION` file (`x.y.z`). Do not bump it in a pull request.
- Source pages keep the `__TD_VERSION__` placeholder in cache-bust query strings and in the settings label (`#dd-version`). Do not edit those strings to chase a version number.
- On push to `main`, `scripts/bump-version.mjs` runs before the public build. It stamps the placeholder into the built site only: `VERSION` plus the short commit sha, or the next patch number when no sha is available.
- For a user-visible change, add a note under the current heading in `CHANGELOG.md`. Add the same note to `PUBLIC_CHANGELOG.md` when it should ship. Do not open a new version heading.
