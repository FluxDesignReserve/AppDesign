import { useRef, useState } from 'react'
import { NEWSLETTER_COPY, isValidEmail, submitEmail } from '../../lib/newsletter'
import styles from './Newsletter.module.css'

type State = 'default' | 'invalid' | 'submitting' | 'error' | 'success'

/**
 * Newsletter signup with the full set of visible states:
 * default · focused · invalid · submitting · network error · success.
 *
 * Submission is mocked (src/lib/newsletter.ts) — no real backend is contacted.
 * Use an address on `@error.` to reach the network-error state.
 */
export function Newsletter() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>('default')
  const abort = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const message =
    state === 'invalid'
      ? NEWSLETTER_COPY.invalid
      : state === 'error'
        ? NEWSLETTER_COPY.network
        : state === 'success'
          ? NEWSLETTER_COPY.success
          : ''

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (state === 'submitting') return

    if (!isValidEmail(email)) {
      setState('invalid')
      inputRef.current?.focus()
      return
    }

    setState('submitting')
    abort.current?.abort()
    abort.current = new AbortController()

    try {
      const result = await submitEmail(email, abort.current.signal)
      if (result.ok) {
        setState('success')
        setEmail('')
      } else {
        setState('error')
      }
    } catch {
      /* aborted — the next submission owns the state */
    }
  }

  return (
    <section className={styles.section} id="newsletter" aria-labelledby="newsletter-heading">
      <div className="container">
        <hr className="rule" />
        <div className={styles.grid}>
          <div>
            <p className="eyebrow">Newsletter</p>
            <h2 id="newsletter-heading" className={`heading ${styles.heading}`}>
              New books, occasionally.
            </h2>
          </div>

          <div className={styles.formColumn}>
            <p className="body">
              Sign up to hear about new Stripe Press books, films, and podcast episodes.
            </p>

            <form className={styles.form} onSubmit={onSubmit} noValidate>
              <label htmlFor="newsletter-email" className="visually-hidden">
                Email address
              </label>
              <div className={styles.field}>
                <input
                  ref={inputRef}
                  id="newsletter-email"
                  className={`${styles.input} ${state === 'invalid' || state === 'error' ? styles.inputError : ''}`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  aria-invalid={state === 'invalid' || state === 'error'}
                  aria-describedby="newsletter-status"
                  disabled={state === 'submitting'}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (state !== 'submitting') setState('default')
                  }}
                />
                <button className={styles.submit} type="submit" disabled={state === 'submitting'}>
                  {state === 'submitting' ? 'Subscribing…' : 'Subscribe'}
                </button>
              </div>

              <p
                id="newsletter-status"
                role="status"
                aria-live="polite"
                className={`${styles.status} ${
                  state === 'success' ? styles.statusSuccess : ''
                } ${state === 'invalid' || state === 'error' ? styles.statusError : ''}`}
              >
                {message}
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
