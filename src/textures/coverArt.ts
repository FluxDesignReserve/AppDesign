import type { Book, BookPalette } from '../data/books'

/**
 * Procedural artwork generation.
 *
 * The reference's cover artwork is copyrighted and was not reachable in this
 * environment, so covers, spines, back boards and page edges are DRAWN from each
 * book's metadata and palette. This is an abstraction rather than a stand-in: if
 * `book.cover` / `.spine` / `.back` carry a URL, that image is used instead and
 * nothing else changes — same dimensions, same UVs, same interactions.
 */

export const COVER_W = 512
export const COVER_H = 776 // 0.66 : 1, matching bookGeometry
export const SPINE_W = 96
export const PAGE_W = 256

const DISPLAY = "'Newsreader Variable', 'Newsreader', Georgia, serif"
const BODY = "'Inter', Helvetica, Arial, sans-serif"

/** Deterministic per-book hash so a title always draws the same artwork. */
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967295
}

/**
 * Returns null when a 2D context cannot be obtained — some hardened or
 * memory-starved environments refuse one. Callers degrade to a plain colour tile
 * rather than throwing, so the page is never blank.
 */
function makeCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.textBaseline = 'alphabetic'
  return { canvas, ctx }
}

/** Fine paper grain — the difference between "printed stock" and "flat fill". */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount = 10) {
  const image = ctx.getImageData(0, 0, w, h)
  const d = image.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    d[i] = Math.max(0, Math.min(255, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
  }
  ctx.putImageData(image, 0, 0)
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function letterspaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'center' = 'left',
) {
  const chars = [...text]
  const width =
    chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) + spacing * (chars.length - 1)
  let cursor = align === 'center' ? x - width / 2 : x
  for (const c of chars) {
    ctx.fillText(c, cursor, y)
    cursor += ctx.measureText(c).width + spacing
  }
  return width
}

/** Four restrained geometric motifs, selected deterministically per book. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  palette: BookPalette,
  seed: number,
  w: number,
  h: number,
) {
  const cx = w / 2
  const cy = h * 0.44
  const r = w * 0.3
  const variant = Math.floor(seed * 4) % 4

  ctx.save()
  ctx.strokeStyle = palette.accent
  ctx.fillStyle = palette.accent
  ctx.lineWidth = w * 0.012

  if (variant === 0) {
    // Concentric arcs
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.9 - i * 0.13
      ctx.beginPath()
      ctx.arc(cx, cy, r * (0.34 + i * 0.17), Math.PI * 0.08, Math.PI * 0.92)
      ctx.stroke()
    }
  } else if (variant === 1) {
    // Stacked bars of modulating width
    const rows = 7
    for (let i = 0; i < rows; i++) {
      const t = i / (rows - 1)
      const bw = r * 2 * (0.3 + 0.7 * Math.abs(Math.sin(t * Math.PI + seed * 3)))
      ctx.globalAlpha = 0.85 - i * 0.06
      ctx.fillRect(cx - bw / 2, cy - r * 0.7 + i * (r * 0.22), bw, r * 0.075)
    }
  } else if (variant === 2) {
    // Dot grid with a cleared quadrant
    const n = 9
    const step = (r * 1.9) / (n - 1)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i > n * 0.55 && j < n * 0.45) continue
        ctx.globalAlpha = 0.28 + 0.5 * (1 - j / n)
        ctx.beginPath()
        ctx.arc(cx - r * 0.95 + i * step, cy - r * 0.95 + j * step, w * 0.008, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else {
    // Orbit: circle crossed by an ellipse
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 0.55
    ctx.beginPath()
    ctx.ellipse(cx, cy, r, r * 0.34, -0.45 + seed, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawCover(book: Book): HTMLCanvasElement | null {
  const surface = makeCanvas(COVER_W, COVER_H)
  if (!surface) return null
  const { canvas, ctx } = surface
  const p = book.palette
  const seed = hash(book.id)

  ctx.fillStyle = p.base
  ctx.fillRect(0, 0, COVER_W, COVER_H)

  drawMark(ctx, p, seed, COVER_W, COVER_H)

  const margin = COVER_W * 0.11

  // Hairline rules bracketing the type block
  ctx.strokeStyle = p.ink
  ctx.globalAlpha = 0.34
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(margin, COVER_H * 0.115)
  ctx.lineTo(COVER_W - margin, COVER_H * 0.115)
  ctx.stroke()
  ctx.globalAlpha = 1

  // Publisher line
  ctx.fillStyle = p.ink
  ctx.globalAlpha = 0.7
  ctx.font = `500 ${COVER_W * 0.026}px ${BODY}`
  letterspaced(ctx, 'STRIPE PRESS', COVER_W / 2, COVER_H * 0.085, COVER_W * 0.014, 'center')
  ctx.globalAlpha = 1

  // Title
  const titleSize = book.title.length > 26 ? COVER_W * 0.093 : COVER_W * 0.116
  ctx.font = `300 ${titleSize}px ${DISPLAY}`
  ctx.textAlign = 'center'
  const lines = wrapText(ctx, book.title, COVER_W - margin * 2)
  const lineHeight = titleSize * 1.1
  let ty = COVER_H * 0.735 - (lines.length - 1) * lineHeight
  ctx.fillStyle = p.ink
  for (const line of lines) {
    ctx.fillText(line, COVER_W / 2, ty)
    ty += lineHeight
  }

  // Subtitle
  if (book.subtitle) {
    ctx.font = `italic 300 ${COVER_W * 0.042}px ${DISPLAY}`
    ctx.globalAlpha = 0.78
    const subLines = wrapText(ctx, book.subtitle, COVER_W - margin * 2.4).slice(0, 2)
    let sy = ty + COVER_W * 0.028
    for (const line of subLines) {
      ctx.fillText(line, COVER_W / 2, sy)
      sy += COVER_W * 0.054
    }
    ctx.globalAlpha = 1
  }

  // Author
  ctx.font = `500 ${COVER_W * 0.032}px ${BODY}`
  ctx.textAlign = 'left'
  ctx.globalAlpha = 0.86
  letterspaced(
    ctx,
    book.author.toUpperCase(),
    COVER_W / 2,
    COVER_H * 0.915,
    COVER_W * 0.008,
    'center',
  )
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'

  grain(ctx, COVER_W, COVER_H, 12)
  return canvas
}

export function drawSpine(book: Book): HTMLCanvasElement | null {
  const surface = makeCanvas(SPINE_W, COVER_H)
  if (!surface) return null
  const { canvas, ctx } = surface
  const p = book.palette

  ctx.fillStyle = p.spine ?? p.base
  ctx.fillRect(0, 0, SPINE_W, COVER_H)

  // Head and tail rules
  ctx.strokeStyle = p.ink
  ctx.globalAlpha = 0.3
  ctx.lineWidth = 1.5
  for (const y of [COVER_H * 0.06, COVER_H * 0.94]) {
    ctx.beginPath()
    ctx.moveTo(SPINE_W * 0.22, y)
    ctx.lineTo(SPINE_W * 0.78, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // Vertical type, reading top-to-bottom as on a US-bound spine
  ctx.save()
  ctx.translate(SPINE_W / 2, COVER_H * 0.12)
  ctx.rotate(Math.PI / 2)
  ctx.fillStyle = p.ink
  ctx.textAlign = 'left'
  const size = book.title.length > 24 ? SPINE_W * 0.34 : SPINE_W * 0.42
  ctx.font = `300 ${size}px ${DISPLAY}`
  ctx.fillText(book.title, 0, size * 0.36)

  const titleWidth = ctx.measureText(book.title).width
  ctx.font = `500 ${SPINE_W * 0.2}px ${BODY}`
  ctx.globalAlpha = 0.75
  ctx.fillText(book.author, titleWidth + SPINE_W * 0.5, size * 0.34)
  ctx.restore()

  // Publisher mark at the tail
  ctx.save()
  ctx.translate(SPINE_W / 2, COVER_H * 0.9)
  ctx.rotate(Math.PI / 2)
  ctx.fillStyle = p.ink
  ctx.globalAlpha = 0.6
  ctx.font = `500 ${SPINE_W * 0.17}px ${BODY}`
  ctx.textAlign = 'right'
  letterspaced(ctx, 'STRIPE PRESS', 0, SPINE_W * 0.06, SPINE_W * 0.03)
  ctx.restore()

  grain(ctx, SPINE_W, COVER_H, 10)
  return canvas
}

export function drawBack(book: Book): HTMLCanvasElement | null {
  const surface = makeCanvas(COVER_W, COVER_H)
  if (!surface) return null
  const { canvas, ctx } = surface
  const p = book.palette
  const margin = COVER_W * 0.13

  ctx.fillStyle = p.spine ?? p.base
  ctx.fillRect(0, 0, COVER_W, COVER_H)

  // Blurb block rendered as rules — legible as "text" at book scale without
  // inventing copy.
  ctx.fillStyle = p.ink
  const lineCount = 11
  for (let i = 0; i < lineCount; i++) {
    ctx.globalAlpha = 0.2 - (i / lineCount) * 0.06
    const w = (COVER_W - margin * 2) * (i === lineCount - 1 ? 0.52 : 0.86 + Math.sin(i) * 0.13)
    ctx.fillRect(margin, COVER_H * 0.2 + i * COVER_W * 0.052, w, COVER_W * 0.012)
  }
  ctx.globalAlpha = 1

  // ISBN-style block
  ctx.fillStyle = p.ink
  ctx.globalAlpha = 0.12
  ctx.fillRect(margin, COVER_H * 0.8, COVER_W * 0.3, COVER_H * 0.08)
  ctx.globalAlpha = 0.68
  ctx.font = `500 ${COVER_W * 0.026}px ${BODY}`
  ctx.textAlign = 'right'
  letterspaced(ctx, 'STRIPE PRESS', COVER_W - margin, COVER_H * 0.86, COVER_W * 0.012)
  ctx.globalAlpha = 1
  ctx.textAlign = 'left'

  grain(ctx, COVER_W, COVER_H, 10)
  return canvas
}

/** Fore-edge / head / tail leaf lines. */
export function drawPageEdge(): HTMLCanvasElement | null {
  const surface = makeCanvas(PAGE_W, 128)
  if (!surface) return null
  const { canvas, ctx } = surface
  ctx.fillStyle = '#e8e2d8'
  ctx.fillRect(0, 0, PAGE_W, 128)

  for (let x = 0; x < PAGE_W; x++) {
    const n = Math.random()
    const shade = 0.06 + n * 0.1 + (Math.sin(x * 1.9) * 0.5 + 0.5) * 0.07
    ctx.fillStyle = `rgba(120, 104, 88, ${shade})`
    ctx.fillRect(x, 0, 1, 128)
  }

  // Slight darkening toward the edges, as a page block gathers dust
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, 'rgba(90, 76, 62, 0.28)')
  g.addColorStop(0.5, 'rgba(90, 76, 62, 0)')
  g.addColorStop(1, 'rgba(90, 76, 62, 0.28)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, PAGE_W, 128)

  return canvas
}
