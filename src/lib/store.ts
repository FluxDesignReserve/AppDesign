import { create } from 'zustand'

export type SceneState = 'shelf' | 'transitioning' | 'detail' | 'returning'

/**
 * Non-reactive scene signals. These change every frame, so they deliberately live
 * OUTSIDE React — `useFrame` reads them directly and nothing re-renders.
 */
export const scrollState = {
  scrollY: 0,
  /** Normalized 0..1 across the shelf's scroll range. */
  progress: 0,
  velocity: 0,
  direction: 1 as 1 | -1,
}

export const transitionState = {
  /** 0 = fully shelf, 1 = fully detail. Driven by a single GSAP tween. */
  progress: 0,
}

/**
 * The live, damped focus index — written by the scene each frame and read by the
 * caption. Sharing one value is what keeps the caption from ever naming a different
 * book than the one actually centred (they would otherwise drift apart during a
 * fast flick, since the scene damps and raw scroll does not).
 *
 * `driven` stays false when the 3D scene is not running, so the caption falls back
 * to raw scroll progress in the WebGL fallback.
 */
export const focusState = {
  value: 0,
  driven: false,
}

type Store = {
  sceneState: SceneState
  activeSlug: string | null
  previousSlug: string | null
  /** Focus index the shelf should settle on, in book units. */
  focusIndex: number
  reducedMotion: boolean
  webglEnabled: boolean

  setSceneState: (s: SceneState) => void
  setActive: (slug: string | null) => void
  setFocusIndex: (i: number) => void
  setReducedMotion: (v: boolean) => void
  setWebglEnabled: (v: boolean) => void
}

export const useSceneStore = create<Store>((set, get) => ({
  sceneState: 'shelf',
  activeSlug: null,
  previousSlug: null,
  focusIndex: 0,
  reducedMotion: false,
  webglEnabled: true,

  setSceneState: (s) => {
    if (get().sceneState !== s) set({ sceneState: s })
  },
  setActive: (slug) => {
    const prev = get().activeSlug
    if (prev === slug) return
    set({ activeSlug: slug, previousSlug: prev })
  },
  setFocusIndex: (i) => {
    if (get().focusIndex !== i) set({ focusIndex: i })
  },
  setReducedMotion: (v) => set({ reducedMotion: v }),
  setWebglEnabled: (v) => set({ webglEnabled: v }),
}))

/** Imperative read for use inside useFrame (no subscription, no re-render). */
export const sceneSnapshot = () => useSceneStore.getState()
