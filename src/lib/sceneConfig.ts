/**
 * All 3D composition constants live here. Re-calibrating the scene against the
 * reference means editing this file — never component code.
 */

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

export type Vec3 = [number, number, number]

export type CameraState = {
  position: Vec3
  target: Vec3
  fov: number
}

export type SceneConfig = {
  /** Camera framings, interpolated between by CameraController. */
  camera: Record<'shelf' | 'detail', CameraState>
  /** Distance between adjacent books along X, in book-height units. */
  spacing: number
  /** Amplitude of the shallow Z wave so the row breathes instead of sitting on a rail. */
  depthWave: number
  /** How far books push away from the focus book during a detail transition. */
  disperse: number
  /** Where the focused book sits when in detail state. */
  detailBookPosition: Vec3
  detailBookScale: number
  /** Books beyond this |index - focus| distance are culled from the scene. */
  visibleRadius: number
  /** Global scale applied to the whole shelf group. */
  shelfScale: number
  /**
   * Where the shelf sits while the hero is on screen, so the books never collide
   * with the hero type. Eases back to the origin as the hero scrolls away.
   */
  heroOffset: Vec3
  /**
   * How strongly the focus curve dwells on whole books (1 = linear, higher = more).
   *
   * With a linear mapping the shelf spends as much scroll distance halfway between
   * two books as it does parked on one, so any given moment is as likely to show
   * two half-books as one centred one. Easing the fractional part makes books rest
   * centred and cross the gaps quickly — without ever snapping, since the mapping
   * stays continuous and monotonic. It matters most where only one book is in
   * frame, so mobile leans on it hardest.
   */
  focusEase: number
  dpr: [number, number]
  shadows: boolean
}

const shared = {
  visibleRadius: 5,
} as const

export const sceneConfigs: Record<Breakpoint, SceneConfig> = {
  desktop: {
    camera: {
      shelf: { position: [0, 0.12, 3.95], target: [0, -0.02, 0], fov: 32 },
      // The detail camera stays on axis; the book is placed to the right in world
      // space instead, so it never lands on top of the text column.
      detail: { position: [0, 0.02, 3.2], target: [0, 0, 0], fov: 30 },
    },
    spacing: 0.78,
    depthWave: 0.16,
    disperse: 2.4,
    detailBookPosition: [0.86, 0, 0.15],
    detailBookScale: 1.08,
    shelfScale: 1,
    heroOffset: [0.74, 0, -0.15],
    focusEase: 2.2,
    dpr: [1, 2],
    shadows: true,
    ...shared,
  },
  tablet: {
    camera: {
      shelf: { position: [0, 0.1, 3.6], target: [0, -0.02, 0], fov: 36 },
      detail: { position: [0, 0.08, 3.0], target: [0, 0.08, 0], fov: 34 },
    },
    spacing: 0.82,
    depthWave: 0.14,
    disperse: 2.2,
    detailBookPosition: [0, 0.26, 0.15],
    detailBookScale: 0.82,
    shelfScale: 0.96,
    heroOffset: [0.34, -0.06, -0.15],
    focusEase: 3,
    dpr: [1, 2],
    shadows: true,
    ...shared,
  },
  mobile: {
    camera: {
      shelf: { position: [0, 0.06, 2.4], target: [0, -0.02, 0], fov: 46 },
      detail: { position: [0, 0.14, 2.2], target: [0, 0.14, 0], fov: 44 },
    },
    spacing: 0.92,
    depthWave: 0.09,
    disperse: 1.8,
    detailBookPosition: [0, 0.54, 0.1],
    detailBookScale: 0.86,
    shelfScale: 0.95,
    heroOffset: [0, -0.6, -0.1],
    focusEase: 4,
    dpr: [1, 1.75],
    shadows: false,
    visibleRadius: 4,
  },
}

/** Book geometry, in book-height units (height === 1). */
export const bookGeometry = {
  height: 1,
  width: 0.66,
  /** Depth is derived from page count so titles differ physically. */
  minDepth: 0.055,
  maxDepth: 0.135,
  minPages: 160,
  maxPages: 528,
  coverThickness: 0.006,
  /** Covers overhang the page block on three edges — reads as a printed object. */
  coverOverhang: 0.008,
  bevel: 0.004,
} as const

export function depthForPages(pages: number): number {
  const { minDepth, maxDepth, minPages, maxPages } = bookGeometry
  const t = Math.min(1, Math.max(0, (pages - minPages) / (maxPages - minPages)))
  return minDepth + (maxDepth - minDepth) * t
}

/**
 * Yaw is POSITIVE toward the spine.
 *
 * The spine is the -x face, and rotating by +theta about Y swings -x toward the
 * camera at +z. A negative yaw swings the fore-edge forward instead — which looks
 * superficially similar at a glance but is the wrong face of the book.
 */
/** Far from focus: spine toward the viewer, with a sliver of cover still showing. */
export const SPINE_FORWARD_Y = 1.18
/** At focus: cover toward the viewer, with a sliver of spine still showing. */
export const COVER_FORWARD_Y = 0.16
/** Held while in the detail state. */
export const DETAIL_Y = 0.3
export const DETAIL_X = 0.02

/** Damping rates (per second). Higher is snappier. */
export const damping = {
  bookPosition: 5.2,
  bookRotation: 4.4,
  bookScale: 5.6,
  cameraPosition: 3.4,
  cameraTarget: 3.6,
  fov: 3.4,
  reduced: 40,
} as const
