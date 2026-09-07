# Tensorlake reference screenshots

Captured from **https://www.tensorlake.ai/** on **2026-09-07** at 1440×900 (desktop)
and 390×844 (mobile). Sections and components are 2× where noted. Regenerate with
`scripts/capture.mjs` (see `../reference/brief.md`).

Read the shots that match what you are building **before** writing markup.

## fold/ — above the fold, one per route

| File | Evidence of |
|---|---|
| `home-1440-fold.png` | The canonical first impression: header, display headline with green clause, lede, two CTAs, live code panel. Start here. |
| `pricing-1440-fold.png` | Hairline-divided plan columns, mono tier keys, numbered feature rows, featured-tier treatment. |
| `blog-1440-fold.png` | Editorial layout in dark theme: category tag, byline, featured post split. |
| `blog-paper-1440-fold.png` | Same page in the `[data-theme="paper"]` light variant — the only place light is used. |
| `blog-post-1440-fold.png` | Long-form article header and reading measure. |
| `careers-1440-fold.png` | List/roster layout, sparse page with heavy mono metadata. |
| `faq-1440-fold.png` | Disclosure rows, hairline separators, question typography. |

## pages/ — full-page desktop (JPEG)

`home`, `pricing`, `blog`, `blog-post`, `careers`, `faq` at 1440 wide, entire scroll
height. Use these for **section rhythm, ordering, and vertical spacing** — how much air
sits between blocks, how the page alternates dense and open.

## sections/ — each home section isolated (1×)

| File | Evidence of |
|---|---|
| `01-hero.png` | Display type scale, green accent clause, CTA pair, terminal panel with tabs. |
| `02-product.png` | The archetypal section: mono eyebrow, right-aligned taxonomy, split copy/terminal panel, two-column mono-labelled feature paragraphs. |
| `03-filesystem.png` | Long multi-part section with nested headings and diagrams. |
| `04-lifecycle.png` | Two-up explainer with 26px sub-headings. |
| `05-bench.png` | Benchmark table: mono headers, tabular numerics, highlighted winning row, method caption. |
| `06-harbor.png` | Integration/partner section with logo and prose. |
| `07-orchestration.png` | Layered diagram treatment. |
| `08-remote-dev.png` | Tallest section — terminal-forward, multi-panel. |
| `09-integrations.png` | Card grid: equal heights, hairline borders, mono eyebrows. |
| `10-backed-by.png` | Minimal band — mono label plus investor marks. |
| `11-deploy-and-trust.png` | Trust/compliance block. |
| `12-news.png` | Newsletter form: field styling, mono label, inline CTA. |
| `13-finalcta.png` | Closing CTA band. |
| `14-footer.png` | Footer columns, bracketed address block, mono link treatment. |

## components/ — isolated pieces at 2×

| File | Evidence of |
|---|---|
| `nav-header.png` | Header composition, current-page underline, CTA pair, icon links. |
| `hero-copy-and-buttons.png` | Headline tracking and CTA geometry at high resolution. |
| `code-panel.png` | Terminal chrome, tab row, prompt and output line grammar, copy control. |
| `feature-cards.png` | Card interior spacing and label hierarchy. |
| `logo-wall.png` | Customer logo band scale and spacing. |
| `footer.png` | Footer detail at 2×. |

## states/ — interaction states at 2×

| File | Evidence of |
|---|---|
| `cta-default.png` | Primary (green fill, ink text) and secondary (transparent, stroke border) side by side. |
| `cta-hover.png` | Hover deltas — colour only, no lift, no shadow. |
| `cta-focus-visible.png` | The focus ring treatment to reproduce. |
| `nav-default.png` / `nav-hover.png` | Nav link hover: grey → white, 120ms, nothing else moves. |

## mobile/ — 390×844 full page (JPEG)

`home`, `pricing`, `blog`. Evidence of how the split panels stack, how display type
reflows, how the nav collapses, and how tables and code panels scroll inside their own
containers rather than shrinking.
