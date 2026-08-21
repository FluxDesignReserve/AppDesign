import { RoundedBox } from '@react-three/drei'
import { memo } from 'react'
import * as THREE from 'three'
import { bookGeometry } from '../../lib/sceneConfig'

type Props = {
  height: number
  depth: number
  x: number
  boardMaterial: THREE.Material
  artMaterial: THREE.Material
  castShadow: boolean
}

/** The binding edge. Carries its own artwork, facing -x. */
export const BookSpine = memo(function BookSpine({
  height,
  depth,
  x,
  boardMaterial,
  artMaterial,
  castShadow,
}: Props) {
  const t = bookGeometry.coverThickness
  const radius = Math.min(bookGeometry.bevel, t * 0.45)
  const inset = bookGeometry.bevel * 1.5

  return (
    <group position={[x, 0, 0]}>
      <RoundedBox
        args={[t, height, depth]}
        radius={radius}
        smoothness={3}
        castShadow={castShadow}
        receiveShadow
        material={boardMaterial}
      />
      <mesh
        position={[-(t / 2 + 0.0004), 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        material={artMaterial}
      >
        <planeGeometry args={[depth - inset * 0.4, height - inset]} />
      </mesh>
    </group>
  )
})
