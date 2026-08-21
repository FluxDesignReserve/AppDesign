import * as THREE from 'three'
import type { Book } from '../data/books'
import { drawBack, drawCover, drawPageEdge, drawSpine } from './coverArt'

export type BookTextures = {
  cover: THREE.Texture
  spine: THREE.Texture
  back: THREE.Texture
  pageEdge: THREE.Texture
}

const cache = new Map<string, BookTextures>()
let sharedPageEdge: THREE.Texture | null = null
const loader = new THREE.TextureLoader()

function fromCanvas(canvas: HTMLCanvasElement, anisotropy: number): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.needsUpdate = true
  return tex
}

function fromUrl(url: string, anisotropy: number): THREE.Texture {
  const tex = loader.load(url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = anisotropy
  return tex
}

/** The page-edge texture is identical for every book, so it is created once. */
function pageEdgeTexture(anisotropy: number): THREE.Texture {
  if (!sharedPageEdge) {
    sharedPageEdge = fromCanvas(drawPageEdge(), anisotropy)
    sharedPageEdge.wrapS = THREE.RepeatWrapping
    sharedPageEdge.repeat.set(1, 1)
  }
  return sharedPageEdge
}

/**
 * Textures are created once per book and reused for the lifetime of the session.
 * A URL on the book record takes precedence over generated artwork.
 */
export function getBookTextures(book: Book, anisotropy = 4): BookTextures {
  const existing = cache.get(book.id)
  if (existing) return existing

  const textures: BookTextures = {
    cover: book.cover ? fromUrl(book.cover, anisotropy) : fromCanvas(drawCover(book), anisotropy),
    spine: book.spine ? fromUrl(book.spine, anisotropy) : fromCanvas(drawSpine(book), anisotropy),
    back: book.back ? fromUrl(book.back, anisotropy) : fromCanvas(drawBack(book), anisotropy),
    pageEdge: pageEdgeTexture(anisotropy),
  }
  cache.set(book.id, textures)
  return textures
}

/** Data-URL versions for the non-WebGL fallback and for <img> use. */
const imageCache = new Map<string, { cover: string; spine: string }>()

export function getBookImages(book: Book): { cover: string; spine: string } {
  const existing = imageCache.get(book.id)
  if (existing) return existing
  const images = {
    cover: book.cover ?? drawCover(book).toDataURL('image/png'),
    spine: book.spine ?? drawSpine(book).toDataURL('image/png'),
  }
  imageCache.set(book.id, images)
  return images
}

/** Release every GPU resource this module owns. Called on app teardown. */
export function disposeAllTextures() {
  for (const set of cache.values()) {
    set.cover.dispose()
    set.spine.dispose()
    set.back.dispose()
  }
  cache.clear()
  sharedPageEdge?.dispose()
  sharedPageEdge = null
}
