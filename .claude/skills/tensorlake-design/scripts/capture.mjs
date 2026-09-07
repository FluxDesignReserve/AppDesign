import { chromium } from 'playwright';
import { attachRouter } from './fetchvia.mjs';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
const SHOTS = path.join(OUT, 'Tensorlake');
fs.mkdirSync(path.join(SHOTS, 'pages'), { recursive: true });
fs.mkdirSync(path.join(SHOTS, 'sections'), { recursive: true });
fs.mkdirSync(path.join(SHOTS, 'components'), { recursive: true });
fs.mkdirSync(path.join(SHOTS, 'mobile'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'reference'), { recursive: true });

const ALLOW = ['tensorlake.ai', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const BASE = 'https://www.tensorlake.ai';
const ROUTES = [['/', 'home'], ['/pricing', 'pricing'], ['/blog', 'blog'], ['/careers', 'careers'], ['/faq', 'faq'], ['/blog/claude-managed-agents', 'blog-post']];

const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: CHROME });

async function open(width, height, dpr) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: width < 500, hasTouch: width < 500 });
  const page = await ctx.newPage();
  await attachRouter(page, { allow: ALLOW });
  return { ctx, page };
}
async function settle(page) {
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const step = Math.round(innerHeight * 0.7);
    for (let y = 0; y < document.body.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    scrollTo(0, document.body.scrollHeight); await new Promise(r => setTimeout(r, 400)); scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

// ---------- desktop pages ----------
const meta = { captured: new Date().toISOString().slice(0, 10), source: BASE, shots: [] };
{
  const { ctx, page } = await open(1440, 900, 1);
  for (const [route, name] of ROUTES) {
    try {
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 90000 });
      await settle(page);
      const file = `Tensorlake/pages/${name}-1440-full.jpg`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true, type: 'jpeg', quality: 86 });
      meta.shots.push({ file, route, viewport: '1440x900', kind: 'full page' });
      console.log('page', name);
    } catch (e) { console.log('SKIP', name, e.message.split('\n')[0]); }
  }

  // ---------- home sections ----------
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 90000 });
  await settle(page);
  const sections = await page.evaluate(() => {
    const els = [...document.querySelectorAll('section, footer')].filter(e => e.getBoundingClientRect().height > 120);
    return els.map((e, i) => ({ i, id: e.id, cls: (e.className || '').toString(), text: (e.innerText || '').trim().slice(0, 80).replace(/\s+/g, ' ') }));
  });
  const slug = s => (s.id || s.cls.split(/\s+/).find(c => c.startsWith('tl-')) || 'section').replace(/^tl-/, '');
  const seen = {};
  for (const s of sections) {
    let name = slug(s); seen[name] = (seen[name] || 0) + 1; if (seen[name] > 1) name += '-' + seen[name];
    const target = await page.evaluateHandle((idx) => [...document.querySelectorAll('section, footer')].filter(e => e.getBoundingClientRect().height > 120)[idx], s.i);
    const box = await target.asElement().boundingBox();
    if (!box) continue;
    await page.evaluate(y => scrollTo(0, y), Math.max(0, box.y - 80));
    await page.waitForTimeout(700);
    const file = `Tensorlake/sections/${String(s.i + 1).padStart(2, '0')}-${name}.png`;
    try {
      await target.asElement().screenshot({ path: path.join(OUT, file) });
      meta.shots.push({ file, route: '/', viewport: '1440x900', kind: 'section', note: s.text });
      console.log('section', name);
    } catch (e) { console.log('sec skip', name, e.message.split('\n')[0]); }
  }

  // ---------- component crops at 2x ----------
  await ctx.close();
}
{
  const { ctx, page } = await open(1440, 900, 2);
  await page.goto(BASE + '/', { waitUntil: 'load', timeout: 90000 });
  await settle(page);
  const comps = [
    ['nav-header', 'header, nav'],
    ['hero-copy-and-buttons', '.tl-hero'],
    ['code-panel', '.tl-hero [class*="terminal"], .tl-hero [class*="editor"], .tl-hero [class*="panel"]'],
    ['logo-wall', '[class*="logos"], [class*="marquee"]'],
    ['feature-cards', '#product .tl-section__body, #product'],
    ['footer', 'footer'],
  ];
  for (const [name, sel] of comps) {
    const el = await page.$(sel);
    if (!el) { console.log('no comp', name); continue; }
    const box = await el.boundingBox(); if (!box) continue;
    await page.evaluate(y => scrollTo(0, y), Math.max(0, box.y - 60));
    await page.waitForTimeout(600);
    const file = `Tensorlake/components/${name}.png`;
    try { await el.screenshot({ path: path.join(OUT, file) }); meta.shots.push({ file, route: '/', viewport: '1440x900 @2x', kind: 'component' }); console.log('comp', name); }
    catch (e) { console.log('comp skip', name, e.message.split('\n')[0]); }
  }
  await ctx.close();
}
// ---------- mobile ----------
{
  const { ctx, page } = await open(390, 844, 2);
  for (const [route, name] of [['/', 'home'], ['/pricing', 'pricing'], ['/blog', 'blog']]) {
    try {
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 90000 });
      await settle(page);
      const file = `Tensorlake/mobile/${name}-390-full.jpg`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true, type: 'jpeg', quality: 84 });
      meta.shots.push({ file, route, viewport: '390x844 @2x', kind: 'full page (mobile)' });
      console.log('mobile', name);
    } catch (e) { console.log('m skip', name, e.message.split('\n')[0]); }
  }
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, 'reference', 'shots.json'), JSON.stringify(meta, null, 2));
await browser.close();
console.log('done');
