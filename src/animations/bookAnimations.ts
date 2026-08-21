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

/** Distance (in book units) over which a book completes its turn. */
const TURN_DISTANCE = 2.0

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

  const x = d * config.spacing
  // Books recede and settle very slightly as they leave focus.
  const z =
    -ad * 0.1 +
    focus * 0.14 +
    Math.sin(index * 0.9) * config.depthWave * 0.22 +
    hover * 0.045
  const y = -ad * 0.012 + Math.sin(index * 1.7) * 0.006 + focus * 0.015 + hover * 0.022

  return {
    position: [x, y, z],
    rotation: [
      // Slight backward tilt at focus, as if lifted off the shelf.
      focus * 0.03,
      lerp(COVER_FORWARD_Y, SPINE_FORWARD_Y, turn),
      // A hair of roll, signed by side, keeps the row from reading as a rail.
      Math.sign(d) * turn * 0.015,
    ],
    scale: lerp(1, 0.94, smoothstep(ad / 3)) + focus * 0.03 + hover * 0.015,
    opacity: 1 - smoothstep(invLerp(config.visibleRadius - 1.4, config.visibleRadius, ad)),
  }
}

/** Where the selected book sits once the detail state is fully committed. */
export function detailTransform(config: SceneConfig): BookTransform {
  return {
    position: config.detailBookPosition,
    rotation: [DETAIL_X, DETAIL_Y, 0],
    scale: config.detailBookScale,
    opacity: 1,
  }
}

/**
 * Blend a book's shelf transform toward its detail (or dispersed) transform.
 *
 * `progress` is the single master transition scalar. The choreography beats are
 * sub-ranges of it, so staggering is achieved without independent timelines.
 */
export function resolveBookTransform({
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
}): BookTransform {
  const shelf = shelfTransform(index, focusIndex, config, isActive ? 0 : hover)
  if (progress <= 0.0001) return shelf

  if (isActive) {
    const detail = detailTransform(config)
    const moveP = smoothstep(invLerp(beat.bookMove, beat.settle, progress))
    const rotP = smoothstep(invLerp(beat.rotate, 1, progress))
    const scaleP = smoothstep(invLerp(beat.bookMove, beat.settle + 0.2, progress))

    return {
      position: [
        lerp(shelf.position[0], detail.position[0], moveP),
        lerp(shelf.position[1], detail.position[1], moveP),
        lerp(shelf.position[2], detail.position[2], moveP),
      ],
      rotation: [
        lerp(shelf.rotation[0], detail.rotation[0], rotP),
        lerp(shelf.rotation[1], detail.rotation[1], rotP),
        lerp(shelf.rotation[2], detail.rotation[2], rotP),
      ],
      scale: lerp(shelf.scale, detail.scale, scaleP),
      opacity: 1,
    }
  }

  // Non-selected books disperse outward and fade, clearing the frame.
  const dispP = smoothstep(invLerp(beat.disperse, 0.72, progress))
  const dir = Math.sign(index - focusIndex) || 1

  return {
    position: [
      shelf.position[0] + dir * config.disperse * dispP,
      shelf.position[1] - dispP * 0.12,
      shelf.position[2] - dispP * 0.9,
    ],
    rotation: [
      shelf.rotation[0],
      lerp(shelf.rotation[1], shelf.rotation[1] - dir * 0.5, dispP),
      shelf.rotation[2],
    ],
    scale: shelf.scale * lerp(1, 0.88, dispP),
    opacity: shelf.opacity * (1 - clamp(dispP * 1.15)),
  }
}
