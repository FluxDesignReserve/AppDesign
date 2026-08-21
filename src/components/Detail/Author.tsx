import styles from './Detail.module.css'

export function Author({ name, bio }: { name: string; bio?: string }) {
  if (!bio) return null
  return (
    <section className={styles.block} aria-labelledby="author-heading">
      <p className="eyebrow" id="author-heading">
        About the author
      </p>
      <p className={`body ${styles.blockBody}`}>
        <strong className={styles.authorName}>{name}</strong> {bio}
      </p>
    </section>
  )
}
