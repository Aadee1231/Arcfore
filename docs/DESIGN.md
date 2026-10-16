# Arcfore Design System

Editorial country-club luxury × modern golf performance tech. Calm, intentional, sophisticated — like a beautifully printed scorecard, not a dashboard template.

## Palette

| Token | Hex | Use |
|---|---|---|
| `forest` | #102E25 | primary dark sections, header bands, dark mode base |
| `forestMid` | #1B4436 | secondary forest, pressed states, dark cards |
| `ivory` | #F7F4EC | primary app background (light) |
| `sage` | #DDE6DA | subtle fills, chips, progress tracks |
| `brass` | #C8A46B | accents, scores-vs-par, premium markers, focus rings |
| `ink` | #1E2522 | primary text on ivory |
| `muted` | #77817B | secondary text, captions |
| `danger` | #A5453A | restrained warm red — errors, double-bogey+ marks |
| `birdie` | #2E7D5B | birdie circle, positive deltas |
| `white` | #FDFCF8 | card surfaces on ivory |

Dark mode: forest base, ivory text, brass accents (same semantic tokens).

## Typography

- **Display / numerals-on-hero**: Fraunces (600/700) — greeting, hole number, round totals, scorecard headings. Editorial serif.
- **UI text**: Plus Jakarta Sans 400/500/600/700 — labels, buttons, body.
- **Tabular numerals** always for scores, yardages, stats (`fontVariant: ['tabular-nums']`).

Scale: `display 44` / `title 32` / `h2 24` / `h3 19` / `body 16` / `label 14` / `caption 12` / `score 56`.

## Rules

- Ivory background default; forest reserved for hero bands, active-round header, dark sections — never a sea of floating dark cards.
- No purple/cyan gradients, no glow orbs, no emoji icons (Lucide only), no generic card grids, no fake data.
- Score/bogey marks: circle (birdie), square (bogey) hand-drawn-scorecard feel via thin rings.
- One primary action per screen; giant touch targets on the course (min 56pt steppers).
- Animations: 180–320ms ease-out, staggered reveals, reduced-motion honored.

## Components

`Button` (primary forest / outline / ghost / brass), `Text` (typed variants), `Card`, `Input`, `Sheet` (bottom-sheet), `Chip`, `ScoreStepper`, `HoleBadge`, `ParChip`, `EmptyState`, `StatRow`, `SectionHeader` (serif + rule line), `Toast`.
