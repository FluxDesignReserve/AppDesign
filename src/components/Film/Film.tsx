import { films } from '../../data/films'
import styles from './Film.module.css'

export function FilmSection() {
  return (
    <section className={styles.section} id="film" aria-labelledby="film-heading">
      <div className="container">
        <hr className="rule" />
        <div className={styles.head}>
          <p className="eyebrow">Film</p>
          <h2 id="film-heading" className={`heading ${styles.heading}`}>
            Stories about the people behind the ideas.
          </h2>
        </div>

        <ul className={styles.list}>
          {films.map((film) => (
            <li key={film.id} className={styles.item}>
              <a className={styles.link} href={film.href} target="_blank" rel="noreferrer noopener">
                <div
                  className={styles.still}
                  style={{
                    background: `linear-gradient(155deg, ${film.palette.base} 0%, ${film.palette.accent}22 100%)`,
                  }}
                  aria-hidden="true"
                >
                  <span className={styles.stillMark} style={{ color: film.palette.ink }}>
                    {film.title}
                  </span>
                </div>
                <div className={styles.meta}>
                  <h3 className={`subheading ${styles.title}`}>{film.title}</h3>
                  {film.subtitle && <p className="meta">{film.subtitle}</p>}
                  <p className={`body ${styles.description}`}>{film.description}</p>
                  <p className={`meta ${styles.runtime}`}>
                    {[film.year, film.runtime].filter(Boolean).join(' · ')}
                  </p>
                  {film.isPlaceholder && <p className={styles.placeholder}>Placeholder copy</p>}
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
