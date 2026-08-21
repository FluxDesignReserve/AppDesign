import { useFrame } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type * as THREE from 'three'
import {
  emptyTransform,
  resolveBookTransform,
  type BookTransform,
} from '../../animations/bookAnimations'
import { books } from '../../data/books'
import { clamp, damp, dampSettle, dwellOnIntegers, lerp } from '../../lib/math'
import type { SceneConfig } from '../../lib/sceneConfig'
import { focusState, scrollState, transitionState, useSceneStore } from '../../lib/store'
import { Book3D } from './Book3D'

type Props = {
  config: SceneConfig
  onSelect: (slug: string) => void
  reducedMotion: boolean
  anisotropy: number
}

const LAST = books.length - 1

/**
 * The shelf.
 *
 * Every book's transform derives from ONE scalar — its signed distance from the
 * live focus index — blended toward the detail framing by ONE transition scalar.
 * There is no per-book timeline, so the scene cannot end up in an inconsistent
 * state regardless of scroll speed, direction reversals, or interrupted transitions.
 */
export function BookStack({ config, onSelect, reducedMotion, anisotropy }: Props) {
  const group = useRef<THREE.Group>(null)
  const hoveredRef = useRef<string | null>(null)
  const hoverAmounts = useRef<number[]>(books.map(() => 0))
  const focusRef = useRef(0)

  // Stable, mutable target per book. Book3D reads these in its own useFrame, and
  // they are written in place so the hot path allocates nothing.
  const targets = useMemo(
    () =>
      books.map(() => ({ current: emptyTransform() }) as React.RefObject<BookTransform>),
    [],
  )

  // Hand the caption back to raw scroll if the scene goes away (context loss).
  useEffect(() => () => {
    focusState.driven = false
  }, [])

  const onHoverChange = useCallback((slug: string | null) => {
    if (slug) hoveredRef.current = slug
    else if (hoveredRef.current) hoveredRef.current = null
  }, [])

  // priority -1: targets are resolved before any book consumes them this frame.
  useFrame((_, delta) => {
    // Capped only to survive a backgrounded tab; exponential damping is
    // unconditionally stable, and a tighter cap would make the scene lag scroll
    // on slow frames.
    const dt = Math.min(delta, 0.1)
    const store = useSceneStore.getState()
    const p = clamp(transitionState.progress)

    // Focus blends from the scroll-driven position to the selected book, so
    // committing to a book also glides the shelf onto it.
    const scrollFocus = dwellOnIntegers(scrollState.progress * LAST, config.focusEase)
    const activeIndex = store.activeSlug
      ? books.findIndex((b) => b.slug === store.activeSlug)
      : -1
    const targetFocus = activeIndex >= 0 ? lerp(scrollFocus, activeIndex, p) : scrollFocus

    focusRef.current = reducedMotion
      ? targetFocus
      : damp(focusRef.current, targetFocus, 12, dt)

    /**
     * While the hero is on screen the shelf steps aside so the books never sit
     * under the hero type. It eases back to the origin as the hero scrolls away,
     * and is cancelled entirely once a book is being opened.
     */
    const heroFactor =
      clamp(1 - scrollState.scrollY / Math.max(window.innerHeight * 0.85, 1)) * (1 - p)
    const g = group.current
    if (g) {
      const [hx, hy, hz] = config.heroOffset
      const lambda = reducedMotion ? 40 : 4.5
      g.position.set(
        dampSettle(g.position.x, hx * heroFactor, lambda, dt),
        dampSettle(g.position.y, hy * heroFactor, lambda, dt),
        dampSettle(g.position.z, hz * heroFactor, lambda, dt),
      )
    }

    const focus = focusRef.current
    focusState.value = focus
    focusState.driven = true
    const hovered = hoveredRef.current

    for (let i = 0; i < books.length; i++) {
      const book = books[i]
      const isActive = activeIndex === i && p > 0.0001

      const hoverTarget = hovered === book.slug && p < 0.02 ? 1 : 0
      hoverAmounts.current[i] = reducedMotion
        ? hoverTarget
        : damp(hoverAmounts.current[i], hoverTarget, 9, dt)

      const t = resolveBookTransform(
        {
          index: i,
          focusIndex: focus,
          progress: p,
          isActive,
          config,
          hover: hoverAmounts.current[i],
        },
        targets[i].current,
      )

      // Cull far books, but never the selected one.
      if (!isActive && Math.abs(i - focus) > config.visibleRadius) t.opacity = 0
    }
  }, -1)

  return (
    <group ref={group} scale={config.shelfScale}>
      {books.map((book, i) => (
        <Book3D
          key={book.id}
          book={book}
          target={targets[i]}
          onSelect={onSelect}
          onHoverChange={onHoverChange}
          castShadow={config.shadows}
          reducedMotion={reducedMotion}
          anisotropy={anisotropy}
        />
      ))}
    </group>
  )
}
