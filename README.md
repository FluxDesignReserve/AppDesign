# Stripe Press — interactive replica

A reverse-engineered recreation of the Stripe Press experience: a WebGL shelf of real
3D books, scroll-driven choreography, and a shelf ⇄ detail transition that carries the
selected book between states rather than cross-fading it.

> **Read `docs/SPEC.md` first.** It is the implementation specification, and its opening
> section records an important constraint: `press.stripe.com` was unreachable from the
> environment this was built in (the egress proxy returns 403 for it on every channel),
> so the live site could not be inspected. Every value in the spec is tagged with its
> provenance — prior knowledge, supplied brief, or design decision — and the ones marked
> **[D]** are what to re-calibrate first against the real site.

## Running

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build
npm run typecheck
```

## QA

QA runs against the **production build**, not the dev server — HMR reloads would
otherwise destroy the page context mid-run.

```bash
npm run build
npm run preview     # serves dist on 127.0.0.1:4173
npm run shots       # full viewport matrix + interaction suite
npm run quickshots  # fast subset while iterating
```

`scripts/screenshots.mjs` captures 1440×900, 1280×720, 1024×768, 768×1024 and 390×844,
walks the interaction checklist (open, next, back/forward, return, fast-scroll reversal,
newsletter states, reduced motion, WebGL disabled) and exits non-zero on any console
error, page exception or failed assertion.

## Where things live

| Concern | File |
|---|---|
| Colour, type, spacing tokens | `src/styles/tokens.css` |
| 3D composition, camera framings, damping rates | `src/lib/sceneConfig.ts` |
| Durations, easings, choreography beats | `src/animations/motion.ts` |
| Per-book transform resolution | `src/animations/bookAnimations.ts` |
| Camera state resolution | `src/animations/cameraAnimations.ts` |
| State transitions | `src/animations/transitionTimelines.ts` |
| Catalogue | `src/data/books.ts`, `films.ts`, `podcasts.ts` |
| Generated artwork | `src/textures/coverArt.ts` |

Re-tuning the look should mean editing the first three files. No timing, easing, colour
or camera value is written inline in a component.

## Architecture notes

**One scalar of truth.** Every book's transform derives from its signed distance to a
single live focus index, blended toward the detail framing by a single transition
scalar. There are no per-book timelines, so no two animations can compete: the scene
converges to the correct state regardless of scroll speed, direction reversals, or
transitions interrupted midway. Scrolling upward reverses the choreography for free,
because nothing about it is direction-dependent.

**Nothing animated is assigned.** All continuous motion uses frame-rate-independent
exponential damping (`damp` / `dampSettle` in `src/lib/math.ts`).

**Scroll never re-renders React.** Scroll and pointer write to non-reactive singletons
(`scrollState`, `focusState`, `transitionState`) that `useFrame` reads directly. React
state changes only when the *focused book* changes — roughly once per book, not once per
frame.

**The caption and the scene share one focus value.** The caption reads the scene's own
damped focus rather than raw scroll, so it can never name a different book than the one
actually centred.

## Assets and content

Cover, spine, back and page-edge artwork is **generated** from each book's metadata and
palette (`src/textures/coverArt.ts`) — the reference artwork is copyrighted and was not
retrievable. This is an abstraction, not a stand-in: set `cover` / `spine` / `back` on a
book record to a URL (e.g. under `/public/books/`) and that image is used instead, with
identical dimensions, UVs and interactions.

Titles, authors and years are factual catalogue metadata. Descriptions, praise and
author bios could not be retrieved, so they are **clearly marked placeholders** — no
quotes, prices or biographies are invented and attributed to real people.

The newsletter is wired to a mock (`src/lib/newsletter.ts`); Stripe's real backend is
never contacted. Submit an address on `@error.` to exercise the network-error state.

## Fallbacks

- **No WebGL / lost context** → `NoWebGLShelf` renders the same generated covers as flat
  images with the full IA, routes and links intact. Never a blank canvas.
- **`prefers-reduced-motion`** → Lenis off, damping near-instant, choreography collapsed,
  pointer parallax disabled. Navigation and information architecture are unchanged.

Not affiliated with Stripe. Built for study.
