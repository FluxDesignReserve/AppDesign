import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { animateBookToDetail, animateBookToNext, animateBookToShelf, snapTo } from '../animations/transitionTimelines'
import { bookIndex, bookBySlug } from '../data/books'
import { useSceneStore } from '../lib/store'

const slugFromPath = (pathname: string): string | null => {
  const slug = pathname.replace(/^\/+|\/+$/g, '')
  if (!slug) return null
  return bookBySlug(slug) ? slug : null
}

/**
 * Single point of synchronisation between the router and the scene state machine.
 *
 * The URL is the source of truth for *which* book is open; the store is the source of
 * truth for *how* the scene is currently rendering. Browser back/forward therefore
 * animates the scene rather than remounting it, and a deep link seeds the scene
 * directly into the detail framing with no visible fly-through.
 */
export function useBookTransition() {
  const location = useLocation()
  const navigate = useNavigate()
  const coldStart = useRef(true)

  useEffect(() => {
    const slug = slugFromPath(location.pathname)
    const store = useSceneStore.getState()

    if (coldStart.current) {
      coldStart.current = false
      if (slug) {
        store.setFocusIndex(bookIndex(slug))
        snapTo('detail', slug)
      } else {
        snapTo('shelf', null)
      }
      return
    }

    if (slug === store.activeSlug) return

    if (slug) {
      store.setFocusIndex(bookIndex(slug))
      // Detail → detail keeps the objects continuous; shelf → detail runs the
      // full choreography.
      if (store.activeSlug && (store.sceneState === 'detail' || store.sceneState === 'transitioning')) {
        animateBookToNext(slug)
      } else {
        animateBookToDetail(slug)
      }
    } else {
      animateBookToShelf()
    }
  }, [location.pathname])

  return {
    openBook: (slug: string) => navigate(`/${slug}`),
    returnToShelf: () => navigate('/'),
  }
}
