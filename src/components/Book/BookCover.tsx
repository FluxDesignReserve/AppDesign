import { RoundedBox } from '@react-three/drei'
import { memo } from 'react'
import * as THREE from 'three'
import { bookGeometry } from '../../lib/sceneConfig'

type Props = {
  width: number
  height: number
  z: number
  /** +1 for the front board (faces +z), -1 for the back board. */
  facing: 1 | -1
  boardMaterial: THREE.Material
  artMaterial: THREE.Material
  castShadow: boolean
}

/**
 * A cover board: a bevelled slab carrying its artwork on a separate coplanar face.
 *
 * Splitting board from artwork means the bevel catches light on the edges (so the
 * silhouette is not a hard CG rectangle) while the artwork keeps clean, undistorted
 * UVs at the correct aspect ratio.
 */
export const BookCover = memo(function BookCover({
  width,
  height,
  z,
  facing,
  boardMaterial,
  artMaterial,
  castShadow,
}: Props) {
  const t = bookGeometry.coverThickness
  const radius = Math.min(bookGeometry.bevel, t * 0.45)
  const inset = bookGeometry.bevel * 1.5

  return (
    <group position={[0, 0, z]}>
      <RoundedBox
        args={[width, height, t]}
        radius={radius}
        smoothness={3}
        castShadow={castShadow}
        receiveShadow
        material={boardMaterial}
      />
      <mesh
        position={[0, 0, facing * (t / 2 + 0.0004)]}
        rotation={[0, facing === 1 ? 0 : Math.PI, 0]}
        material={artMaterial}
      >
        <planeGeometry args={[width - inset, height - inset]} />
      </mesh>
    </group>
  )
})
