---
name: tensorlake-design
description: House visual language for any design work — look at the Tensorlake reference screenshots and use its tokens before producing UI. Use whenever generating or revising a design, mockup, wireframe, landing page, marketing page, dashboard, web app screen, component, artifact, HTML page, slide, or any visual layout; also when picking colors, type, spacing, or motion, or when the user says "design this", "make it look good", "match our style", or names Tensorlake styling.
---

# Tensorlake design language

The reference for how work here should look: a dark, engineering-grade, grid-ruled
system with one green accent, a neo-grotesque display face, and mono for every piece
of metadata. Screenshots of the live site are in `Tensorlake/`; every token below was
read off the real page's computed styles, not estimated.

**Captured from https://www.tensorlake.ai/ on 2026-09-07.**

## Do this first, every time

1. **Look at the pictures before writing markup.** Read the screenshots that match
   what you are building — this is what makes output match instead of approximate:

   | Building | Read these |
   |---|---|
   | Any page, first time in a session | `Tensorlake/fold/home-1440-fold.png` |
   | A hero / above-the-fold | `Tensorlake/sections/01-hero.png` |
   | A feature or explainer section | `Tensorlake/sections/02-product.png`, `Tensorlake/sections/04-lifecycle.png` |
   | Cards, feature grids | `Tensorlake/sections/09-integrations.png`, `Tensorlake/components/feature-cards.png` |
   | Data, benchmarks, tables | `Tensorlake/sections/05-bench.png` |
   | Pricing / plan comparison | `Tensorlake/fold/pricing-1440-fold.png` |
   | Editorial, blog, docs, long-form | `Tensorlake/fold/blog-1440-fold.png` (dark), `Tensorlake/fold/blog-paper-1440-fold.png` (light) |
   | Nav / header | `Tensorlake/components/nav-header.png` |
   | Footer | `Tensorlake/sections/14-footer.png` |
   | Buttons and their states | `Tensorlake/states/cta-default.png`, `Tensorlake/states/cta-hover.png`, `Tensorlake/states/cta-focus-visible.png` |
   | Code / terminal / log output | `Tensorlake/components/code-panel.png` |
   | Mobile behaviour | `Tensorlake/mobile/home-390-full.jpg` |
   | Whole-page rhythm and section order | `Tensorlake/pages/home-1440-full.jpg` |

   `Tensorlake/INDEX.md` lists every shot with what it is evidence of.

2. **Take tokens from `reference/tokens.css`.** Paste that `:root` block in and
   reference the variables. Never write a raw hex, px size, or duration that isn't
   in it. `reference/tokens.md` explains what each is for.

3. **Follow `reference/components.md`** for anatomy and the seven required states
   (default, hover, focus-visible, active, disabled, loading, error).

4. **Run `reference/checklist.md`** before you call the work done.

   A working page built entirely from these tokens is in `examples/starter.html`
   (rendered: `examples/starter-1440-fold.png`) — copy it as a starting skeleton.

## The system in one screen

**Dark by default.** Page is `--tl-ink` `#161715` — a near-black with green in it,
never `#000` and never neutral grey. A light "paper" variant (`#f9f9f9`) exists for
long-form reading only; marketing and product UI stay dark.

**Two typefaces, strict division of labour.**
- *PP Neue Montreal* (fallbacks: Inter Tight, Neue Haas Grotesk) — headings and body
  prose. Weight **500 everywhere**, including 92px display type. Never bold a heading.
- *JetBrains Mono* — every label, eyebrow, button, nav item, tag, stat, table header,
  timestamp, and terminal. Uppercase, 10–13px, tight negative tracking.

  The mono/sans split *is* the brand. Sans says "this is the idea", mono says
  "this is a machine fact". Mixing them up is the fastest way to look wrong.

**Display type is huge and crunched.** H1 92px / line-height 0.98 / tracking
`-0.035em`. H2 ~52px, H3 ~37px, H4 22px, all with tracking scaling negatively with
size. Headings end in a period. One clause of the headline is often set in
`--tl-green-2` (`#82c38c`) — "Composable infrastructure **for agents.**"

**One accent, used sparingly.** `--tl-green` `#0aa67d` for fills, links, and focus;
`--tl-green-2` `#82c38c` for accent text and primary CTA fill. Everything else is a
step on the white→grey ramp. No second hue, no gradients, no glassmorphism.

**Square-ish, ruled, not rounded.** Radii are 2px (default), 4px, 8px — never a pill,
never 12px+ except the rare large panel. Structure is expressed with **1px hairlines**
(`--tl-stroke` `#393939`) and faint full-bleed **vertical column rules**, not with
shadows. There is essentially no shadow in this system; the only glow is
`--tl-glow-green` on an active element.

**Density is the point.** Small mono metadata packed tightly, generous space between
major sections (`--tl-sp-9`/`--tl-sp-10`, 80–120px), 1320px max container.

**Motion is barely there.** 120–180ms, `ease`, on `background`/`color`/`border-color`
/`opacity`/`transform` only. Nothing bounces, nothing slides in long distances,
nothing takes over 200ms. Respect `prefers-reduced-motion`.

## Layout rules

- Container **1320px max**, centred; content sits inside vertical rules that run the
  full page height. Section padding `--tl-sp-9`/`--tl-sp-10` top and bottom.
- Sections open with a **mono eyebrow** (uppercase, green or grey, often prefixed with
  a `◆` or `▪` glyph), then the display heading, then body copy at 18px `--tl-fg-2`.
- Right-align a secondary mono label opposite the heading (e.g. `PATTERNS` /
  `HARNESS · TOOL`) when the section has a taxonomy to declare.
- Split panels: copy on the left, live artefact (terminal, code, diagram, log) on the
  right, one hairline between them, no gap and no rounding.
- Feature lists are **two-column mono-labelled paragraphs**, not icon cards.
- Numbered rows use zero-padded mono ordinals (`01`, `02`).
- Separate `·` for inline metadata, `/` for path-ish sequences, `—` for em-dash asides.

## Voice

Concise, confident, implementation-focused. Concrete nouns and real numbers
(`460 ms`, `143 pkgs`, `5M per project`). Sentence case in prose, UPPERCASE in mono
labels. No exclamation marks, no "revolutionary", no vague benefit copy. Buttons say
what happens: `GET STARTED FOR FREE →`, `READ THE DOCS →`, `BOOK A DEMO`.

## Non-negotiables

- Every rule stated with **must** is a hard requirement; **should** is a strong default
  you may trade away with a reason.
- Components **must** define all seven states. No state left to the browser default.
- Focus **must** be visible: 2px `--tl-green` outline with 2px offset, never
  `outline: none` without a replacement.
- Contrast **must** meet WCAG 2.2 AA — 4.5:1 body, 3:1 large text and UI boundaries.
  `--tl-fg-4` `#989d9e` on `--tl-ink` passes for ≥14px only; do not use it smaller.
- Spacing and type **must** come from the scale. No one-off values.
- Do not introduce a second accent hue, a gradient, a drop shadow, a pill radius, or
  a typeface outside the two above.

## Font licensing

PP Neue Montreal (Pangram Pangram) and JetBrains Mono (free, OFL) are the real faces.
If PP Neue Montreal is not licensed for the target, use **Inter Tight** at weight 500
with `letter-spacing` tightened one notch — the stack in `tokens.css` already does
this. Never substitute a humanist or geometric sans; the tight-aperture neo-grotesque
shape is load-bearing.

## Adapting to other products

This is a *language*, not a template. When the work isn't Tensorlake, keep the
structural grammar — mono/sans division, hairline structure, 2px radii, one accent,
tight display type, mono metadata — and swap the accent hue and copy. Say in one line
which parts you carried over.

## Files

```
Tensorlake/          screenshots — the visual source of truth
  INDEX.md           what each shot is evidence of
  fold/              above-the-fold, every route
  pages/             full-page desktop
  sections/          each home section, isolated
  components/        nav, hero, code panel, cards, logo wall, footer @2x
  states/            button + nav default / hover / focus-visible
  mobile/            390px full pages
examples/
  starter.html       working page skeleton built only from the tokens
  starter-1440-fold.png  what it renders as — compare against fold/home
reference/
  tokens.css         paste-in :root block  ← start here when coding
  tokens.md          what each token means, with usage rules
  components.md      anatomy, variants, all seven states, a11y criteria
  checklist.md       QA gate before delivery
  brief.md           the authoring brief this skill implements
  *.json             raw measured values (tokens, buttons, themes, shot manifest)
```
