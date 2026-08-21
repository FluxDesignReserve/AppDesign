import { memo } from 'react'
import type { SceneConfig } from '../../lib/sceneConfig'

type Props = { config: SceneConfig }

/**
 * Lighting rig.
 *
 * The rim light is the load-bearing one: it separates the book silhouette from the
 * warm-black background, which is what stops the books reading as flat primitives.
 * Only the key light casts, keeping the shadow budget to a single map.
 */
export const Lighting = memo(function Lighting({ config }: Props) {
  return (
    <>
      <ambientLight intensity={0.55} color="#fff4e8" />

      {/* Key — front upper left */}
      <directionalLight
        position={[-2.6, 3.2, 4.2]}
        intensity={1.7}
        color="#fff1de"
        castShadow={config.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />

      {/* Rim — behind right, cool, to carve the edge against the background */}
      <directionalLight position={[3.4, 1.6, -3.2]} intensity={0.9} color="#cfd8e8" />

      {/* Fill — keeps the page block from going muddy */}
      <pointLight position={[0.4, -1.4, 2.4]} intensity={0.35} color="#ffe9d2" distance={9} decay={2} />
    </>
  )
})
