/**
 * Visual + interaction QA harness.
 *
 * Captures the required viewport matrix, exercises the interaction checklist, and
 * fails loudly on console errors or page exceptions.
 *
 *   node scripts/screenshots.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5173'
const OUT = 'qa/shots'

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844, mobile: true },
]

const problems = []

function watch(page, label) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`[${label}] console: ${msg.text()}`)
  })
  page.on('pageerror', (err) => problems.push(`[${label}] pageerror: ${err.message}`))
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? ''
    if (!failure.includes('ERR_ABORTED')) {
      problems.push(`[${label}] requestfailed: ${req.url()} — ${failure}`)
    }
  })
}

/** Wait for the WebGL scene to have drawn at least a few frames. */
async function settle(page, frames = 24) {
  await page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let i = 0
        const tick = () => (++i >= n ? resolve() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
    frames,
  )
}

async function scrollToRatio(page, ratio) {
  await page.evaluate((r) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, max * r)
  }, ratio)
  await settle(page, 40)
}

async function shot(page, name) {
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

/** Headless Chromium needs SwiftShader to expose WebGL. */
const LAUNCH_ARGS = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--disable-lcd-text',
]

async function launch() {
  try {
    return await chromium.launch({ args: LAUNCH_ARGS })
  } catch {
    // Fall back to the image's pinned build when the bundled revision differs.
    const { globSync } = await import('node:fs')
    const [found] = globSync('/opt/pw-browsers/chromium-*/chrome-linux/chrome')
    if (!found) throw new Error('No chromium binary found under /opt/pw-browsers')
    return chromium.launch({ executablePath: found, args: LAUNCH_ARGS })
  }
}

const browser = await launch()

await mkdir(OUT, { recursive: true })

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    hasTouch: !!vp.mobile,
    isMobile: !!vp.mobile,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  watch(page, vp.name)

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await settle(page, 60)
  await shot(page, `${vp.name}-01-hero`)

  await scrollToRatio(page, 0.16)
  await shot(page, `${vp.name}-02-shelf-early`)

  await scrollToRatio(page, 0.42)
  await shot(page, `${vp.name}-03-shelf-mid`)

  await scrollToRatio(page, 0.72)
  await shot(page, `${vp.name}-04-shelf-late`)

  await scrollToRatio(page, 0.94)
  await shot(page, `${vp.name}-05-editorial`)

  await page.goto(`${BASE}/boom`, { waitUntil: 'networkidle' })
  await settle(page, 70)
  await shot(page, `${vp.name}-06-detail-deeplink`)

  await context.close()
}

// ---- Interaction checks, desktop ----
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  watch(page, 'interaction')

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await settle(page, 50)

  // Open a book from the index, then verify the URL and the scene state.
  await page.getByRole('button', { name: /^Index/ }).click()
  await page.getByRole('button', { name: /Scaling People/ }).click()
  await page.waitForURL('**/scaling-people')
  await settle(page, 70)
  await shot(page, 'interaction-01-detail-from-index')

  const state = await page.evaluate(() =>
    document.querySelector('[data-scene-state]')?.getAttribute('data-scene-state'),
  )
  if (state !== 'detail') problems.push(`[interaction] scene state after open = ${state}`)

  // Next book, then browser back / forward.
  await page.getByRole('link', { name: /Next/ }).click()
  await settle(page, 70)
  await shot(page, 'interaction-02-next-book')

  await page.goBack()
  await page.waitForURL('**/scaling-people')
  await settle(page, 60)

  await page.goForward()
  await settle(page, 60)
  await shot(page, 'interaction-03-forward')

  // Return to shelf.
  await page.getByRole('button', { name: /Return to shelf/ }).click()
  await page.waitForURL(BASE + '/')
  await settle(page, 80)
  await shot(page, 'interaction-04-returned')

  const back = await page.evaluate(() =>
    document.querySelector('[data-scene-state]')?.getAttribute('data-scene-state'),
  )
  if (back !== 'shelf') problems.push(`[interaction] scene state after return = ${back}`)

  // Fast scroll then immediate reversal — the scene must still converge.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6))
  await page.evaluate(() => window.scrollTo(0, 0))
  await settle(page, 90)
  await shot(page, 'interaction-05-fast-scroll-reversal')

  // Newsletter: invalid → error → success.
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Newsletter' }).click()
  await page.waitForTimeout(700)
  const email = page.getByLabel('Email address')
  await email.fill('nope')
  await page.getByRole('button', { name: 'Subscribe' }).click()
  await page.waitForTimeout(150)
  await shot(page, 'interaction-06-newsletter-invalid')

  await email.fill('reader@error.test')
  await page.getByRole('button', { name: 'Subscribe' }).click()
  await page.waitForTimeout(1300)
  await shot(page, 'interaction-07-newsletter-error')

  await email.fill('reader@example.com')
  await page.getByRole('button', { name: 'Subscribe' }).click()
  await page.waitForTimeout(1300)
  await shot(page, 'interaction-08-newsletter-success')

  const success = await page.getByRole('status').first().textContent()
  if (!/successfully subscribed/i.test(success ?? '')) {
    problems.push(`[interaction] newsletter success copy = ${success}`)
  }

  await context.close()
}

// ---- Reduced motion ----
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  watch(page, 'reduced-motion')
  await page.goto(`${BASE}/boom`, { waitUntil: 'networkidle' })
  await settle(page, 40)
  await shot(page, 'reduced-motion-detail')
  await context.close()
}

// ---- WebGL disabled: the fallback must render the full shelf ----
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  watch(page, 'no-webgl')
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return null
    }
  })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.1))
  await page.waitForTimeout(400)
  await shot(page, 'no-webgl-fallback')

  const covers = await page.locator('img[alt^="Cover of"]').count()
  if (covers === 0) problems.push('[no-webgl] fallback rendered no covers')
  await context.close()
}

await browser.close()

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`)
  for (const p of problems) console.error('  - ' + p)
  process.exit(1)
}
console.log('QA passed — no console errors, no page exceptions, all assertions met.')
