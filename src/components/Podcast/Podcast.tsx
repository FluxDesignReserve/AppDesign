import { episodes, podcast } from '../../data/podcasts'
import styles from './Podcast.module.css'

export function PodcastSection() {
  return (
    <section className={styles.section} id="podcast" aria-labelledby="podcast-heading">
      <div className="container">
        <hr className="rule" />
        <div className={styles.grid}>
          <div>
            <p className="eyebrow">Podcast</p>
            <h2 id="podcast-heading" className={`heading ${styles.heading}`}>
              {podcast.title}
            </h2>
            <p className={`body ${styles.blurb}`}>{podcast.description}</p>
            <a
              className={`link ${styles.listen}`}
              href={podcast.href}
              target="_blank"
              rel="noreferrer noopener"
            >
              Listen
            </a>
          </div>

          <ol className={styles.list}>
            {episodes.map((ep, i) => (
              <li key={ep.id}>
                <a
                  className={styles.episode}
                  href={ep.href}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span className={styles.num} aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.body}>
                    <span className={styles.title}>{ep.title}</span>
                    {ep.guest && <span className={styles.guest}>{ep.guest}</span>}
                  </span>
                  {ep.isPlaceholder && (
                    <span className={styles.placeholder}>Placeholder</span>
                  )}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
