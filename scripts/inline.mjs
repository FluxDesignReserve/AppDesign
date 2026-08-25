/**
 * Collapse the single-file build into one self-contained .html document.
 *
 * Vite still emits the entry chunk and stylesheet as separate files even with
 * inlineDynamicImports, so they are folded into the document here.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises'

const DIR = 'dist-single'
const assets = await readdir(`${DIR}/assets`)
const jsName = assets.find((f) => f.endsWith('.js'))
const cssName = assets.find((f) => f.endsWith('.css'))

const [html, js, css] = await Promise.all([
  readFile(`${DIR}/index.html`, 'utf8'),
  readFile(`${DIR}/assets/${jsName}`, 'utf8'),
  readFile(`${DIR}/assets/${cssName}`, 'utf8'),
])

// A literal </script> or </style> inside the bundle would close the tag early.
for (const [name, body] of [['script', js], ['style', css]]) {
  if (new RegExp(`</${name}`, 'i').test(body)) {
    throw new Error(`Bundle contains a literal </${name}> and needs escaping`)
  }
}

// Replacer FUNCTIONS, not strings: `$&` and friends are substitution patterns in
// a replacement string, and minified bundles are full of `$`.
const out = html
  .replace(/<script type="module"[^>]*src="[^"]*"><\/script>/, () => `<script type="module">\n${js}\n</script>`)
  .replace(/<link rel="stylesheet"[^>]*href="[^"]*"\s*\/?>/, () => `<style>\n${css}\n</style>`)

if (out.includes('/assets/')) throw new Error('An asset reference survived inlining')

await writeFile('dist-single/stripe-press-replica.html', out)
console.log(`inlined -> dist-single/stripe-press-replica.html (${(out.length / 1e6).toFixed(2)} MB)`)
