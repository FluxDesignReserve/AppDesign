import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const execFileP = promisify(execFile);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const cache = new Map();

export async function curlFetch(url) {
  if (cache.has(url)) return cache.get(url);
  const tmp = path.join(os.tmpdir(), 'cf-' + Math.random().toString(36).slice(2));
  const hdr = tmp + '.h';
  try {
    await execFileP('curl', ['-sS', '-L', '--compressed', '--max-time', '45', '-A', UA,
      '-H', 'accept-language: en-US,en;q=0.9', '-D', hdr, '-o', tmp, url], { maxBuffer: 1 << 26 });
    const body = fs.readFileSync(tmp);
    const raw = fs.readFileSync(hdr, 'utf8');
    const blocks = raw.split(/\r?\n\r?\n/).filter(b => /^HTTP\//.test(b));
    const last = blocks[blocks.length - 1] || '';
    const lines = last.split(/\r?\n/);
    const status = parseInt((lines[0].match(/\s(\d{3})\s?/) || [])[1] || '200', 10);
    const headers = {};
    for (const l of lines.slice(1)) {
      const i = l.indexOf(':'); if (i < 0) continue;
      const k = l.slice(0, i).trim().toLowerCase(); const v = l.slice(i + 1).trim();
      if (['content-encoding','content-length','transfer-encoding','content-security-policy','content-security-policy-report-only','strict-transport-security'].includes(k)) continue;
      headers[k] = v;
    }
    const res = { status, headers, body };
    cache.set(url, res);
    return res;
  } finally { try { fs.unlinkSync(tmp); } catch {} try { fs.unlinkSync(hdr); } catch {} }
}

export function attachRouter(page, { allow = [] } = {}) {
  return page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (!/^https?:/.test(url)) return route.continue();
    const host = new URL(url).hostname;
    if (allow.length && !allow.some(h => host === h || host.endsWith('.' + h))) return route.abort();
    try {
      const { status, headers, body } = await curlFetch(url);
      await route.fulfill({ status, headers, body });
    } catch (e) { try { await route.abort(); } catch {} }
  });
}
