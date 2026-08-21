import { Link } from 'react-router-dom'
import { books } from '../../data/books'
import { getBookImages } from '../../textures/bookImages'
import styles from './NoWebGLShelf.module.css'

/**
 * WebGL fallback. The same generated artwork is rendered as flat images, and the
 * full information architecture — every title, author, route and link — is
 * preserved. A blank canvas is never shown.
 */
export function NoWebGLShelf() {
  return (
    <section className={styles.shelf} aria-labelledby="fallback-heading">
      <div className="container">
        <p className="eyebrow">The shelf</p>
        <h2 id="fallback-heading" className={`heading ${styles.heading}`}>
          {books.length} books
        </h2>
        <p className={`body ${styles.note}`}>
          Your browser could not start WebGL, so the shelf is shown as flat covers.
          Everything else works exactly as it does in the 3D view.
        </p>

        <ul className={styles.grid}>
          {books.map((book) => {
            const images = getBookImages(book)
            return (
              <li key={book.id} className={styles.item}>
                <Link className={styles.link} to={`/${book.slug}`}>
                  {images.cover ? (
                    <img
                      className={styles.cover}
                      src={images.cover}
                      alt={`Cover of ${book.title} by ${book.author}`}
                      loading="lazy"
                      width={512}
                      height={776}
                    />
                  ) : (
                    /* Last-resort tile: no canvas, no artwork — still never blank. */
                    <span
                      className={`${styles.cover} ${styles.tile}`}
                      style={{ background: book.palette.base, color: book.palette.ink }}
                    >
                      <span className={styles.tileTitle}>{book.title}</span>
                    </span>
                  )}
                  <span className={styles.title}>{book.title}</span>
                  <span className={styles.author}>{book.author}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
