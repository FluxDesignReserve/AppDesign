import { memo, useMemo } from 'react'
import * as THREE from 'three'

type Props = {
  width: number
  height: number
  depth: number
  x: number
  /** Fore-edge material — leaf lines repeat across the book's thickness. */
  edgeMaterial: THREE.Material
  /** Head/tail material — same texture, rotated a quarter turn. */
  capMaterial: THREE.Material
  /** Faces buried under the boards; never seen, so they stay untextured. */
  hiddenMaterial: THREE.Material
  castShadow: boolean
}

/**
 * The page block: an off-white, high-roughness box inset behind the cover boards.
 * Box material index order is [+x, -x, +y, -y, +z, -z].
 */
export const BookPages = memo(function BookPages({
  width,
  height,
  depth,
  x,
  edgeMaterial,
  capMaterial,
  hiddenMaterial,
  castShadow,
}: Props) {
  const materials = useMemo(
    () => [edgeMaterial, hiddenMaterial, capMaterial, capMaterial, hiddenMaterial, hiddenMaterial],
    [edgeMaterial, capMaterial, hiddenMaterial],
  )

  return (
    <mesh position={[x, 0, 0]} material={materials} castShadow={castShadow} receiveShadow>
      <boxGeometry args={[width, height, depth]} />
    </mesh>
  )
})
