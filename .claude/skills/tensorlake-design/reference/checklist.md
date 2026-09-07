# QA checklist

Run before delivering any design. Anything unchecked is either fixed or called out
explicitly in the handoff.

## Looked at the reference

- [ ] Opened the screenshots in `Tensorlake/` that match what was built, **before**
      writing markup — not after.
- [ ] Result placed next to `Tensorlake/fold/home-1440-fold.png` reads as the same
      system: same darkness, same density, same ruled structure.

## Tokens

- [ ] `tokens.css` `:root` block is present and referenced; no raw hex, px font size,
      radius, or duration outside it.
- [ ] Background is `--tl-ink` `#161715`, not `#000` and not neutral grey.
- [ ] Exactly one accent hue. No gradients. No second brand colour.
- [ ] Spacing values all come from the 4→120 scale.
- [ ] Radii are 0/2/4/8 (12 only on a large panel). No pills.
- [ ] No drop shadows on the dark theme; structure is hairlines and column rules.

## Type

- [ ] Display face for prose and headings; mono for every label, button, nav item,
      tag, stat, timestamp, table header, and code.
- [ ] Weight 500 on all display type, including the largest headline. Nothing bolded.
- [ ] Negative tracking scales with size; small mono uppercase uses `--tl-track-crunch`.
- [ ] Headings end in a period; at most one clause coloured `--tl-green-2`.
- [ ] Body measure ≤~62ch.

## Layout

- [ ] Container ≤1320px, gutters 24/20.
- [ ] Section rhythm uses `--tl-sp-9`/`--tl-sp-10`; sections open eyebrow → heading → body.
- [ ] Cards in a row are equal height with aligned CTAs.
- [ ] Checked at 1440, 1024, 768, 390. No horizontal page scroll at any width; wide
      tables and code scroll inside their own container.

## States

- [ ] Every interactive component defines default, hover, focus-visible, active,
      disabled, loading, and error.
- [ ] Focus-visible is a 2px `--tl-green` outline at 2px offset, visible on every
      variant. No bare `outline: none`.
- [ ] Loading states lock width so nothing reflows.
- [ ] Error messages say how to fix, are wired via `aria-describedby`, and preserve
      user input.

## Accessibility (WCAG 2.2 AA)

- [ ] Contrast measured on composited colours: 4.5:1 body, 3:1 large text and UI edges.
- [ ] `--tl-fg-4` used at ≥14px wherever it carries meaning.
- [ ] Tab order matches visual order; overlays trap focus and restore it on close.
- [ ] Nothing conveyed by colour alone.
- [ ] Landmarks, single `h1`, unskipped heading levels, accessible names on all controls.
- [ ] 200% zoom and 320px width both clean.
- [ ] Touch targets ≥44×44px.
- [ ] `prefers-reduced-motion` respected.

## Motion

- [ ] Nothing exceeds 180ms.
- [ ] Transitions limited to background, color, border-color, opacity, transform.
- [ ] No scroll entrances, parallax, springs, or hover lifts.
- [ ] `--tl-glow-green` used at most once per viewport.

## Copy

- [ ] Concise, concrete, implementation-focused. Real numbers where claims are made.
- [ ] Sentence case in prose; UPPERCASE only in mono labels.
- [ ] Buttons name the outcome (`READ THE DOCS →`), never "Learn more" or "Click here".
- [ ] No exclamation marks, no superlatives, no invented metrics, testimonials, logos,
      or prices.

## Handoff

- [ ] Stated which reference screenshots the work was matched against.
- [ ] Listed any deliberate deviation from this system and why.
- [ ] If adapted to a non-Tensorlake product, said in one line what was carried over
      and what was swapped.
