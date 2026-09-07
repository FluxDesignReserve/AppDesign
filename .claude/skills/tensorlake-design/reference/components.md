# Component rules

Every component must define **default, hover, focus-visible, active, disabled,
loading, error** — no state left to the browser. Every rule marked **must** is
non-negotiable; **should** is a strong default you may trade away with a stated reason.

Values come from `tokens.css`. Component styles must reference tokens, never literals.

---

## Button

Evidence: `Tensorlake/states/cta-default.png`, `Tensorlake/states/cta-hover.png`, `Tensorlake/states/cta-focus-visible.png`,
`Tensorlake/components/nav-header.png`.

**Anatomy** — `[ optional leading glyph ][ label ][ optional trailing → ]`.
Label is `--tl-font-mono`, `--tl-mono-sm` (12px), uppercase, tracking
`--tl-track-crunch`, weight 500. Padding `10px 14px`. Radius `--tl-radius-1` (2px).
Border always present, 1px. Trailing `→` for forward navigation; never a chevron icon.

**Variants**

| Variant | Background | Text | Border |
|---|---|---|---|
| Primary | `--tl-green-2` | `--tl-ink` | same as background |
| Primary (app/dashboard) | `--tl-green` | `#fff` | same as background |
| Secondary | transparent | `--tl-fg` | `--tl-stroke` |
| Ghost | transparent | `--tl-fg-4` | transparent |
| Danger | transparent | `#e5484d` | `#e5484d` |

**States**

| State | Rule |
|---|---|
| Hover | Primary lightens one step; secondary raises border to `--tl-stroke-2` and background to `#ffffff0a`. `transition: background var(--tl-dur-instant), color var(--tl-dur-instant), border-color var(--tl-dur-instant)`. No lift, no scale, no shadow. |
| Focus-visible | `outline: 2px solid var(--tl-focus); outline-offset: 2px`. Must be visible on every variant including primary. Must never be removed without replacement. |
| Active | Background darkens one step; no transform. |
| Disabled | `opacity: .45`, `cursor: not-allowed`, `pointer-events: none`, `aria-disabled="true"`. Contrast may drop below AA only because the control is inert; the adjacent explanation must not. |
| Loading | Label replaced by the same label plus a mono spinner glyph cycling `⠋⠙⠹⠸`, width locked to the resting width so nothing reflows. `aria-busy="true"`, control stays focusable, activation suppressed. |
| Error | Control returns to default; the error is shown adjacent in mono 12px `#e5484d` with `role="status"`. A button must not become permanently red. |

**Behaviour** — Enter and Space activate. Hit target must be ≥44×44px on touch
(pad the wrapper, don't grow the visual box). Long labels must not wrap; shorten the
copy instead.

---

## Nav / header

Evidence: `Tensorlake/components/nav-header.png`, `Tensorlake/states/nav-hover.png`.

Full-width bar, ~66px tall, background `--tl-ink` at `.82` alpha with `backdrop-filter:
blur(8px)`, hairline bottom border. Wordmark left; links centre; icon links and the two
CTAs right, separated by a vertical hairline.

Links are mono uppercase 12px `--tl-fg-4`. Current page is `--tl-fg` **plus a 2px
`--tl-green` underline sitting on the header's bottom border** — the underline is the
current-page signal and must be present, `aria-current="page"` alongside it.

Hover raises a link to `--tl-fg` over `--tl-dur-instant`. Focus-visible draws the
standard outline, inset so it isn't clipped by the header edge.

Mobile (<768px): links collapse into a full-screen panel behind a mono `MENU` toggle;
the panel must trap focus, close on `Escape`, and restore focus to the toggle.

---

## Card / feature tile

Evidence: `Tensorlake/sections/09-integrations.png`, `Tensorlake/components/feature-cards.png`.

Background `--tl-ink-2`, 1px `--tl-stroke` border, radius `--tl-radius-1`, padding
`--tl-sp-5`/`--tl-sp-6`. **No shadow, no rounding beyond 2px, no hover lift.**

Order: mono eyebrow (uppercase, often `◆`-prefixed, `--tl-green-2` or `--tl-fg-4`) →
title (display, 22–26px, weight 500) → body (`--tl-fg-3`, 15–16px, ≤3 lines) →
optional mono link with `→`.

Hover: border to `--tl-stroke-2`, background one step, 120ms. That's all.

Grids are 2 or 4 across at 1440, 2 at 768, 1 at 390. Cards in a row **must** be equal
height with the CTA baseline-aligned — use grid, not margins.

Long content truncates the body at 3 lines with `-webkit-line-clamp` and keeps the
full text in `title`. Empty state: keep the card frame, show a mono `—` and one line
of `--tl-fg-4` explanation; never render a collapsed or absent card.

---

## Eyebrow / tag / chip

Mono, uppercase, 10–12px, `--tl-track-crunch`.

- **Eyebrow** — no background, `--tl-green-2` or `--tl-fg-4`, sits directly above a
  heading with `--tl-sp-3` beneath. Often prefixed `◆` or `▪`.
- **Tag** — `--tl-ink-5` background, 1px `--tl-stroke`, padding `4px 8px`, radius 0–2px.
- **Status chip** — `--tl-green-pill` background, `--tl-green-2` text, leading `●`.
  A live status must also be conveyed as text, not colour alone.

---

## Code / terminal panel

Evidence: `Tensorlake/components/code-panel.png`, `Tensorlake/sections/02-product.png`.

Header strip: three `10px` traffic-light dots (`#ff5f56`, `#ffbd2e`, `#27c93f`) or a
tab row, then a mono title, then right-aligned status. Border 1px `--tl-stroke`,
radius `--tl-radius-1`, background `--tl-ink-2`.

Body is mono 13px, line-height 1.65, `--tl-fg-2`, padding `18px 20px`. Prompt `$` in
`--tl-fg-4`. Output lines are prefixed `✓` (`--tl-green-2`), `▸`, or `·`. Timings and
identifiers stay mono and are never abbreviated away — the specificity is the point.

Tabs (`PYTHON` / `TYPESCRIPT` / `CLI`) show a filename as a mono sub-label; the active
tab gets `--tl-green-2` text plus a green top border. Tabs must be a real
`role="tablist"` with arrow-key navigation.

A copy control must exist, must announce success in text (`COPIED`) for ≥1.5s, and
must not rely on colour alone.

Overflow: the panel scrolls horizontally rather than wrapping code. Never shrink the
font to fit.

---

## Section shell

Evidence: `Tensorlake/sections/02-product.png`, `Tensorlake/sections/04-lifecycle.png`, `Tensorlake/sections/05-bench.png`.

```
[ faint full-height vertical column rules, --tl-stroke-dim ]
  MONO EYEBROW                                    RIGHT-ALIGNED TAXONOMY
  Display heading, ending in a period.            SECOND · LABEL
  ── hairline ─────────────────────────────────────────────────────
  [ copy column          │  live artefact column ]
```

Padding `--tl-sp-9`/`--tl-sp-10` block, container 1320px. The split panel has a single
hairline between columns, no gap and no rounding. Body copy 18px `--tl-fg-2`, max
~62ch.

---

## Data / benchmark table

Evidence: `Tensorlake/sections/05-bench.png`.

Header row mono uppercase 10–11px `--tl-fg-4` over `--tl-ink-2`, hairline beneath.
Cells mono 12–13px, numerics right-aligned and tabular (`font-variant-numeric:
tabular-nums`). Row separators are hairlines; no zebra striping. The winning row gets
`--tl-green-wash` background and `--tl-green-2` figures — and must also be labelled in
text, never marked by colour alone.

Every table needs a mono caption stating method and units. Below 768px the table
scrolls horizontally inside its own container; the page must not scroll sideways.

---

## Form field

Background `--tl-ink-2`, 1px `--tl-stroke`, radius `--tl-radius-1`, padding
`10px 12px`, mono 13px. Label mono uppercase 11px `--tl-fg-4` above the field with
`--tl-sp-2` beneath — **always a real `<label>`**, never placeholder-as-label.

| State | Rule |
|---|---|
| Hover | border `--tl-stroke-2` |
| Focus-visible | border `--tl-green`, outline 2px `--tl-green` offset 2px |
| Filled | text `--tl-fg` |
| Disabled | `opacity: .45`, `aria-disabled`, no focus |
| Loading | field locked, mono spinner right-aligned inside, `aria-busy` |
| Error | border `#e5484d`, message beneath in mono 11px `#e5484d`, wired via `aria-describedby`, `aria-invalid="true"`; message states how to fix, not just what failed |
| Success | mono `✓` and a text confirmation; green alone is not sufficient |

Inline validation fires on blur, not per keystroke. Errors must survive a resubmit and
must not clear the user's input.

---

## Pricing tier

Evidence: `Tensorlake/fold/pricing-1440-fold.png`.

Columns divided by hairlines with no gap — they read as one ruled table, not as
floating cards. Each column: mono tier key (`FREE`, `PRO`) → display name (28–32px) →
one-line `--tl-fg-3` description → price display 44–52px with a mono unit beside it
(`PER BILLING CYCLE`) → numbered mono feature rows (`01`, `02`, …) → CTA.

The featured tier gets a 2px `--tl-green` top border, a `MOST POPULAR` chip, and green
price figures. It must not be scaled up or shadowed.

Below 768px columns stack, featured first, each keeping its full feature list.

---

## Footer

Evidence: `Tensorlake/sections/14-footer.png`.

Hairline top border, mono uppercase 12px `--tl-fg-2` links in columns, a bracketed
mono address block (`[ TENSORLAKE INC. ] HQ: SF`), status link, copyright. Link hover
goes to `--tl-fg` in 120ms with no underline animation.

---

## Accessibility acceptance criteria

Each is pass/fail and testable:

1. Body text ≥4.5:1 against its actual background; large text (≥24px or ≥19px bold)
   and UI boundaries ≥3:1. Check the real composited colours, including alpha.
2. Every interactive element reachable by Tab in visual order, with a focus indicator
   of ≥2px and ≥3:1 contrast against both the control and the page.
3. No information conveyed by colour alone — status, validity, selection, and the
   winning row each carry a text or glyph equivalent.
4. All seven states implemented per component and demonstrable in a state matrix.
5. Landmarks present (`header`/`nav`/`main`/`footer`); one `h1`; heading levels never
   skipped.
6. Every control has an accessible name; icon-only controls carry `aria-label`.
7. Overlays trap focus, close on `Escape`, and restore focus to the opener.
8. Live regions announce async results (`role="status"` for success, `role="alert"`
   for errors).
9. At 200% zoom and at 320px width, no horizontal page scroll and no clipped content.
10. `prefers-reduced-motion: reduce` removes all non-essential motion.
11. Touch targets ≥44×44px.
12. Every image has `alt`; decorative rules and glyphs are `aria-hidden`.
