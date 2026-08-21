import { useCallback, useEffect, useRef, useState } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Brand } from './components/Brand/Brand'
import { Navigation } from './components/Navigation/Navigation'
import { BookScene } from './components/Scene/BookScene'
import { books, bookIndex, neighbours } from './data/books'
import { useBookTransition } from './hooks/useBookTransition'
import { useFocusedBook } from './hooks/useFocusedBook'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useResponsiveScene } from './hooks/useResponsiveScene'
import { useSceneFade } from './hooks/useSceneFade'
import { scrollToProgress, useScrollProgress } from './hooks/useScrollProgress'
import { useSceneStore } from './lib/store'
import { hasWebGL } from './lib/webgl'
import { BookPage } from './routes/BookPage'
import { Home } from './routes/Home'
import styles from './App.module.css'

const LAST = books.length - 1

export function App() {
  const location = useLocation()
  const rangeRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const { config } = useResponsiveScene()
  const { openBook, returnToShelf } = useBookTransition()
  const { index: focusedIndex, book: focusedBook } = useFocusedBook()

  const [supported] = useState(() => hasWebGL())
  const contextAlive = useSceneStore((s) => s.webglEnabled)
  const activeSlug = useSceneStore((s) => s.activeSlug)
  const sceneState = useSceneStore((s) => s.sceneState)
  const webglEnabled = supported && contextAlive

  const isHome = location.pathname === '/'

  useScrollProgress(rangeRef)
  useSceneFade(rangeRef, isHome)

  const selectBook = useCallback(
    (slug: string) => {
      useSceneStore.getState().setFocusIndex(bookIndex(slug))
      openBook(slug)
    },
    [openBook],
  )

  const jumpToSection = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  /** Keyboard model: arrows travel the shelf or the catalogue, Escape returns. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return

      const active = useSceneStore.getState().activeSlug

      if (e.key === 'Escape' && active) {
        e.preventDefault()
        returnToShelf()
        return
      }

      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const forward = e.key === 'ArrowRight'

      if (active) {
        const { previous, next } = neighbours(active)
        const destination = forward ? next : previous
        if (destination) {
          e.preventDefault()
          selectBook(destination.slug)
        }
        return
      }

      if (isHome && rangeRef.current) {
        e.preventDefault()
        const next = Math.min(Math.max(focusedIndex + (forward ? 1 : -1), 0), LAST)
        scrollToProgress(rangeRef.current, next / LAST)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusedIndex, isHome, returnToShelf, selectBook])

  const announcement = activeSlug
    ? `${books.find((b) => b.slug === activeSlug)?.title ?? ''}, book detail open.`
    : focusedBook
      ? `${focusedBook.title} by ${focusedBook.author}, book ${focusedIndex + 1} of ${books.length}.`
      : ''

  return (
    <div className={styles.app} data-scene-state={sceneState}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {webglEnabled && (
        <BookScene config={config} onSelect={selectBook} reducedMotion={reducedMotion} />
      )}

      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Brand compact={!isHome} />
          <Navigation
            onSelectBook={selectBook}
            onJumpToSection={jumpToSection}
            activeSlug={activeSlug}
            focusedIndex={focusedIndex}
          />
        </div>
      </header>

      <main id="main" className={styles.main}>
        <h2 className="visually-hidden">Stripe Press books</h2>
        <p className="visually-hidden">
          The shelf is rendered in 3D. Every book is also reachable from the Index in the
          navigation, and each has its own page.
        </p>

        <Routes>
          <Route
            path="/"
            element={
              <Home
                rangeRef={rangeRef}
                onSelectBook={selectBook}
                webglEnabled={webglEnabled}
              />
            }
          />
          <Route path="/:slug" element={<BookPage onReturn={returnToShelf} />} />
        </Routes>
      </main>

      <div className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  )
}
