# Limina — landing page

A single-page marketing site for **Limina**, a fictional pre-closing automation product for
title and escrow teams. Built as a design exercise in the idiom of the reference site's
system: warm cream paper, a single olive accent, editorial serif display type, pale-blue
inset panels, flat pastoral illustration, and a full-bleed landscape carrying the closing
CTA and footer.

Everything here is original: the brand, the logo, the copy, the mock data, the illustrations
(all inline SVG), and the company and investor names. Figures are illustrative and the page
says so.

## Structure

| # | Section | Notes |
|---|---------|-------|
| 1 | Sticky nav | Serif wordmark, centred links, cream + olive buttons; collapses under 900px |
| 2 | Hero | "Backed by" pill, parenthesised serif headline, single olive CTA; illustrated *wings* flank the copy and overlap the panel below |
| 3 | Product panel | Pale-blue rounded panel with an app-window mock (order view, inbound docs, extracted terms) |
| 4 | Try strip | "Have a contract handy?" with two buttons |
| 5 | How it works | Centred serif heading, four numbered steps (a real sequence) beside a routing mock |
| 6 | Capacity panel | Second pale-blue panel with the left wing, heading and three warm-white cards |
| 7 | Safety | Golden key emblem, heading, two serif-subheaded columns around a golden-fields illustration |
| 8 | Landscape | One SVG scene (sky → fields → trees → forest) behind the CTA and the dark-green footer |

## Design tokens

Defined at the top of `styles.css`:

- **Paper** `--paper #F2EFE5`, cards `--card #FDFBF5`
- **Ink** `--ink #2B2927`, muted `--muted #736E6A`
- **Accent** `--olive #62654E` (buttons), `--sage #5C7C68` (step numbers)
- **Panels** `--panel-a #DBE6EA → --panel-b #CAD8DB`
- **Illustration** greens `#47592A #576635 #62654E #9AA585`, golds `#BC893B #D6B778 #EFD7A3`, forest `#233426`
- **Type** Instrument Serif (display, −3% tracking), Geist (UI/body)

Fonts load from Google Fonts with serif/sans system fallbacks.

## Running

No build step. Open `index.html` directly, or serve the folder:

```bash
cd limina && python3 -m http.server 4190
```

Respects `prefers-reduced-motion`; content is visible without JavaScript.
