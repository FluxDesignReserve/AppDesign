import { useEffect, useState } from 'react'
import { books } from '../data/books'
import { focusState, scrollState } from '../lib/store'

const LAST = books.length - 1

/**
 * Bridges the scene's focus signal back into React exactly once per *change of
 * book* — not once per frame. Scrolling therefore never re-renders the tree; only
 * crossing into a new book does.
 *
 * It reads the scene's own damped focus rather than raw scroll, so the caption can
 * never name a different book than the one actually centred on screen.
 */
export function useFocusedBook() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    let raf = 0
    let last = -1
    const tick = () => {
      const next = Math.round(
        focusState.driven ? focusState.value : scrollState.progress * LAST,
      )
      if (next !== last && next >= 0 && next <= LAST) {
        last = next
        setIndex(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return { index, book: books[index] }
}
