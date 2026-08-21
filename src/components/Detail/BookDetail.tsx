import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Book } from '../../data/books'
import { neighbours } from '../../data/books'
import { Author } from './Author'
import { Praise } from './Praise'
import styles from './Detail.module.css'

type Props = {
  book: Book
  onReturn: () => void
}

/**
 * The detail panel. It coexists with the 3D book rather than replacing it — the
 * book itself is still the object on screen, carried here by the scene.
 */
export function BookDetail({ book, onReturn }: Props) {
  const { previous, next } = neighbours(book.slug)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the new title on navigation so keyboard and screen-reader users
  // land in the right place instead of at the top of the document.
  useEffect(() => {
    headingRef.current?.focus()
  }, [book.slug])

  return (
    <article className={styles.detail} aria-labelledby="detail-title">
      <div className={styles.panel}>
        <button className={styles.return} onClick={onReturn}>
          <span aria-hidden="true" className={styles.returnArrow}>
            ←
          </span>
          Return to shelf
        </button>

        <header className={styles.header}>
          <h1
            id="detail-title"
            ref={headingRef}
            tabIndex={-1}
            className={`display ${styles.title}`}
          >
            {book.title}
          </h1>
          {book.subtitle && <p className={`body-lg ${styles.subtitle}`}>{book.subtitle}</p>}
          <p className={`meta ${styles.byline}`}>
            {book.author}
            {book.year ? ` · ${book.year}` : ''}
            {` · ${book.pageCount} pages`}
            {book.price ? ` · ${book.price}` : ''}
          </p>
        </header>

        <div className={styles.block}>
          <p className={`body ${styles.blockBody}`}>{book.description}</p>
          {book.isPlaceholder && (
            <p className={styles.placeholder}>
              Placeholder copy — reference text was not retrievable in this environment.
            </p>
          )}
        </div>

        {book.purchaseLinks?.length ? (
          <section className={styles.block} aria-labelledby="buy-heading">
            <p className="eyebrow" id="buy-heading">
              Where to buy
            </p>
            <ul className={styles.buyList}>
              {book.purchaseLinks.map((link) => (
                <li key={link.href}>
                  <a
                    className={`link ${styles.buyLink}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <Author name={book.author} bio={book.authorBio} isPlaceholder={book.isPlaceholder} />
        <Praise items={book.praise} isPlaceholder={book.isPlaceholder} />

        <nav className={styles.pager} aria-label="Books">
          {previous ? (
            <Link className={styles.pagerLink} to={`/${previous.slug}`} rel="prev">
              <span className="eyebrow">Previous</span>
              <span className={styles.pagerTitle}>{previous.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link className={`${styles.pagerLink} ${styles.pagerNext}`} to={`/${next.slug}`} rel="next">
              <span className="eyebrow">Next</span>
              <span className={styles.pagerTitle}>{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </article>
  )
}
