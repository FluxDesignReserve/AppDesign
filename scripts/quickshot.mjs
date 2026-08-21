/** Fast iteration harness: a few key frames at desktop width. */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { globSync } from 'node:fs'

const BASE = 'http://127.0.0.1:5173'
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
const [bin] = globSync('/opt/pw-browsers/chromium-*/chrome-linux/chrome')

const browser = await chromium.launch({ executablePath: bin, args: ARGS })
await mkdir('qa/quick', { recursive: true })

const errors = []
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
// SwiftShader renders the scene an order of magnitude slower than a GPU, so the
// default 30s budget is not enough for a full-viewport capture.
page.setDefaultTimeout(120_000)
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(e.message))

const settle = (n = 40) =>
  page.evaluate(
    (f) => new Promise((r) => { let i = 0; const t = () => (++i >= f ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }),
    n,
  )

await page.goto(BASE, { waitUntil: 'networkidle' })
await settle(50)
await page.screenshot({ path: 'qa/quick/a-hero.png' })
console.log('hero ok')

for (const [name, ratio] of [['b-shelf-early', 0.18], ['c-shelf-mid', 0.45], ['d-shelf-late', 0.75]]) {
  await page.evaluate((r) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * r), ratio)
  await settle(40)
  await page.screenshot({ path: `qa/quick/${name}.png` })
  console.log(name, 'ok')
}

await page.goto(`${BASE}/boom`, { waitUntil: 'networkidle' })
await settle(60)
await page.screenshot({ path: 'qa/quick/e-detail.png' })

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
mobile.setDefaultTimeout(120_000)
mobile.on('pageerror', (e) => errors.push('mobile: ' + e.message))
await mobile.goto(BASE, { waitUntil: 'networkidle' })
await mobile.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
await mobile.screenshot({ path: 'qa/quick/f0-mobile-hero.png' })
await mobile.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.45))
await mobile.evaluate(() => new Promise((r) => setTimeout(r, 900)))
await mobile.screenshot({ path: 'qa/quick/f-mobile-shelf.png' })
await mobile.goto(`${BASE}/boom`, { waitUntil: 'networkidle' })
await mobile.evaluate(() => new Promise((r) => setTimeout(r, 1200)))
await mobile.screenshot({ path: 'qa/quick/g-mobile-detail.png' })

await browser.close()
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors')
