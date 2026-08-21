/** One-shot WebGL capability probe. Result is cached; the context is released. */
let cached: boolean | null = null

export function hasWebGL(): boolean {
  if (cached !== null) return cached
  if (typeof window === 'undefined') return (cached = false)
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    if (!gl) return (cached = false)
    const lose = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')
    lose?.loseContext()
    return (cached = true)
  } catch {
    return (cached = false)
  }
}

/** Coarse device-power estimate used to pick DPR / shadow budget. */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
  return cores <= 4 || mem <= 4 || (coarse && cores <= 6)
}
