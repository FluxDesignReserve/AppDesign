import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { books } from '../../data/books'
import styles from './Navigation.module.css'

type Props = {
  onSelectBook: (slug: string) => void
  onJumpToSection: (id: string) => void
  activeSlug: string | null
  focusedIndex: number
}

/**
 * Navigation is a book index rather than a menu: selecting a title animates the 3D
 * scene into that book's state instead of jumping the page. There is no hamburger —
 * on small screens the index becomes a full-height sheet opened by a text control.
 */
export function Navigation({ onSelectBook, onJumpToSection, activeSlug, focusedIndex }: Props) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => setOpen(false), [location.pathname])

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        toggleRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const current = activeSlug ?? books[Math.round(focusedIndex)]?.slug

  return (
    <nav className={styles.nav} aria-label="Primary">
      <ul className={styles.sections}>
        <li>
          <button className={styles.sectionLink} onClick={() => onJumpToSection('film')}>
            Film
          </button>
        </li>
        <li>
          <button className={styles.sectionLink} onClick={() => onJumpToSection('podcast')}>
            Podcast
          </button>
        </li>
        <li>
          <button className={styles.sectionLink} onClick={() => onJumpToSection('newsletter')}>
            Newsletter
          </button>
        </li>
      </ul>

      <button
        ref={toggleRef}
        className={styles.indexToggle}
        aria-expanded={open}
        aria-controls="book-index"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Index</span>
        <span className={styles.count} aria-hidden="true">
          {books.length}
        </span>
      </button>

      {/* Backdrop: clicking away closes the index, as a sheet should. */}
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        id="book-index"
        ref={panelRef}
        className={`${styles.panel} ${open ? styles.panelOpen : ''}`}
        /* `inert` rather than `hidden` so the sheet can actually slide in, while
           still being unreachable by keyboard and assistive tech when closed. */
        inert={!open ? true : undefined}
      >
        <div className={styles.panelHead}>
          <p className={`eyebrow ${styles.panelTitle}`}>All books</p>
          <button
            className={styles.close}
            onClick={() => {
              setOpen(false)
              toggleRef.current?.focus()
            }}
          >
            Close
          </button>
        </div>
        <ul className={styles.list}>
          {books.map((book) => (
            <li key={book.id}>
              <button
                className={styles.item}
                aria-current={book.slug === current ? 'true' : undefined}
                onClick={() => onSelectBook(book.slug)}
              >
                <span className={styles.itemTitle}>{book.title}</span>
                <span className={styles.itemAuthor}>{book.author}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
