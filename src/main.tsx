import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
// Self-hosted faces: no third-party request, no render-blocking stylesheet, and
// the covers can be drawn the moment the fonts resolve.
import '@fontsource-variable/newsreader'
import '@fontsource-variable/newsreader/opsz-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import './styles/globals.css'

/**
 * Covers are drawn to a canvas using the display serif, so the webfonts must be
 * resolved before the first texture is generated. Capped so a slow font never
 * blocks the experience.
 */
async function fontsReady() {
  if (!('fonts' in document)) return
  // `document.fonts.ready` alone resolves immediately when nothing has requested a
  // face yet, so each family is explicitly loaded first.
  const load = Promise.all([
    document.fonts.load('300 100px "Newsreader Variable"'),
    document.fonts.load('400 100px "Newsreader Variable"'),
    document.fonts.load('500 16px "Inter"'),
  ]).then(() => document.fonts.ready)

  await Promise.race([load, new Promise((resolve) => setTimeout(resolve, 1500))])
}

fontsReady().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  )
})
