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

/** A flat 1x1 stand-in so a missing 2D context degrades to a plain board, not a crash. */
function solidTexture(colour: string): THREE.Texture {
  const data = new Uint8Array(4)
  const c = new THREE.Color(colour)
  data[0] = Math.round(c.r * 255)
  data[1] = Math.round(c.g * 255)
  data[2] = Math.round(c.b * 255)
  data[3] = 255
  const tex = new THREE.DataTexture(data, 1, 1)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

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
    const drawn = drawPageEdge()
    sharedPageEdge = drawn ? fromCanvas(drawn, anisotropy) : solidTexture('#e8e2d8')
    sharedPageEdge.wrapS = THREE.RepeatWrapping
    sharedPageEdge.repeat.set(1, 1)
  }
  return sharedPageEdge
}

/** Use the artwork URL if there is one, else the generated canvas, else a flat colour. */
function resolveTexture(
  url: string | undefined,
  draw: () => HTMLCanvasElement | null,
  fallbackColour: string,
  anisotropy: number,
): THREE.Texture {
  if (url) return fromUrl(url, anisotropy)
  const drawn = draw()
  return drawn ? fromCanvas(drawn, anisotropy) : solidTexture(fallbackColour)
}

/**
 * Textures are created once per book and reused for the lifetime of the session.
 * A URL on the book record takes precedence over generated artwork.
 */
export function getBookTextures(book: Book, anisotropy = 4): BookTextures {
  const existing = cache.get(book.id)
  if (existing) return existing

  const spineColour = book.palette.spine ?? book.palette.base
  const textures: BookTextures = {
    cover: resolveTexture(book.cover, () => drawCover(book), book.palette.base, anisotropy),
    spine: resolveTexture(book.spine, () => drawSpine(book), spineColour, anisotropy),
    back: resolveTexture(book.back, () => drawBack(book), spineColour, anisotropy),
    pageEdge: pageEdgeTexture(anisotropy),
  }
  cache.set(book.id, textures)
  return textures
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
