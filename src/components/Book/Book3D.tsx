import { useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { BookTransform } from '../../animations/bookAnimations'
import type { Book } from '../../data/books'
import { dampSettle } from '../../lib/math'
import { bookGeometry, damping, depthForPages } from '../../lib/sceneConfig'
import { getBookTextures } from '../../textures/bookTextures'
import { BookCover } from './BookCover'
import { BookPages } from './BookPages'
import { BookSpine } from './BookSpine'

type Props = {
  book: Book
  /** Target transform, recomputed each frame by the stack. */
  target: React.RefObject<BookTransform>
  onSelect: (slug: string) => void
  onHoverChange: (slug: string | null) => void
  castShadow: boolean
  reducedMotion: boolean
  anisotropy: number
}

/**
 * One book — an independently addressable 3D object with a persistent identity.
 * It is never unmounted across state transitions; it is physically carried between
 * the shelf and the detail framing.
 *
 * All motion is damped toward the target rather than assigned, so the object
 * converges correctly no matter how the user scrolls or how many state changes
 * interrupt each other.
 */
export const Book3D = memo(function Book3D({
  book,
  target,
  onSelect,
  onHoverChange,
  castShadow,
  reducedMotion,
  anisotropy,
}: Props) {
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  const depth = depthForPages(book.pageCount)
  const { width, height, coverThickness, coverOverhang } = bookGeometry

  const textures = useMemo(() => getBookTextures(book, anisotropy), [book, anisotropy])

  const materials = useMemo(() => {
    const boardColour = new THREE.Color(book.palette.spine ?? book.palette.base)

    // Matte litho stock with a faint sheen — never glossy plastic.
    const art = (map: THREE.Texture) =>
      new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.62,
        metalness: 0,
        clearcoat: 0.1,
        clearcoatRoughness: 0.55,
      })

    const capTexture = textures.pageEdge.clone()
    capTexture.center.set(0.5, 0.5)
    capTexture.rotation = Math.PI / 2
    capTexture.needsUpdate = true

    const page = (map: THREE.Texture) =>
      new THREE.MeshStandardMaterial({
        map,
        color: new THREE.Color('#e8e2d8'),
        roughness: 0.95,
        metalness: 0,
      })

    return {
      coverArt: art(textures.cover),
      backArt: art(textures.back),
      spineArt: art(textures.spine),
      board: new THREE.MeshPhysicalMaterial({
        color: boardColour,
        roughness: 0.7,
        metalness: 0,
        clearcoat: 0.08,
        clearcoatRoughness: 0.6,
      }),
      pageEdge: page(textures.pageEdge),
      pageCap: page(capTexture),
      pageHidden: new THREE.MeshStandardMaterial({ color: '#ded7cb', roughness: 0.98 }),
      capTexture,
    }
  }, [book, textures])

  // Dispose every material this book owns. Textures are cached and shared, so they
  // are released by disposeAllTextures() at teardown instead.
  useEffect(() => {
    return () => {
      materials.coverArt.dispose()
      materials.backArt.dispose()
      materials.spineArt.dispose()
      materials.board.dispose()
      materials.pageEdge.dispose()
      materials.pageCap.dispose()
      materials.pageHidden.dispose()
      materials.capTexture.dispose()
    }
  }, [materials])

  useEffect(() => {
    onHoverChange(hovered ? book.slug : null)
    document.body.style.cursor = hovered ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered, book.slug, onHoverChange])

  const opacityRef = useRef(1)

  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const t = target.current
    // Capped only to survive a backgrounded tab; exponential damping is
    // unconditionally stable, and a tighter cap would make the scene lag scroll
    // on slow frames.
    const dt = Math.min(delta, 0.1)

    const posL = reducedMotion ? damping.reduced : damping.bookPosition
    const rotL = reducedMotion ? damping.reduced : damping.bookRotation
    const sclL = reducedMotion ? damping.reduced : damping.bookScale

    g.position.set(
      dampSettle(g.position.x, t.position[0], posL, dt),
      dampSettle(g.position.y, t.position[1], posL, dt),
      dampSettle(g.position.z, t.position[2], posL, dt),
    )
    g.rotation.set(
      dampSettle(g.rotation.x, t.rotation[0], rotL, dt),
      dampSettle(g.rotation.y, t.rotation[1], rotL, dt),
      dampSettle(g.rotation.z, t.rotation[2], rotL, dt),
    )
    const s = dampSettle(g.scale.x, t.scale, sclL, dt)
    g.scale.setScalar(s)

    const nextOpacity = dampSettle(opacityRef.current, t.opacity, sclL, dt)
    if (nextOpacity !== opacityRef.current) {
      opacityRef.current = nextOpacity
      const transparent = nextOpacity < 0.999
      for (const m of [
        materials.coverArt,
        materials.backArt,
        materials.spineArt,
        materials.board,
        materials.pageEdge,
        materials.pageCap,
        materials.pageHidden,
      ]) {
        m.opacity = nextOpacity
        if (m.transparent !== transparent) {
          m.transparent = transparent
          m.needsUpdate = true
        }
        m.depthWrite = !transparent
      }
    }
    g.visible = nextOpacity > 0.01
  })

  const pageWidth = width - coverThickness - coverOverhang
  const pageHeight = height - coverOverhang * 2
  const pageDepth = Math.max(depth - coverThickness * 2, 0.01)
  const pageX = (coverThickness - coverOverhang) / 2

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(book.slug)
      }}
    >
      <BookPages
        width={pageWidth}
        height={pageHeight}
        depth={pageDepth}
        x={pageX}
        edgeMaterial={materials.pageEdge}
        capMaterial={materials.pageCap}
        hiddenMaterial={materials.pageHidden}
        castShadow={castShadow}
      />
      <BookCover
        width={width}
        height={height}
        z={depth / 2 - coverThickness / 2}
        facing={1}
        boardMaterial={materials.board}
        artMaterial={materials.coverArt}
        castShadow={castShadow}
      />
      <BookCover
        width={width}
        height={height}
        z={-depth / 2 + coverThickness / 2}
        facing={-1}
        boardMaterial={materials.board}
        artMaterial={materials.backArt}
        castShadow={castShadow}
      />
      <BookSpine
        height={height}
        depth={depth}
        x={-width / 2 + coverThickness / 2}
        boardMaterial={materials.board}
        artMaterial={materials.spineArt}
        castShadow={castShadow}
      />
    </group>
  )
})
