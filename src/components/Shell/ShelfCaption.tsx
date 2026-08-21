import { useFocusedBook } from '../../hooks/useFocusedBook'
import { books } from '../../data/books'
import styles from './ShelfCaption.module.css'

type Props = { onSelect: (slug: string) => void; hidden: boolean }

/**
 * The caption under the shelf. Text swaps as the scroll brings a new book into
 * focus — the reveal is keyed on the book identity so lines re-enter rather than
 * cross-fading in place.
 */
export function ShelfCaption({ onSelect, hidden }: Props) {
  const { index, book } = useFocusedBook()
  if (!book) return null

  return (
    <div className={`${styles.caption} ${hidden ? styles.hidden : ''}`}
      aria-hidden={hidden}
      inert={hidden ? true : undefined}>
      <div key={book.id} className={styles.stack}>
        <p className={`meta ${styles.position}`}>
          <span className={styles.num}>{String(index + 1).padStart(2, '0')}</span>
          <span className={styles.rule} aria-hidden="true" />
          <span className={styles.total}>{String(books.length).padStart(2, '0')}</span>
        </p>
        <h2 className={styles.title}>{book.title}</h2>
        <p className={styles.author}>{book.author}</p>
        <button className={styles.open} onClick={() => onSelect(book.slug)}>
          Open book
        </button>
      </div>
    </div>
  )
}
