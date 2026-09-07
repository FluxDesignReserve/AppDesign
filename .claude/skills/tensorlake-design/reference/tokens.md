# Tokens — what each one is for

Measured from https://www.tensorlake.ai/ computed styles on 2026-09-07. Raw dumps:
`tokens.json` (all 116 custom properties + a colour/size census), `buttons.json`,
`themes.json`.

Use `tokens.css`. This file explains *when* to reach for each value.

## Colour

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--tl-ink` | `#161715` | The page. It is a *green-black*, not neutral. Using `#000` or `#111` reads as a different brand. |
| `--tl-ink-2` | `#1e1f1c` | Panels, cards, table headers — one barely-perceptible step up. |
| `--tl-ink-3` / `-4` | `#232b23` / `#273228` | Green-tinted panels for "this is the active/selected thing". |
| `--tl-ink-5` | `#171e17` | Chip and tag backgrounds. |

Contrast between surfaces is deliberately tiny. Separation comes from **hairlines**,
not from surface value. If you find yourself lightening a panel to make it read, add
a `1px solid var(--tl-stroke)` border instead.

### Foreground ramp

`#fff` → `#ddd` → `#c9c9c9` → `#989d9e` → `#889079`. Four steps of grey do all the
hierarchy work, which is why the single accent stays loud.

- `--tl-fg` headings and emphasis
- `--tl-fg-2` body copy, code text (the workhorse)
- `--tl-fg-3` secondary paragraphs
- `--tl-fg-4` mono metadata — **≥14px only**; at 4.6:1 it passes AA for normal text but
  the site uses it at 10–12px in places where it is decorative. Do not follow that
  when the text carries meaning.
- `--tl-fg-5` de-emphasised mono, disabled labels

### Accent

One hue. `--tl-green #0aa67d` is the *interactive* green: links, focus rings, filled
states, the `DASHBOARD →` button. `--tl-green-2 #82c38c` is the *typographic* green:
the accented clause of a headline, eyebrows, the primary CTA fill (which takes
`--tl-ink` text, not white).

Alpha variants exist so you never hand-roll one: `--tl-green-pill` (20%) for chips,
`--tl-green-wash` (12%) for highlighted rows.

`--tl-green-mint` and `--tl-green-terminal` belong to terminal/log surfaces only.
`--tl-blue-deep` / `--tl-blue-ink` appear in syntax highlighting and diagrams — they
are not UI colours and must not become a second accent.

## Type

Two families, and which one you pick is a semantic decision:

- **`--tl-font-display`** — ideas. Headings, prose, paragraphs, anything a human reads
  as a sentence.
- **`--tl-font-mono`** — machine facts. Labels, eyebrows, buttons, nav, tags, stats,
  timestamps, table headers, file paths, terminal, code, ordinals.

Weight is **500** for display and body — including 92px headlines. There is no bold
heading anywhere on the site. Mono labels may go to 600.

Tracking gets more negative as size goes up: `-0.035em` at 92px, `-0.028em` at 52px,
`-0.02em` at 22px, and `-0.07em` (`--tl-track-crunch`) on small uppercase mono. That
crunch on mono labels is distinctive — normal or positive tracking on a mono label
immediately looks generic.

Measured scale at 1440px: h1 92/90.2, h2 51.8/52.9, h3 37.4/40.4, h4 22/24.2,
lede 18/26.1, body 16, mono 10–14 (13px is the most common size on the page).

Headings end in a period. Frequently one clause is coloured `--tl-green-2`.

## Space

`4, 8, 12, 16, 20, 28, 40, 60, 80, 120`. Roughly 4pt up close, then jumps. Nothing in
between — if 24px feels right, decide between 20 and 28.

- Inside a control: `--tl-sp-2`/`--tl-sp-3` (button padding is `10px 14px`)
- Between related items: `--tl-sp-4`–`--tl-sp-6`
- Between blocks in a section: `--tl-sp-7`/`--tl-sp-8`
- Between sections: `--tl-sp-9`/`--tl-sp-10`

Container 1320px, gutter 24px desktop / 20px mobile.

## Radius

`2px` is the default and covers buttons, inputs, chips, and small panels. `4px` and
`8px` exist for larger surfaces; `12px` is rare. Circles (`50%`) only for avatars and
status dots. **No pills.** A `border-radius: 999px` button is the single most
out-of-place thing you can add to this system.

## Elevation

There is no shadow language on the dark theme. Depth is:

1. a 1px hairline (`--tl-stroke`),
2. faint full-height vertical column rules (`--tl-stroke-dim`) that the content sits between,
3. a one-step surface change.

`--tl-glow-green` marks a live/active element (running sandbox, selected tab). Use it
at most once per viewport. `--tl-shadow-paper` exists only under `[data-theme="paper"]`.

## Motion

| Token | Value | Applies to |
|---|---|---|
| `--tl-dur-instant` | 120ms | `background`, `color`, `border-color` — every hover |
| `--tl-dur-fast` | 140ms | `opacity` |
| `--tl-dur-normal` | 180ms | `grid-template-rows`, `gap`, `transform` on disclosure |

Easing is plain `ease`. Nothing on the site exceeds 180ms. There are no entrance
animations on scroll, no parallax, no spring. Motion confirms an interaction; it never
performs. Always honour `prefers-reduced-motion`.

## The paper theme

`[data-theme="paper"]` (`#f9f9f9`) is used for the engineering blog. Accent darkens to
`#0e8a69` so links stay AA on light. Category tags get their own hues there
(engineering `#0e8a69`, research `#4a5a9e`, product `#c05621`, community `#8a4fa3`) —
those are *taxonomy* colours for editorial only and must not leak into product UI.
