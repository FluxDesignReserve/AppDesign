import { Link } from 'react-router-dom'
import styles from './Brand.module.css'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={styles.brand} aria-label="Stripe Press — home">
      <span className={styles.mark} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
          <path
            d="M3 4.2h13.2c2.6 0 4.4 1.5 4.4 3.7 0 1.7-1 3-2.7 3.5 2 .4 3.1 1.8 3.1 3.7 0 2.4-1.9 4.1-4.8 4.1H3z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={styles.wordmark}>Stripe Press</span>
      {!compact && <span className={styles.tag}>Ideas for progress</span>}
    </Link>
  )
}
