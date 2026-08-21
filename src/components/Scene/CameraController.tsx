import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { resolveCameraState } from '../../animations/cameraAnimations'
import { clamp, dampSettle } from '../../lib/math'
import { damping, type SceneConfig } from '../../lib/sceneConfig'
import { transitionState } from '../../lib/store'

type Props = {
  config: SceneConfig
  pointer: React.RefObject<{ x: number; y: number }>
  reducedMotion: boolean
}

/**
 * The only owner of the camera. Named framings live in sceneConfig; this component
 * interpolates between them and damps position, target and FOV independently, so the
 * camera reads as a physical body moving around the shelf rather than a cut.
 */
export function CameraController({ config, pointer, reducedMotion }: Props) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const target = useRef(new THREE.Vector3(0, 0, 0))
  const initialised = useRef(false)

  useFrame((_, delta) => {
    // Capped only to survive a backgrounded tab; exponential damping is
    // unconditionally stable, and a tighter cap would make the scene lag scroll
    // on slow frames.
    const dt = Math.min(delta, 0.1)
    const p = clamp(transitionState.progress)
    const next = resolveCameraState(p, config, pointer.current, reducedMotion ? 0 : 1)

    const posL = reducedMotion ? damping.reduced : damping.cameraPosition
    const tgtL = reducedMotion ? damping.reduced : damping.cameraTarget
    const fovL = reducedMotion ? damping.reduced : damping.fov

    if (!initialised.current) {
      // Cold start (including a deep link) seeds the framing directly — no fly-in.
      initialised.current = true
      camera.position.set(...next.position)
      target.current.set(...next.target)
      camera.fov = next.fov
      camera.updateProjectionMatrix()
      camera.lookAt(target.current)
      return
    }

    camera.position.set(
      dampSettle(camera.position.x, next.position[0], posL, dt),
      dampSettle(camera.position.y, next.position[1], posL, dt),
      dampSettle(camera.position.z, next.position[2], posL, dt),
    )
    target.current.set(
      dampSettle(target.current.x, next.target[0], tgtL, dt),
      dampSettle(target.current.y, next.target[1], tgtL, dt),
      dampSettle(target.current.z, next.target[2], tgtL, dt),
    )

    const nextFov = dampSettle(camera.fov, next.fov, fovL, dt)
    if (nextFov !== camera.fov) {
      camera.fov = nextFov
      camera.updateProjectionMatrix()
    }
    camera.lookAt(target.current)
  })

  return null
}
