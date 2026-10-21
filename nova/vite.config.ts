import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build:single` inlines everything into one index.html that opens off disk.
const single = process.env.SINGLE === '1';

export default defineConfig({
  base: './',
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  build: { outDir: single ? 'dist-single' : 'dist', chunkSizeWarningLimit: 2000 },
  css: { preprocessorOptions: { scss: { api: 'modern-compiler', quietDeps: true, silenceDeprecations: ['mixed-decls'] } } },
});
