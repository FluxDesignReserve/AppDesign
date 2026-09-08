# CLAUDE.md

Interactive Stripe Press replica: React 19 + Vite, `@react-three/fiber` scene, GSAP
choreography, Lenis scroll. Read `docs/SPEC.md` before changing behaviour — it records
the provenance of every value, and entries marked **[D]** are design decisions rather
than observed fact.

## Commands

| Task | Command |
|---|---|
| Install deps | `npm install` (run automatically by the SessionStart hook) |
| Typecheck (the lint gate) | `npm run typecheck` |
| Production build | `npm run build` (runs `tsc --noEmit` first) |
| Dev server | `npm run dev` — http://127.0.0.1:5173 |
| Preview build | `npm run preview` — http://127.0.0.1:4173 |
| Full QA suite | `npm run shots` |
| Fast QA subset | `npm run quickshots` |
| Single-file bundle | `npm run build:single` |

There is no unit-test framework. The verification gates are `npm run typecheck` and the
Playwright QA scripts, which exit non-zero on any console error, page exception or
failed assertion.

## QA workflow

QA runs against the **production build**, never the dev server — HMR reloads destroy the
page context mid-run:

```bash
npm run build
npm run preview &   # 127.0.0.1:4173
npm run quickshots  # or: npm run shots
```

Output lands in `qa/`, which is gitignored. Chromium is pre-installed in the remote
environment; never run `playwright install`.

## Conventions

- No timing, easing, colour or camera value is written inline in a component. Tune
  `src/styles/tokens.css`, `src/lib/sceneConfig.ts` and `src/animations/motion.ts`.
- Every book transform derives from one signed distance to a single live focus index,
  blended by a single transition scalar. Do not add per-book timelines.
- Continuous motion uses frame-rate-independent damping (`damp` / `dampSettle` in
  `src/lib/math.ts`), never fixed-duration assignment.
- Scroll and pointer write to non-reactive singletons (`scrollState`, `focusState`,
  `transitionState`) read directly in `useFrame`. Scroll must never re-render React.
- Keep the fallbacks intact: `NoWebGLShelf` for lost/absent WebGL, and the
  `prefers-reduced-motion` path. Neither may change the information architecture.
- Placeholder copy (descriptions, praise, author bios) is deliberately marked as such —
  do not replace it with invented quotes, prices or biographies attributed to real people.
