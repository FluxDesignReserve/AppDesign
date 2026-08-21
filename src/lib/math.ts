export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Inverse lerp, clamped. */
export const invLerp = (a: number, b: number, v: number) =>
  a === b ? 0 : clamp((v - a) / (b - a))

export const smoothstep = (t: number) => {
  const x = clamp(t)
  return x * x * (3 - 2 * x)
}

export const smootherstep = (t: number) => {
  const x = clamp(t)
  return x * x * x * (x * (x * 6 - 15) + 10)
}

/**
 * Frame-rate independent damping. This is used for ALL continuous scene motion —
 * direct assignment is never used for animated state, so fast scroll flicks converge
 * smoothly instead of snapping.
 *
 * `lambda` is a rate: higher = snappier. dt in seconds.
 */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  lerp(current, target, 1 - Math.exp(-lambda * Math.max(dt, 0)))

/** Damp that snaps once within epsilon, so we can stop re-rendering. */
export const dampSettle = (
  current: number,
  target: number,
  lambda: number,
  dt: number,
  epsilon = 0.0001,
) => {
  const next = damp(current, target, lambda, dt)
  return Math.abs(target - next) < epsilon ? target : next
}

export const mapRange = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
) => lerp(outMin, outMax, invLerp(inMin, inMax, v))

/**
 * Reshape a continuous index so it dwells on whole numbers.
 *
 * The integer part is untouched and the fractional part is passed through a
 * symmetric power ease, so the mapping stays continuous and monotonic — items rest
 * in place without ever snapping. `sharpness` 1 is linear (no dwell); higher values
 * spend proportionally less of the travel between items and more parked on one.
 *
 * At sharpness 4 roughly a quarter of the travel is spent in transition, versus
 * about seventy per cent when linear.
 */
export const dwellOnIntegers = (value: number, sharpness: number) => {
  if (sharpness <= 1) return value
  const base = Math.floor(value)
  const t = value - base
  const eased =
    t < 0.5 ? 0.5 * Math.pow(2 * t, sharpness) : 1 - 0.5 * Math.pow(2 * (1 - t), sharpness)
  return base + eased
}
