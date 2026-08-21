/**
 * Mocked newsletter submission. The reference's real backend is deliberately NOT
 * contacted. Failure is simulated for addresses on the `@error.` domain so the
 * network-error state is reachable in QA.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type SubmitResult = { ok: true } | { ok: false; reason: 'network' }

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export function submitEmail(email: string, signal?: AbortSignal): Promise<SubmitResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(email.includes('@error.') ? { ok: false, reason: 'network' } : { ok: true })
    }, 900)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export const NEWSLETTER_COPY = {
  invalid: 'Please enter a valid email address.',
  network: 'You might have had an internet hiccup. Try again?',
  success: 'You successfully subscribed.',
} as const
