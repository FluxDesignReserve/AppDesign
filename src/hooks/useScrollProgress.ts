import Lenis from 'lenis'
import { useEffect, useRef } from 'react'
import { clamp } from '../lib/math'
import { scrollState, useSceneStore } from '../lib/store'

/**
 * The scroll engine. Lenis smooths the wheel/touch input, but native scrolling is
 * preserved — keyboard paging, anchor jumps and assistive tech all still work, and
 * Lenis is disabled outright under `prefers-reduced-motion`.
 *
 * Writes into the non-reactive `scrollState` singleton, so a scroll never triggers a
 * React re-render; `useFrame` consumers read it directly.
 */
/** Module-level handle so imperative scrolling can go through Lenis rather than
 *  fighting it with a raw window.scrollTo. */
let lenisInstance: Lenis | null = null

export function useScrollProgress(rangeRef: React.RefObject<HTMLElement | null>) {
  const lenisRef = useRef<Lenis | null>(null)
  const reduced = useSceneStore((s) => s.reducedMotion)

  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
      syncTouch: false,
    })
    lenisRef.current = lenis
    lenisInstance = lenis

    let raf = 0
    const loop = (time: number) => {
      lenis.raf(time)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
      lenisRef.current = null
      lenisInstance = null
    }
  }, [reduced])

  useEffect(() => {
    let lastY = window.scrollY
    let lastT = performance.now()

    const measure = () => {
      const el = rangeRef.current
      const y = window.scrollY
      const now = performance.now()
      const dt = Math.max(now - lastT, 1)

      scrollState.velocity = ((y - lastY) / dt) * 16.67
      scrollState.direction = y >= lastY ? 1 : -1
      scrollState.scrollY = y

      if (el) {
        const top = el.offsetTop
        const range = Math.max(el.offsetHeight - window.innerHeight, 1)
        scrollState.progress = clamp((y - top) / range)
      }

      lastY = y
      lastT = now
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure, { passive: true })
    return () => {
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [rangeRef])

  return lenisRef
}

function progressToY(rangeEl: HTMLElement, progress: number): number {
  const range = Math.max(rangeEl.offsetHeight - window.innerHeight, 1)
  return rangeEl.offsetTop + range * clamp(progress)
}

/** Imperative scroll used by navigation so selecting a title glides the shelf. */
export function scrollToProgress(rangeEl: HTMLElement | null, progress: number) {
  if (!rangeEl) return
  const y = progressToY(rangeEl, progress)
  if (lenisInstance) lenisInstance.scrollTo(y)
  else window.scrollTo({ top: y, behavior: 'smooth' })
}

/**
 * Scroll to a section. This must go through Lenis when it is running: Lenis owns the
 * scroll position, so a native `scrollIntoView` is immediately overridden and the
 * page appears not to move at all.
 */
export function scrollToElement(el: HTMLElement | null) {
  if (!el) return
  if (lenisInstance) lenisInstance.scrollTo(el, { offset: -24 })
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Instant reposition, used when returning from a book so the shelf is already at
 * that book's position and the return transition stays visually continuous.
 */
export function jumpToProgress(rangeEl: HTMLElement | null, progress: number) {
  if (!rangeEl) return
  const y = progressToY(rangeEl, progress)
  scrollState.progress = clamp(progress)
  if (lenisInstance) lenisInstance.scrollTo(y, { immediate: true })
  else window.scrollTo(0, y)
}
