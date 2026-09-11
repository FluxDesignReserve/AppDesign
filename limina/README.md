# Limina — landing page

A single-page marketing site for **Limina**, a fictional pre-closing automation product for
title and escrow teams. Built as a design exercise in the idiom of contemporary AI-native
B2B one-pagers (a dark, warm canvas; a single metallic accent; editorial serif emphasis;
product UI rendered as live, animated mock panels rather than screenshots).

Everything here is original: the brand, the logo, the copy, the mock data, the company and
people named in the testimonial and marquee. Figures are illustrative and the page says so.

## Structure

| # | Section | Notes |
|---|---------|-------|
| 1 | Sticky nav | Compacts and blurs after 24px of scroll; collapses to a menu under 760px |
| 2 | Hero | Headline with one serif-italic word, dual CTA, animated **file lane** product panel (documents stream in, fields extract) |
| 3 | Logo marquee | Fictional customers; pauses on hover |
| 4 | Stakes | Four-item numbered list of the manual work the product removes |
| 5 | How a file moves | Five alternating feature rows, each with an interactive mock: diff tabs, search timeline, message thread, proration bars, commitment schedule |
| 6 | Human in the loop | Review queue with working Approve buttons |
| 7 | Metrics | Count-up on scroll |
| 8 | Quote | Serif pull-quote |
| 9 | Trust & control | Six-cell security/permissions grid |
| 10 | FAQ | Accordion, one open at a time |
| 11 | Final CTA | Glow band |
| 12 | Footer | Columns, legal line, fictional-brand disclaimer |

## Design tokens

Defined at the top of `styles.css`:

- **Canvas** `--ink-900 … --ink-700` — near-black with a cool cast
- **Text** `--paper` (warm off-white), `--paper-dim`, `--muted`
- **Accent** `--brass-100 … --brass-500` — used for eyebrows, serif emphasis, primary CTA, glows
- **Status** `--ledger` (green, verified/complete) and `--flag` (amber, needs attention)
- **Type** Inter Tight (UI/display), Newsreader italic (emphasis, quote), IBM Plex Mono (labels, data)

Fonts load from Google Fonts with system fallbacks; the page is fully legible without them.

## Running

No build step. Open `index.html` directly, or serve the folder:

```bash
cd limina && python3 -m http.server 4190
```

Respects `prefers-reduced-motion` (reveals, count-ups and panel animations are disabled).
