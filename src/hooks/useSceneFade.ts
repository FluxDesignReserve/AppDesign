import { useEffect } from 'react'
import { clamp } from '../lib/math'

/**
 * Fades the 3D scene out once the shelf range has been scrolled past, so the books
 * do not float behind the editorial sections. Written straight to a CSS custom
 * property from rAF — no React state, no re-renders.
 */
export function useSceneFade(rangeRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = document.documentElement
    if (!enabled) {
      root.style.setProperty('--scene-opacity', '1')
      return
    }

    let raf = 0
    let last = -1
    const tick = () => {
      const el = rangeRef.current
      if (el) {
        const end = el.offsetTop + el.offsetHeight
        const past = window.scrollY + window.innerHeight - end
        const opacity = clamp(1 - past / (window.innerHeight * 0.55))
        if (Math.abs(opacity - last) > 0.005) {
          last = opacity
          root.style.setProperty('--scene-opacity', opacity.toFixed(3))
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      root.style.setProperty('--scene-opacity', '1')
    }
  }, [rangeRef, enabled])
}
