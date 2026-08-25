import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Read from the ambient env without pulling in @types/node for one flag.
declare const process: { env: Record<string, string | undefined> }
const singleFile = !!process.env.VITE_SINGLE_FILE

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    target: 'es2020',
    // The 3D scene is a dynamic import (see src/App.tsx), so three/fiber/drei split
    // out on their own. No manual chunking needed.
    chunkSizeWarningLimit: 1000,
    // Single-file mode collapses every chunk and asset into one document, for
    // hosting somewhere that can only serve a lone HTML file.
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 100_000_000 : 4096,
    rollupOptions: singleFile
      ? { output: { inlineDynamicImports: true } }
      : undefined,
  },
})
