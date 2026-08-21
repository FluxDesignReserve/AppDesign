import { invLerp, lerp, smoothstep } from '../lib/math'
import type { CameraState, SceneConfig, Vec3 } from '../lib/sceneConfig'
import { beat } from './motion'

const mixVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
]

/**
 * The camera has exactly one owner. Named states are declared in sceneConfig and
 * interpolated here; nothing else in the app is allowed to touch the camera.
 */
export function resolveCameraState(
  progress: number,
  config: SceneConfig,
  pointer: { x: number; y: number },
  parallax = 1,
): CameraState {
  const t = smoothstep(invLerp(beat.camera, 1, progress))
  const shelf = config.camera.shelf
  const detail = config.camera.detail

  const position = mixVec(shelf.position, detail.position, t)
  const target = mixVec(shelf.target, detail.target, t)

  // Restrained pointer parallax — the camera drifts, it does not swing.
  const drift = (1 - t * 0.65) * parallax
  position[0] += pointer.x * 0.16 * drift
  position[1] += pointer.y * 0.09 * drift

  return {
    position,
    target,
    fov: lerp(shelf.fov, detail.fov, t),
  }
}
