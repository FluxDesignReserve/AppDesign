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
                {/* Flat colour field, not a gradient: an honest placeholder for a
                    still we cannot reproduce, with the frame and ratio preserved. */}
                <div
                  className={styles.still}
                  style={{ background: film.palette.base }}
                  aria-hidden="true"
                >
                  <svg
                    className={styles.play}
                    viewBox="0 0 44 44"
                    width="44"
                    height="44"
                    style={{ color: film.palette.ink }}
                    focusable="false"
                  >
                    <circle cx="22" cy="22" r="21" fill="none" stroke="currentColor" strokeWidth="1" />
                    <path d="M18 14.5 30.5 22 18 29.5z" fill="currentColor" />
                  </svg>
                  <span className={styles.stillNote} style={{ color: film.palette.ink }}>
                    Placeholder still
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
