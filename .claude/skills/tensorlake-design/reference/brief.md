# Authoring brief and provenance

## What this skill implements

The supplied brief (`Design_Skills_Tensor.md`) asked for implementation-ready,
token-driven UI guidance for Tensorlake, with:

- semantic tokens rather than raw values in all component guidance
- seven mandatory states per component (default, hover, focus-visible, active,
  disabled, loading, error)
- keyboard, pointer and touch behaviour documented per component
- long-content, overflow and empty-state handling
- WCAG 2.2 AA with testable acceptance criteria
- "must" for non-negotiables, "should" for recommendations
- a QA checklist to close

Those live in `components.md`, `tokens.md` and `checklist.md`.

## One correction to the brief

The brief describes the audience as "online shoppers and consumers" and the product
surface as an "e-commerce storefront". That does not match Tensorlake, which sells
sandbox and filesystem infrastructure to engineers building agents — the live site has
no storefront, cart, or product listing anywhere. It reads as template boilerplate left
in the generated brief.

This skill encodes the real audience (**developers and infrastructure teams**) and the
real surfaces (marketing site, docs, engineering blog, dashboard). The token values,
rule structure and quality gates from the brief are kept as given. If e-commerce work
genuinely is intended, the visual language still applies — but the component set would
need cart, product card, checkout and order-status rules, which are not in here.

## Where the values came from

Nothing here was estimated. On 2026-09-07 the live site was loaded in headless
Chromium and interrogated directly:

- **116 CSS custom properties** read out of the author stylesheets (`--tl-*`, plus the
  `--bl-*` set the blog's paper theme uses). The site ships a real token system; this
  skill adopts its names so generated code and the reference stay in sync.
- **Computed styles** for `body`, `h1`–`h4`, paragraphs, nav links, both button
  variants, eyebrows, code, cards and footer links.
- **A census** of every rendered element's colour, background, font family, font size
  and radius, to establish which values actually carry the page versus which merely
  exist in the stylesheet.
- **Transition properties and durations** across the whole page (nothing exceeds 180ms).
- **Layout metrics** — 1320px container, section heights, theme attribute.

Raw output: `tokens.json`, `buttons.json`, `themes.json`, `shots.json`.

The brief's own token list agrees with these measurements (`#989d9e`, `#0aa67d`,
`#161715`, `#171e17`, 2px/3px radii, 120/140/180ms), which is a useful cross-check.
Where the brief's typography scale stopped at 16px, the measured display scale
(92 / 52 / 37 / 22px) has been added, since headline treatment is the loudest part of
this design language.

## Refreshing the captures

```bash
npm install playwright          # or use an existing install
node scripts/capture.mjs        <path-to-this-skill>    # screenshots
node scripts/extract-tokens.mjs <path-to-this-skill>/reference/tokens.json
```

`CHROME_PATH` overrides the browser binary. `scripts/fetchvia.mjs` fulfils every browser
request through `curl`, which is only needed in sandboxes where the browser cannot
open its own TLS tunnel; in a normal environment you can delete the `attachRouter`
call and let Playwright fetch directly.

After refreshing, re-check the values in `tokens.css` against the new
`reference/tokens.json` and update the capture date in `SKILL.md` and
`Tensorlake/INDEX.md`.

## Content honesty

The screenshots contain Tensorlake's real copy, customer logos, pricing and author
names. They are reference material for **layout, typography, spacing and colour** —
do not lift the copy, logos, testimonials, prices, or benchmark figures into other
work, and never attribute invented quotes or metrics to real people or companies.
