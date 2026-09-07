# Hero image spec

Production spec for the image that sits in the hero panel of `index.html`.
All display numbers are measured from the built page, not estimated.

---

## 1. Resolution

The slot is fluid. It is **458 CSS px wide on desktop**, but it goes full-width
below the 1081px breakpoint, and its **largest render is 985 CSS px wide** (at a
viewport of exactly 1080px, where the hero collapses to one column and the panel
takes the full shell). Size the asset for the largest case, not the desktop case.

| | Width | Height |
|---|---|---|
| Desktop slot (≥1081px viewport) | 458 px | 519 px |
| **Largest render** (1080px viewport) | **985 px** | **1116 px** |
| **Ship this master @2×** | **1970 px** | **2232 px** |
| Optional desktop-only @2× (srcset) | 916 px | 1038 px |

**Aspect ratio: 0.8825 : 1** (458 ÷ 519), i.e. very close to **8:9** portrait.

**Ship one file at 1970 × 2232.** That is 2× the largest render, so it stays sharp
on retina at every breakpoint. Do not go to 3× — this is a soft, low-frequency
image and the extra bytes buy nothing visible.

### If you are generating it with an AI tool

Generation tools only offer fixed ratios, and 0.8825 is not one of them. Either:

- generate **4:5** at 2048 × 2560, then crop the height to 2321 and resize to 1970 × 2232; or
- generate **1:1** at 2048 × 2048, then crop the width to 1807 and resize to 1970 × 2232.

Compose with the crop in mind — keep the subject clear of the edge you will cut.

---

## 2. Format and weight

The page is published as an Artifact, and the Artifact CSP **blocks images from
external hosts**. The image must be embedded as a base64 data URI, which inflates
it by ~33%. Budget accordingly.

| | |
|---|---|
| Format | WebP, quality 78–82 |
| **Raw budget** | **≤ 200 KB** (≈ 270 KB once base64-encoded) |
| Alternative | AVIF q50 if you can drop Safari < 16.4 |
| Flat dither art only | PNG-8, 32-colour palette — often beats WebP on hard-edged pixel work |
| Never | Un-optimised PNG-24, or anything over 400 KB |

If the page is instead hosted normally (not as an Artifact), drop the data URI and
serve `srcset` with the 916px and 1970px variants.

---

## 3. Colour

Lock to the page tokens. These are lifted from the TestMu Figma variable set.

| Token | Hex | Use |
|---|---|---|
| Panel interior | `#FFFFFF` | **The image background must be this** |
| Paper ground | `#F5F4F0` | Page ground outside the panel |
| Ink | `#121212` | Darkest value in the image |
| Muted | `#4D4D4D` | Mid values |
| Rule | `#D3D2CD` | Hairlines |
| Dot | `#C9C7BD` | The halftone/dither field |
| Pass green | `#1F883D` | Accent only — **≤ 5% of pixels** |

**The one thing that will go wrong:** the panel interior is `#FFFFFF`, not the
cream `#F5F4F0`. If the image is generated on a cream background it will show a
visible seam against the white panel. Either generate on pure white, or change
`--card` to `var(--paper)` in the stylesheet so the panel is cream too. Decide
before generating, not after.

No other hues. Desaturate anything the generator introduces — no blue, no
terracotta, no gradient wash.

---

## 4. Composition

- **Subject direction:** museum meets machine. A painterly / neoclassical form
  dissolving into a hard-edged dot or pixel field — the motif already running
  through the TestMu boards (the classical figure, the Kane CLI pixel wordmark).
- **Value structure:** densest at the lower left, thinning toward the upper right.
  This matches the drawn field currently in the panel and keeps weight away from
  the panel's metadata strip.
- **Dot pitch:** at final size, the dissolve dots must be **≥ 6 px** so they still
  read as discrete squares at the 458px desktop render. Finer than that turns to mush.
- **Safe area:** keep focal content within the central **88%** (≈6% margin on each
  edge). The panel draws 5×5px ink ticks over all four corners.
- **No baked effects:** no drop shadow, no vignette, no rounded corners, no border.
  The panel supplies its own 1px `#D3D2CD` border.

### Do not include

Text, words or lettering · logos or wordmarks · UI chrome, buttons or fake
dashboards · human faces addressing the camera · stock-photo lighting · anything
implying a specific real person or customer.

---

## 5. Implementation

Replace the `<canvas id="matrix">` in the hero panel with:

```html
<img src="data:image/webp;base64,…" width="1970" height="2232"
     alt="" role="presentation" />
```

Keep the explicit `width`/`height` so the browser reserves the box and the page
does not shift while the image decodes. `#matrix { width:100%; height:auto }`
already covers the sizing; apply the same rule to the `img`.

`alt=""` is correct **only if** the image stays purely decorative. The sixteen
checks it currently shows are content, so if the final image carries that meaning,
describe it instead: `alt="Sixteen checks, all passing."`

---

## 6. Delivery

```
hero-testmu-16@2x.webp     1970 × 2232   ≤200 KB   ← the one that ships
hero-testmu-16@1x.webp      985 × 1116   ≤ 70 KB   optional srcset
hero-testmu-16-master.png  2048 × 2560   lossless  archive, pre-crop
```

Keep the layered/master file. The crop ratio will change if the hero layout does.
