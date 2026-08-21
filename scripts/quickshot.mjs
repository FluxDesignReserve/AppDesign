/**
 * Fast iteration harness — a representative subset across breakpoints, plus the
 * editorial sections and the WebGL fallback. Use `npm run shots` for the full matrix.
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { globSync } from 'node:fs'

const BASE = process.argv[2] ?? process.env.QA_BASE ?? 'http://127.0.0.1:5173'
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const [bin] = globSync('/opt/pw-browsers/chromium-*/chrome-linux/chrome')

const browser = await chromium.launch({ executablePath: bin, args: ARGS })
await mkdir('qa/quick', { recursive: true })
const errors = []

function open(viewport, label, extra = {}) {
  return browser.newPage({ viewport, ...extra }).then((page) => {
    page.setDefaultTimeout(120_000)
    page.on('console', (m) => m.type() === 'error' && errors.push(`${label}: ${m.text()}`))
    page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`))
    return page
  })
}

const settle = (page, n = 40) =>
  page.evaluate(
    (f) =>
      new Promise((r) => {
        let i = 0
        const t = () => (++i >= f ? r() : requestAnimationFrame(t))
        requestAnimationFrame(t)
      }),
    n,
  )

const toRatio = (page, r) =>
  page.evaluate(
    (v) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * v),
    r,
  )

async function shot(page, name) {
  await page.screenshot({ path: `qa/quick/${name}.png` })
  console.log(name)
}

// ---- desktop ----
{
  const page = await open({ width: 1440, height: 900 }, 'desktop')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await settle(page, 50)
  await shot(page, 'a-hero')
  await toRatio(page, 0.45)
  await settle(page)
  await shot(page, 'b-shelf-mid')
  await page.goto(`${BASE}/boom`, { waitUntil: 'networkidle' })
  await settle(page, 60)
  await shot(page, 'c-detail')

  // Editorial sections live below the shelf range.
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Film' }).click()
  await page.waitForTimeout(900)
  await shot(page, 'd-film')
  await page.getByRole('button', { name: 'Newsletter' }).click()
  await page.waitForTimeout(900)
  await shot(page, 'e-newsletter-footer')

  // Index panel.
  await page.getByRole('button', { name: /^Index/ }).click()
  await page.waitForTimeout(700)
  await shot(page, 'f-index')
  await page.close()
}

// ---- tablet ----
{
  const page = await open({ width: 768, height: 1024 }, 'tablet')
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await toRatio(page, 0.45)
  await settle(page)
  await shot(page, 'g-tablet-shelf')
  await page.goto(`${BASE}/boom`, { waitUntil: 'networkidle' })
  await settle(page, 60)
  await shot(page, 'h-tablet-detail')
  await page.close()
}

// ---- mobile ----
{
  const page = await open({ width: 390, height: 844 }, 'mobile', { isMobile: true, hasTouch: true })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await settle(page, 50)
  await shot(page, 'i-mobile-hero')
  await toRatio(page, 0.45)
  await settle(page)
  await shot(page, 'j-mobile-shelf')
  await page.goto(`${BASE}/boom`, { waitUntil: 'networkidle' })
  await settle(page, 60)
  await shot(page, 'k-mobile-detail')
  await page.close()
}

// ---- WebGL fallback ----
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.setDefaultTimeout(120_000)
  page.on('pageerror', (e) => errors.push(`fallback: ${e.message}`))
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    // Refuse only WebGL; 2D stays available, which is the realistic failure mode.
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (typeof type === 'string' && type.includes('webgl')) return null
      return original.call(this, type, ...rest)
    }
  })
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.15))
  await page.waitForTimeout(500)
  await shot(page, 'l-no-webgl')
  const covers = await page.locator('img[alt^="Cover of"]').count()
  if (!covers) errors.push('fallback: no covers rendered')
  // Present in the DOM is not enough — one must actually be on screen.
  if (covers && !(await page.locator('img[alt^="Cover of"]').first().isVisible())) {
    errors.push('fallback: covers rendered but not visible')
  }
  await context.close()
}

await browser.close()
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : '\nno console errors')
