import { clamp, invLerp, lerp, smoothstep } from '../lib/math'
import {
  COVER_FORWARD_Y,
  DETAIL_X,
  DETAIL_Y,
  SPINE_FORWARD_Y,
  type SceneConfig,
  type Vec3,
} from '../lib/sceneConfig'
import { beat } from './motion'

export type BookTransform = {
  position: Vec3
  rotation: Vec3
  scale: number
  opacity: number
}

export const emptyTransform = (): BookTransform => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  opacity: 1,
})

/** Distance (in book units) over which a book completes its turn. */
const TURN_DISTANCE = 2.0

/**
 * Scratch buffer for the shelf pose. Resolving a book's transform runs 19 times per
 * frame, so these functions write into pre-allocated objects rather than returning
 * fresh arrays — otherwise the hot path would produce ~100 short-lived arrays every
 * frame purely for the garbage collector.
 */
const scratch = emptyTransform()

/**
 * Where a book sits on the shelf, derived purely from its signed distance from the
 * focus index. Because it is distance-driven rather than timeline-driven, upward
 * scroll reverses the choreography for free and no two animations can compete.
 */
export function shelfTransform(
  index: number,
  focusIndex: number,
  config: SceneConfig,
  hover = 0,
  out: BookTransform = scratch,
): BookTransform {
  const d = index - focusIndex
  const ad = Math.abs(d)

  /**
   * The turn is symmetric in |d|, which is how a shelf actually behaves: each book
   * sits spine-out, swings to cover-out as it reaches the middle, then swings back
   * as it leaves. Mirroring the yaw by side would show half the shelf its wrong face.
   */
  const turn = smoothstep(ad / TURN_DISTANCE)

  const focus = 1 - smoothstep(ad / 1.1) // 1 at focus, 0 by ~1.1 books away

  out.position[0] = d * config.spacing
  out.position[1] =
    -ad * 0.012 + Math.sin(index * 1.7) * 0.006 + focus * 0.015 + hover * 0.022
  // Books recede as they leave focus, and lift toward the viewer at focus.
  out.position[2] =
    -ad * 0.1 +
    focus * 0.14 +
    Math.sin(index * 0.9) * config.depthWave * 0.22 +
    hover * 0.045

  // Slight backward tilt at focus, as if lifted off the shelf.
  out.rotation[0] = focus * 0.03
  out.rotation[1] = lerp(COVER_FORWARD_Y, SPINE_FORWARD_Y, turn)
  // A hair of roll, signed by side, keeps the row from reading as a rail.
  out.rotation[2] = Math.sign(d) * turn * 0.015

  out.scale = lerp(1, 0.94, smoothstep(ad / 3)) + focus * 0.03 + hover * 0.015
  out.opacity =
    1 - smoothstep(invLerp(config.visibleRadius - 1.4, config.visibleRadius, ad))

  return out
}

/**
 * Blend a book's shelf transform toward its detail (or dispersed) transform, writing
 * the result into `out`.
 *
 * `progress` is the single master transition scalar. The choreography beats are
 * sub-ranges of it, so the sequence staggers without any independent timelines.
 */
export function resolveBookTransform(
  {
    index,
    focusIndex,
    progress,
    isActive,
    config,
    hover = 0,
  }: {
    index: number
    focusIndex: number
    progress: number
    isActive: boolean
    config: SceneConfig
    hover?: number
  },
  out: BookTransform,
): BookTransform {
  shelfTransform(index, focusIndex, config, isActive ? 0 : hover, out)
  if (progress <= 0.0001) return out

  if (isActive) {
    const [dx, dy, dz] = config.detailBookPosition
    const moveP = smoothstep(invLerp(beat.bookMove, beat.settle, progress))
    const rotP = smoothstep(invLerp(beat.rotate, 1, progress))
    const scaleP = smoothstep(invLerp(beat.bookMove, beat.settle + 0.2, progress))

    out.position[0] = lerp(out.position[0], dx, moveP)
    out.position[1] = lerp(out.position[1], dy, moveP)
    out.position[2] = lerp(out.position[2], dz, moveP)

    out.rotation[0] = lerp(out.rotation[0], DETAIL_X, rotP)
    out.rotation[1] = lerp(out.rotation[1], DETAIL_Y, rotP)
    out.rotation[2] = lerp(out.rotation[2], 0, rotP)

    out.scale = lerp(out.scale, config.detailBookScale, scaleP)
    out.opacity = 1
    return out
  }

  // Non-selected books disperse outward and fade, clearing the frame.
  const dispP = smoothstep(invLerp(beat.disperse, 0.72, progress))
  const dir = Math.sign(index - focusIndex) || 1

  out.position[0] += dir * config.disperse * dispP
  out.position[1] -= dispP * 0.12
  out.position[2] -= dispP * 0.9
  out.rotation[1] = lerp(out.rotation[1], out.rotation[1] - dir * 0.5, dispP)
  out.scale *= lerp(1, 0.88, dispP)
  out.opacity *= 1 - clamp(dispP * 1.15)

  return out
}
