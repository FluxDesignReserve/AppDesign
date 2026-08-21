import { useLayoutEffect, useState } from 'react'
import { books } from '../data/books'
import { jumpToProgress } from '../hooks/useScrollProgress'
import { useSceneStore } from '../lib/store'
import { FilmSection } from '../components/Film/Film'
import { Footer } from '../components/Footer/Footer'
import { Newsletter } from '../components/Newsletter/Newsletter'
import { PodcastSection } from '../components/Podcast/Podcast'
import { NoWebGLShelf } from '../components/Shell/NoWebGLShelf'
import { ShelfCaption } from '../components/Shell/ShelfCaption'
import styles from './Home.module.css'

type Props = {
  rangeRef: React.RefObject<HTMLDivElement | null>
  onSelectBook: (slug: string) => void
  webglEnabled: boolean
}

const LAST = books.length - 1

export function Home({ rangeRef, onSelectBook, webglEnabled }: Props) {
  const [captionHidden, setCaptionHidden] = useState(true)

  /**
   * Returning from a book lands the shelf on the book you were reading, so the
   * books re-stack around it instead of snapping back to the start.
   */
  useLayoutEffect(() => {
    const { focusIndex } = useSceneStore.getState()
    if (focusIndex > 0 && rangeRef.current) {
      jumpToProgress(rangeRef.current, focusIndex / LAST)
    }
  }, [rangeRef])

  /**
   * The caption belongs to the shelf, so it appears once the hero is scrolled past
   * and leaves again as the shelf range ends — otherwise it would stay pinned over
   * the editorial sections and footer.
   */
  useLayoutEffect(() => {
    const onScroll = () => {
      const el = rangeRef.current
      const beforeShelf = window.scrollY < window.innerHeight * 0.5
      const pastShelf = el
        ? window.scrollY + window.innerHeight >
          el.offsetTop + el.offsetHeight - window.innerHeight * 0.25
        : false
      setCaptionHidden(beforeShelf || pastShelf)
      useSceneStore.getState().setOverContent(pastShelf)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      useSceneStore.getState().setOverContent(false)
    }
  }, [rangeRef])

  return (
    <>
      {/* Without WebGL there is no shelf to travel along, so the scroll range
          collapses to the hero and the static shelf follows immediately —
          otherwise the viewport would open on a screen of empty space. */}
      <div
        ref={rangeRef}
        className={`${styles.range} ${webglEnabled ? '' : styles.rangeStatic}`}
        style={{ ['--book-count' as string]: books.length }}
      >
        <section className={styles.hero} aria-labelledby="hero-heading">
          <div className="container">
            <h1 id="hero-heading" className={`display ${styles.heroTitle}`}>
              Ideas for progress
            </h1>
            <p className={`body-lg ${styles.heroBody}`}>
              Books about technological and economic advancement — the people,
              institutions, and inventions that expand what is possible.
            </p>
            <p className={`meta ${styles.heroHint}`} aria-hidden="true">
              Scroll
            </p>
          </div>
        </section>
      </div>

      {webglEnabled ? (
        <ShelfCaption onSelect={onSelectBook} hidden={captionHidden} />
      ) : (
        <NoWebGLShelf />
      )}

      <div className={styles.editorial}>
        <FilmSection />
        <PodcastSection />
        <Newsletter />
        <Footer />
      </div>
    </>
  )
}
