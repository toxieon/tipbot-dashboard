# Match FX (`assets/fx/`)

Standalone SVG/CSS animations for AFL scoring moments and settled-tip wins. Nothing in the main dashboard loads these yet — integrate when you are ready.

## Files

| Moment | SVG | Styles | Script |
|--------|-----|--------|--------|
| Goal | `goal.svg` | `goal.css` | `goal.js` → `TBMatchFx.goal` |
| Behind | `behind.svg` | `behind.css` | `behind.js` → `TBMatchFx.behind` |
| Winner | `win.svg` | `win.css` | `win.js` → `TBMatchFx.win` |

Optional: `tb-match-fx.js` only ensures `window.TBMatchFx` exists before the three modules register their methods.

## Load order

```html
<script src="/assets/fx/tb-match-fx.js"></script>
<script src="/assets/fx/goal.js"></script>
<script src="/assets/fx/behind.js"></script>
<script src="/assets/fx/win.js"></script>
```

Each script resolves sibling `.css` / `.svg` URLs from its own `src` (works with cache-bust query strings).

## API

```js
TBMatchFx.goal(anchorElement);   // overlay above anchor; omit anchor for bottom-centre float
TBMatchFx.behind(anchorElement);
TBMatchFx.win(anchorElement);
```

- **anchor** — optional `HTMLElement`. When provided, the host gets a `position:relative` helper class and the overlay is positioned above it.
- Motion honours `prefers-reduced-motion` (static end state, no confetti travel on win).

## Theme tokens

FX CSS uses `--tbfx-*` variables with Apex-like defaults. Map them to your theme on a parent:

```css
.my-live-panel {
  --tbfx-accent: var(--accent);
  --tbfx-win: var(--win);
  --tbfx-txt: var(--txt);
  --tbfx-line: var(--line);
  --tbfx-muted: var(--muted);
  --tbfx-warn: var(--warn);
}
```

## Lab

Local preview: open `labs/fx/index.html` (not shipped in the public site build).

## Wiring ideas (not implemented)

- **Live scores:** after `/api/live-tips` poll, diff `hscore`/`ascore` per match (+6 goal, +1 behind) and call `goal` / `behind` on the row element.
- **Player goals:** when a leg’s goals stat increases, call `goal` on the tip card.
- **Settled win:** when a tip newly shows win, call `win` on `.betcard` once per `tip_id` (session guard).

Keep detection logic in app code; these modules only play the overlay.
