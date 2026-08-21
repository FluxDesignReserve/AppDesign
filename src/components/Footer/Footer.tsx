import { Link } from 'react-router-dom'
import { books } from '../../data/books'
import styles from './Footer.module.css'

const legal = [
  { label: 'Privacy', href: 'https://stripe.com/privacy' },
  { label: 'Terms', href: 'https://stripe.com/legal' },
  { label: 'Licenses', href: 'https://stripe.com/legal' },
]

const company = [
  { label: 'Stripe', href: 'https://stripe.com' },
  { label: 'Jobs', href: 'https://stripe.com/jobs' },
  { label: 'Contact', href: 'mailto:press@stripe.com' },
]

export function Footer() {
  return (
    <footer className={styles.footer} aria-labelledby="footer-heading">
      <div className="container">
        <hr className="rule" />
        <div className={styles.grid}>
          <div className={styles.about}>
            <h2 id="footer-heading" className={`subheading ${styles.title}`}>
              Stripe Press
            </h2>
            <p className={`body ${styles.blurb}`}>
              Stripe Press publishes books about technological and economic advancement —
              ideas for progress. Its books are about the people, institutions and
              inventions that expand what is possible.
            </p>
          </div>

          <nav className={styles.column} aria-label="Books">
            <p className="eyebrow">Books</p>
            <ul className={styles.list}>
              {books.slice(0, 6).map((book) => (
                <li key={book.id}>
                  <Link className={`link-muted ${styles.link}`} to={`/${book.slug}`}>
                    {book.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.column} aria-label="Company">
            <p className="eyebrow">Company</p>
            <ul className={styles.list}>
              {company.map((item) => (
                <li key={item.label}>
                  <a
                    className={`link-muted ${styles.link}`}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav className={styles.column} aria-label="Legal">
            <p className="eyebrow">Legal</p>
            <ul className={styles.list}>
              {legal.map((item) => (
                <li key={item.label}>
                  <a
                    className={`link-muted ${styles.link}`}
                    href={item.href}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className={styles.base}>
          <p className="meta">© {new Date().getFullYear()} Stripe, Inc.</p>
          <p className={`meta ${styles.disclaimer}`}>
            Replica built for study. Not affiliated with Stripe. Long-form copy and cover
            artwork are placeholders.
          </p>
        </div>
      </div>
    </footer>
  )
}
