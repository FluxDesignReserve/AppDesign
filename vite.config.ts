import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    target: 'es2020',
    // The 3D scene is a dynamic import (see src/App.tsx), so three/fiber/drei split
    // out on their own. No manual chunking needed.
    chunkSizeWarningLimit: 1000,
  },
})
