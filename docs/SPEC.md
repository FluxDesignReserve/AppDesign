# Stripe Press — Implementation Specification

## 0. Source-of-truth caveat (read first)

This session's egress proxy blocks `press.stripe.com` (HTTP 403 on CONNECT) on every
channel available here — `curl`, the WebFetch tool, headless Chromium (same proxy), and
mirrors (`web.archive.org`, `r.jina.ai`). Live DOM inspection, computed-style extraction
and reference screenshots were therefore **not possible**.

Every value below is marked:

- **[K]** — from prior knowledge of the reference site.
- **[B]** — supplied in the project brief as a reference hypothesis.
- **[D]** — a derived/design decision made to fill a gap.

Anything marked **[D]** is the first thing to re-calibrate once the reference is reachable
or reference screenshots are supplied. The architecture is deliberately built so that
re-calibration touches **token files only** (`src/styles/tokens.css`,
`src/animations/motion.ts`, `src/lib/sceneConfig.ts`) and never component code.

---

## 1. Global visual system

| Token | Value | Src |
|---|---|---|
| Page background | `#201819` warm near-black | [B] |
| Raised surface | `#241b1c` | [D] |
| Primary text | `#f5f1ec` warm off-white | [K] |
| Secondary text | `#a89f99` | [D] |
| Tertiary / meta | `#7d736e` | [D] |
| Divider | `rgba(245,241,236,0.12)` hairline, 1px | [K] |
| Accent (links/focus) | `#e5c07b` muted brass | [D] |
| Content max width | 1200px, 12-column | [B] |
| Gutter | 24px desktop / 20px mobile | [D] |

Character notes [K]: warm dark editorial, not SaaS black. No rounded cards, no
glassmorphism, no gradients beyond a single subtle scene vignette. Chrome is minimal —
type, hairline dividers, and the books carry the design. Generous negative space.

### Typography

The reference sets an editorial transitional serif for display and a neutral sans for
UI/meta [K]. Stripe's licensed faces are unavailable, so the closest freely-licensed
substitutes are used [D]:

- `--font-display`: **Newsreader** — transitional serif, optical sizing, low contrast at
  display sizes. Substitute for the reference's editorial serif.
- `--font-body`: **Inter** — for nav, meta, form UI, captions.

Scale (fluid, `clamp()`; 8px vertical rhythm) [D]:

```
--text-xs   12px    --text-xl      24px
--text-sm   14px    --text-2xl     32px
--text-base 16px    --text-display clamp(40px, 6.2vw, 82px)
--text-lg   19px
```

Display type: weight 300, line-height 1.06, letter-spacing -0.02em [D].
Body: weight 400, line-height 1.62, measure capped at 62ch [D].

### Breakpoints [D]

`mobile < 768` · `tablet 768–1023` · `desktop ≥ 1024` · `wide ≥ 1440`

---

## 2. The 3D book system

### Geometry [K + D]

Books are real 3D objects, not CSS cards. Each book is composed of:

- **Page block** — a slightly inset box (99% of cover height, inset from the spine edge)
  with an off-white, high-roughness material and a procedurally striped page-edge texture
  giving visible leaf lines on the fore-edge, head and tail.
- **Front cover / back cover** — thin slabs (`coverThickness`) carrying the artwork
  texture, extending marginally beyond the page block on three edges (the real-world
  cover overhang), which is what reads as "printed object" rather than "textured box".
- **Spine** — carries its own texture, joins the two covers.
- **Bevel** — covers use a rounded-box profile with a ~0.6mm-equivalent radius so
  highlights catch the edges instead of producing a hard CG silhouette.

Proportions are stored per book so a tall thin book and a squat thick one differ, driven
by `pageCount` [D]:

```
height 1.00 (unit)  ·  width 0.66  ·  depth = f(pageCount) ≈ 0.055–0.135
coverThickness 0.006  ·  coverOverhang 0.008  ·  bevel 0.004
```

### Materials [K + D]

`MeshPhysicalMaterial` for covers: `roughness 0.62`, `clearcoat 0.10`,
`clearcoatRoughness 0.55`, no metalness — a matte litho stock with a faint sheen, never
glossy plastic. Pages: `roughness 0.95`, unlit-leaning off-white `#e8e2d8`. Spines share
the cover material so they read at the same value as the covers.

### Lighting [D]

- `ambientLight` 0.55 warm `#fff4e8` — lifts the shadow side without flattening.
- Key `directionalLight` from front-upper-left, intensity 1.7, soft shadow map 1024.
- Rim `directionalLight` from behind-right, intensity 0.9, cool `#cfd8e8` — separates the
  book silhouette from the warm-black background. This is the single most important light
  for the reference's look.
- Fill `pointLight` 0.35 below-front to keep the page block from going muddy.

Shadow maps are limited to the key light only. There is deliberately **no ground
plane**: the camera sits almost coplanar with the books' base, so a contact shadow
would cost a render target every frame and be invisible. The books shadow each other
from the key light instead.

Specular response comes from a procedurally painted equirectangular environment,
pre-filtered on the GPU (`src/components/Scene/Environment.tsx`) — no HDR fetch, a
few KB of VRAM, and the reflection matches the light rig by construction.

### Textures [D, legal]

Reference cover artwork is copyrighted and (a) unreachable here and (b) not
redistributable. Instead `src/textures/coverArt.ts` **generates** covers on a 2D canvas
from each book's metadata: a per-book palette, the display serif, and a per-book abstract
mark. Spines, back covers and page edges are generated to match.

This is an abstraction, not a compromise: `Book.cover`/`.spine`/`.back` accept a URL, and
if one is present it is loaded instead of generating. Dropping real artwork into
`/public/books/` swaps them in with zero component changes and identical dimensions.

---

## 3. Shelf composition & scroll choreography

### Shelf [K]

Books stand upright in a receding row, spine-forward, the way a shelf reads when you walk
past it — each book yawed toward the viewer so the spine faces you and the front cover is
foreshortened. Scroll moves *along* the shelf; the book nearest the camera centre is the
"active" one and rotates open toward cover-forward as it passes.

Layout [D]: books are laid out on the X axis with `spacing 0.78` (desktop), a shallow Z
sine so the row breathes rather than sitting on a rail, and a small per-book Y bob.

Yaw runs from cover-forward `y = +0.16rad` at focus to spine-forward `y = +1.18rad` by
1.5 book-widths away. **The sign matters**: the spine is the −x face, and only a
*positive* rotation about Y swings it toward a camera at +z. A negative yaw brings the
fore-edge forward instead — which reads as plausible in a thumbnail and is the wrong
face of the book. The turn is symmetric in `|distance|`, as a real shelf is: each book
sits spine-out, swings to cover-out at the middle, and swings back. Mirroring the yaw
by side would show half the row its wrong face.

Because every value is driven by signed distance from focus rather than by a timeline,
the choreography reverses correctly on upscroll for free.

**Focus dwell.** A linear scroll→focus mapping spends as much travel halfway between
two books as it does parked on one, so an arbitrary scroll position is as likely to show
two half-books as one centred book. The fractional part of the focus index is therefore
passed through a symmetric power ease (`focusEase`, per breakpoint): continuous and
monotonic, so nothing ever snaps, but books rest centred and cross the gaps quickly. At
the mobile setting roughly a quarter of the travel is transitional, versus about seventy
per cent when linear. It matters most where only one book is in frame, so mobile leans
on it hardest [D].

While the hero is on screen the whole shelf group holds a per-breakpoint offset
(`heroOffset`) so the books never sit under the hero type, easing back to the origin as
the hero scrolls away and cancelling entirely once a book is opened.

### Scroll engine

`useScrollProgress()` exposes `{ scrollY, progress, velocity, direction }`. Lenis provides
smoothing; native scroll remains intact for keyboard and a11y, and Lenis is disabled
entirely under `prefers-reduced-motion`.

Scroll drives a single normalized `shelfProgress ∈ [0,1]`, mapped to a continuous
`focusIndex = shelfProgress × (bookCount − 1)`. Every book derives its own transform from
`index − focusIndex`. There is exactly one scalar of truth, so no two timelines can
compete and the scene always converges.

All per-frame motion uses frame-rate-independent damping
(`damp(current, target, lambda, dt)`), never direct assignment — required by the brief and
what keeps fast flicks from snapping.

### State machine

```
shelf → transitioning → detail → returning → shelf
```

One store (`zustand`), one source of truth: `sceneState`, `activeSlug`, `shelfProgress`,
`transitionProgress`. Route changes drive the store; the store drives the scene.

### Shelf → detail choreography [D, timings]

Measured timings were not observable, so the sequence is authored as an intentional
timeline in `src/animations/motion.ts` rather than a blanket CSS transition:

```
  0ms  selected book begins moving toward camera
 60ms  neighbouring books begin dispersing outward + fading
120ms  camera begins its move to the detail framing
180ms  selected book rotates spine-forward → cover-forward
420ms  book settles at its detail position (right side, desktop)
480ms  detail text begins revealing (staggered lines, 40ms apart)
760ms  content fully readable
```

Detail → shelf runs the same timeline reversed at 0.82× duration [D] — returning feels
slightly quicker than committing, which reads as correct.

The book object is **never** unmounted across the transition; it keeps a persistent 3D
identity and is physically carried between states.

**Does the book open?** No. The reference's interaction grammar is *rotation* — a book
turns from spine-out to cover-out; it is not a page-flip experience [K]. The geometry
carries a real page block so the leaf edges read correctly at every angle, but no
cover-opening animation is authored, because inventing one would add an interaction the
reference does not have. If observation later shows otherwise, `BookPages` already has
the geometry to hinge from.

### Camera system

`CameraController` owns the camera exclusively; no component touches it. Named states
(`shelf`, `detail`, plus per-viewport variants) each declare `position`, `target`, `fov`.
The controller damps position and target independently and re-derives `lookAt` each frame.

Desktop: `fov 32`, camera at `(0, 0.12, 3.95)` [D] — a long lens keeps perspective
distortion restrained and editorial rather than fisheyed.

In the detail state the camera stays **on axis** and the book is placed to the right in
world space, rather than the camera targeting the book. Pointing the camera at the book
centres it on screen, which puts it straight on top of the text column at every
breakpoint. Mobile and tablet keep the same principle with the book above the copy.

---

## 4. Responsive

Not a scaled-down desktop [K]. `useResponsiveScene()` returns a per-breakpoint scene
config: mobile pulls the camera in and raises FOV, reduces book spacing and depth spread,
and moves the detail layout from side-by-side to book-above-text. DPR is clamped
(`[1, 2]` desktop, `[1, 1.75]` mobile), shadows drop on mobile.

## 5. Routing

`/` shelf · `/:slug` book detail. Deep links load straight into the detail framing with
the scene pre-seeded to that book's focus index (no visible fly-through on cold load).
Back/forward is driven by React Router; the store subscribes to route changes so browser
navigation animates the scene rather than remounting it.

## 6. Performance

- The 3D stack (three + fiber + drei, ~900 kB) is a **dynamic import**. Nothing above
  the fold needs it, so type and layout paint first — and a browser without WebGL never
  downloads it at all. The fallback's artwork path is deliberately kept in its own
  module that imports only the 2D canvas, never three.
- The per-frame transform path is **allocation-free**: transforms are written into
  pre-allocated objects rather than returned, which removes ~100 short-lived arrays per
  frame at 19 books.
- Scroll, pointer and transition progress live in non-reactive singletons read inside
  `useFrame`. React re-renders only when the *focused book* changes.
- Textures are generated once per book, cached, shared where identical (the page edge is
  one texture for the whole shelf), and released on teardown. Materials are per-book and
  disposed with the book.
- DPR is clamped per breakpoint and shadows drop on mobile and low-power devices.

## 7. Fallback & accessibility

- WebGL absent/failed → `NoWebGLShelf` renders the same generated cover art as static
  images with the full IA, links and detail content preserved. Never a blank canvas.
- The canvas is `aria-hidden`; a visually-hidden live region announces scene state, and a
  real focusable list of books shadows the 3D shelf so keyboard and screen-reader users
  navigate the identical information architecture.
- `prefers-reduced-motion` → Lenis off, damping λ raised to near-instant, transition
  timeline collapsed to opacity-only, scroll-linked rotation frozen at focus values.
- Visible focus rings, semantic landmarks, contrast-checked text pairs.

## 8. Editorial sections

Below the shelf, in reference order [K]: film (*We Are As Gods*, *Beneath the Surface*),
podcast, newsletter signup, footer with Stripe Press description, legal/company links and
copyright.

Newsletter implements all six visible states [B]: `default · focused · invalid ·
submitting · error · success`, with the reference's copy. Submission is mocked
(`src/lib/newsletter.ts`) — no real backend is contacted. An address on `@error.`
reaches the network-error state.

Film stills are **flat colour fields**, not gradients: an honest placeholder for a
still that cannot be reproduced, with frame and aspect ratio preserved.

## 9. Known defects found by QA (and fixed)

Recorded because they are the failure modes this architecture is prone to, and worth
re-checking after any change:

- **Yaw sign** — books showed their fore-edge instead of their spine (see §3).
- **Detail camera** — targeting the book centres it over the text column (see §3).
- **Lenis owns the scroll position.** Two separate bugs came from forgetting this:
  native `scrollIntoView` was silently overridden (nav section links did nothing), and
  Lenis's cached scroll limit is stale immediately after a route change, so
  return-to-shelf was clamped to the previous page's height and landed on the wrong
  book. Every imperative scroll must go through Lenis *and* resync its limit first.
- **Two sources of focus** — the caption read raw scroll while the scene read a damped
  value, so they could name different books. They now share one signal.
- **Fallback blankness** — the tall shelf scroll range remained with no scene behind it,
  giving a full screen of nothing. It collapses when WebGL is absent.
- **dt clamping starves damping** — a 1/30s cap made the scene lag scroll on slow
  frames. Exponential damping is unconditionally stable; the cap only needs to survive a
  backgrounded tab.

## 10. Content integrity

The 19-title catalog and the two films come from the brief. Descriptions, praise and
author bios were not reachable, so long-form copy is **clearly marked placeholder**
(`isPlaceholder` on the record, surfaced in the UI as a marker) while preserving exact
dimensions and interaction behaviour. Nothing is fabricated and attributed to a real
person: no invented quotes, prices or biographies.
