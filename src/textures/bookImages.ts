import type { Book } from '../data/books'
import { drawCover, drawSpine } from './coverArt'

/**
 * Data-URL artwork for the WebGL fallback and for plain <img> use.
 *
 * Deliberately kept in its own module: it depends only on the 2D canvas, never on
 * three. That is what lets the fallback render without the 3D bundle being loaded
 * at all — the case where WebGL is unavailable is exactly the case where pulling in
 * a WebGL library would be wasted bytes.
 *
 * `cover` is null when no 2D context is available; callers render a colour tile.
 */
export type BookImages = { cover: string | null; spine: string | null }

const cache = new Map<string, BookImages>()

export function getBookImages(book: Book): BookImages {
  const existing = cache.get(book.id)
  if (existing) return existing
  const images: BookImages = {
    cover: book.cover ?? drawCover(book)?.toDataURL('image/png') ?? null,
    spine: book.spine ?? drawSpine(book)?.toDataURL('image/png') ?? null,
  }
  cache.set(book.id, images)
  return images
}
