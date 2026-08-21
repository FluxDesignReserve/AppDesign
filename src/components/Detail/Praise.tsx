import type { Praise as PraiseType } from '../../data/books'
import styles from './Detail.module.css'

export function Praise({
  items,
  isPlaceholder,
}: {
  items?: PraiseType[]
  isPlaceholder?: boolean
}) {
  if (!items?.length) return null
  return (
    <section className={styles.block} aria-labelledby="praise-heading">
      <p className="eyebrow" id="praise-heading">
        Praise
      </p>
      <ul className={styles.praiseList}>
        {items.map((item, i) => (
          <li key={i} className={styles.praiseItem}>
            <blockquote className={`quote ${styles.quote}`}>“{item.quote}”</blockquote>
            <p className={`meta ${styles.attribution}`}>
              {item.author}
              {item.role ? `, ${item.role}` : ''}
            </p>
          </li>
        ))}
      </ul>
      {isPlaceholder && (
        <p className={styles.placeholder}>
          Placeholder endorsements — no quote here is attributed to a real reviewer.
        </p>
      )}
    </section>
  )
}
