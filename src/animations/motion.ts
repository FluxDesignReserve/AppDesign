/**
 * Central motion configuration. No timing or easing value should be written inline
 * in a component or in JSX — they all resolve from here.
 *
 * Durations are seconds (GSAP). The shelf → detail sequence is authored as an
 * intentional choreography rather than a blanket transition; see `timeline` below.
 */

export const ease = {
  /** Primary: fast departure, long settle. Used for object motion. */
  out: 'power3.out',
  /** Committing to a state (shelf → detail). */
  inOut: 'power2.inOut',
  /** Text reveals. */
  text: 'power2.out',
} as const

export const motion = {
  shelfToDetail: { duration: 0.76, ease: ease.inOut },
  /** Returning reads slightly quicker than committing. */
  detailToShelf: { duration: 0.62, ease: ease.inOut },
  /** Detail → detail (next/previous book) — the objects stay continuous. */
  bookTransition: { duration: 0.68, ease: ease.inOut },
  hover: { duration: 0.32, ease: ease.out },
  textReveal: { duration: 0.62, ease: ease.text, stagger: 0.04 },
} as const

/**
 * Choreography offsets, as a fraction of the shelf→detail duration. These encode the
 * sequence described in docs/SPEC.md §3.
 *
 *   0.00  selected book begins moving toward camera
 *   0.08  neighbours begin dispersing and fading
 *   0.16  camera begins its move
 *   0.24  selected book rotates spine-forward → cover-forward
 *   0.55  book settles
 *   0.63  detail text begins revealing
 *   1.00  content fully readable
 */
export const beat = {
  bookMove: 0.0,
  disperse: 0.08,
  camera: 0.16,
  rotate: 0.24,
  settle: 0.55,
  text: 0.63,
} as const

/** Under reduced motion the choreography collapses to a near-instant cross-state. */
export const reducedMotion = {
  duration: 0.001,
  ease: 'none',
} as const
