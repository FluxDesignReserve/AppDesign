import { chromium } from 'playwright';
import { attachRouter } from './fetchvia.mjs';
import fs from 'node:fs';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await attachRouter(p, { allow: ['tensorlake.ai','fonts.googleapis.com','fonts.gstatic.com'] });
for (let i = 0; i < 5; i++) {
  await p.goto('https://www.tensorlake.ai/', { waitUntil: 'load', timeout: 90000 });
  await p.waitForTimeout(3500);
  const ok = await p.evaluate(() => !!document.querySelector('.tl-hero'));
  if (ok) break;
  console.error('retry', i);
}
await p.evaluate(async () => { for (let y=0;y<document.body.scrollHeight;y+=700){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));} scrollTo(0,0); });
await p.waitForTimeout(1000);

const data = await p.evaluate(() => {
  const out = {};
  // 1. CSS custom properties declared anywhere in author stylesheets
  const vars = {};
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) {
      if (!r.style) continue;
      for (const prop of r.style) {
        if (prop.startsWith('--')) {
          const v = r.style.getPropertyValue(prop).trim();
          const sel = r.selectorText || '@';
          (vars[prop] ||= []).push({ sel: sel.slice(0, 60), v });
        }
      }
    }
  }
  out.cssVars = Object.fromEntries(Object.entries(vars).map(([k, list]) => {
    const uniq = [...new Map(list.map(x => [x.sel + '|' + x.v, x])).values()];
    return [k, uniq.slice(0, 4)];
  }));

  const cs = el => el ? getComputedStyle(el) : null;
  const pick = (el, props) => { const s = cs(el); if (!s) return null; const o = {}; for (const p of props) o[p] = s.getPropertyValue(p); return o; };
  const T = ['font-family','font-size','font-weight','line-height','letter-spacing','text-transform','color','background-color','border','border-radius','padding','margin','box-shadow','gap'];

  const q = s => document.querySelector(s);
  out.elements = {};
  const add = (name, sel) => { const el = q(sel); if (el) out.elements[name] = { sel, ...pick(el, T), text: (el.innerText||'').trim().slice(0,50).replace(/\s+/g,' ') }; };
  add('body', 'body');
  add('h1', 'h1');
  add('h2', 'h2');
  add('h3', 'h3');
  add('paragraph', '.tl-hero p');
  add('navLink', 'header a, nav a');
  add('buttonPrimary', 'a[class*="btn"], a[class*="button"]');
  add('eyebrow', '[class*="eyebrow"], [class*="kicker"], [class*="label"]');
  add('code', 'pre, code');
  add('card', '[class*="card"]');
  add('footerLink', 'footer a');

  // headings sample across page
  out.headings = [...document.querySelectorAll('h1,h2,h3,h4')].slice(0, 14).map(h => {
    const s = getComputedStyle(h);
    return { tag: h.tagName, text: (h.innerText||'').trim().slice(0,44).replace(/\s+/g,' '), size: s.fontSize, weight: s.fontWeight, lh: s.lineHeight, ls: s.letterSpacing, family: s.fontFamily.split(',')[0], color: s.color, transform: s.textTransform };
  });

  // color census
  const colors = {}, bgs = {}, fams = {}, sizes = {}, radii = {};
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const s = getComputedStyle(el);
    colors[s.color] = (colors[s.color]||0)+1;
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') bgs[s.backgroundColor] = (bgs[s.backgroundColor]||0)+1;
    fams[s.fontFamily.split(',')[0].replace(/["']/g,'')] = (fams[s.fontFamily.split(',')[0]]||0)+1;
    if (el.childElementCount === 0 && (el.textContent||'').trim()) sizes[s.fontSize] = (sizes[s.fontSize]||0)+1;
    if (s.borderRadius !== '0px') radii[s.borderRadius] = (radii[s.borderRadius]||0)+1;
  });
  const top = (o, n) => Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,n);
  out.census = { colors: top(colors,14), backgrounds: top(bgs,14), families: top(fams,8), fontSizes: top(sizes,16), radii: top(radii,10) };

  // layout metrics
  const sec = document.querySelector('.tl-section');
  const inner = sec && sec.firstElementChild;
  out.layout = {
    containerWidth: inner ? Math.round(inner.getBoundingClientRect().width) : null,
    sectionPaddingY: sec ? getComputedStyle(sec).paddingTop + ' / ' + getComputedStyle(sec).paddingBottom : null,
    headerHeight: document.querySelector('header') ? Math.round(document.querySelector('header').getBoundingClientRect().height) : null,
    sectionTops: [...document.querySelectorAll('section')].map(s => Math.round(s.getBoundingClientRect().height)),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    htmlTheme: document.documentElement.getAttribute('data-theme'),
  };
  // fonts actually loaded
  out.fontFaces = [...document.fonts].map(f => `${f.family} ${f.weight} ${f.style} ${f.status}`).slice(0, 30);
  // transitions/animation
  const anims = {};
  document.querySelectorAll('*').forEach(el => { const s = getComputedStyle(el); if (s.transitionDuration !== '0s') anims[`${s.transitionProperty} ${s.transitionDuration} ${s.transitionTimingFunction}`] = (anims[`${s.transitionProperty} ${s.transitionDuration} ${s.transitionTimingFunction}`]||0)+1; });
  out.transitions = Object.entries(anims).sort((a,b)=>b[1]-a[1]).slice(0,10);
  return out;
});
fs.writeFileSync(process.argv[2], JSON.stringify(data, null, 2));
console.log(JSON.stringify({ vars: Object.keys(data.cssVars).length, census: data.census, layout: data.layout, headings: data.headings, fontFaces: data.fontFaces.slice(0,12), transitions: data.transitions }, null, 2));
await b.close();
