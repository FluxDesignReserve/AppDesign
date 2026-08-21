import gsap from 'gsap'
import { transitionState, useSceneStore } from '../lib/store'
import { motion, reducedMotion } from './motion'

/**
 * Every state change drives ONE tween on ONE scalar (`transitionState.progress`).
 * Starting a new transition kills the previous tween on the same target, so competing
 * timelines are structurally impossible and the scene always converges — including
 * when the user reverses direction mid-animation.
 */

let current: gsap.core.Tween | null = null

function tweenTo(to: number, duration: number, ease: string, onComplete?: () => void) {
  current?.kill()
  const store = useSceneStore.getState()
  const spec = store.reducedMotion
    ? { duration: reducedMotion.duration, ease: reducedMotion.ease }
    : { duration, ease }

  // Scale duration by remaining distance so an interrupted transition doesn't
  // restart at full length.
  const remaining = Math.abs(to - transitionState.progress)
  current = gsap.to(transitionState, {
    progress: to,
    duration: spec.duration * Math.max(remaining, 0.25),
    ease: spec.ease,
    overwrite: 'auto',
    onComplete,
  })
  return current
}

/** Shelf → detail. */
export function animateBookToDetail(slug: string) {
  const store = useSceneStore.getState()
  store.setActive(slug)
  store.setSceneState('transitioning')
  return tweenTo(1, motion.shelfToDetail.duration, motion.shelfToDetail.ease, () =>
    useSceneStore.getState().setSceneState('detail'),
  )
}

/** Detail → shelf. The book is carried back; it is never unmounted. */
export function animateBookToShelf() {
  const store = useSceneStore.getState()
  store.setSceneState('returning')
  return tweenTo(0, motion.detailToShelf.duration, motion.detailToShelf.ease, () => {
    const s = useSceneStore.getState()
    s.setActive(null)
    s.setSceneState('shelf')
  })
}

/**
 * Detail → detail. Progress stays at 1; only the active book changes, so the outgoing
 * book physically travels back to the shelf while the incoming one travels out of it.
 * Nothing cross-fades.
 */
export function animateBookToNext(slug: string) {
  const store = useSceneStore.getState()
  store.setActive(slug)
  store.setSceneState('transitioning')
  current?.kill()
  const spec = store.reducedMotion ? reducedMotion : motion.bookTransition
  // Dip the master scalar so the books briefly re-enter the shelf frame in transit.
  current = gsap.to(transitionState, {
    keyframes: [
      { progress: 0.62, duration: spec.duration * 0.45, ease: 'power2.in' },
      { progress: 1, duration: spec.duration * 0.55, ease: 'power2.out' },
    ],
    overwrite: 'auto',
    onComplete: () => useSceneStore.getState().setSceneState('detail'),
  })
  return current
}

/** Seed the scene straight into a state with no animation (deep links, cold load). */
export function snapTo(state: 'shelf' | 'detail', slug: string | null) {
  current?.kill()
  const store = useSceneStore.getState()
  transitionState.progress = state === 'detail' ? 1 : 0
  store.setActive(slug)
  store.setSceneState(state)
}

export function killTransition() {
  current?.kill()
  current = null
}
