# Racecourse SVG artwork

Original illustrated assets for Australian and New Zealand gallops and harness venues that appear in the Ladbrokes feed.

## Files

| Path | Purpose |
|------|---------|
| `assets/racecourses/<slug>.svg` | One self-contained illustration per venue (meeting scene + stylised track map). |
| `assets/racecourses/manifest.json` | Slug, display label, filename, and meeting-name aliases for lookup. |
| `labs/racecourses/index.html` | Local preview gallery (not copied to the public site). |

Slugs use lowercase with underscores (e.g. `moonee_valley.svg`, `gold_coast.svg`).

## Integration (future)

When wiring into the racing builder:

1. Load `manifest.json` (or a generated allowlist) once.
2. Normalise the TipBot meeting name (lowercase, strip punctuation).
3. Pick the entry whose `aliases` substring-match with longest alias wins.
4. On match, use `<img src="./assets/racecourses/{slug}.svg" alt="">` or inline the SVG for the meeting header; reuse the `#track-map` group for the race-card map if desired.
5. If no match, use a generic fallback illustration or omit art.

Do not hotlink third-party course imagery; these SVGs are tipdash-original geometry and palettes only.

## Preview

From the repo root, serve over HTTP (required for `fetch` of the manifest):

```bash
python3 -m http.server 8765
```

Open `http://localhost:8765/labs/racecourses/`.
