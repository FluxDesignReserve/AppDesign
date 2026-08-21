import { useEffect, useState } from 'react'
import { isLowPowerDevice } from '../lib/webgl'
import { sceneConfigs, type Breakpoint, type SceneConfig } from '../lib/sceneConfig'

export const BREAKPOINTS = { tablet: 768, desktop: 1024, wide: 1440 } as const

function currentBreakpoint(width: number): Breakpoint {
  if (width < BREAKPOINTS.tablet) return 'mobile'
  if (width < BREAKPOINTS.desktop) return 'tablet'
  return 'desktop'
}

/**
 * The 3D scene gets a dedicated per-breakpoint configuration — mobile is not a
 * scaled-down desktop. Also clamps DPR and drops shadows on low-power hardware.
 */
export function useResponsiveScene(): {
  breakpoint: Breakpoint
  config: SceneConfig
  lowPower: boolean
} {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window === 'undefined' ? 'desktop' : currentBreakpoint(window.innerWidth),
  )
  const [lowPower] = useState(() => isLowPowerDevice())

  useEffect(() => {
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setBreakpoint(currentBreakpoint(window.innerWidth)))
    }
    window.addEventListener('resize', onResize, { passive: true })
    onResize()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const base = sceneConfigs[breakpoint]
  const config: SceneConfig = lowPower
    ? { ...base, shadows: false, dpr: [1, Math.min(base.dpr[1], 1.5)] }
    : base

  return { breakpoint, config, lowPower }
}
