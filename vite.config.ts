import { defineConfig } from 'vitest/config';

// base './' : fonctionne sur GitHub Pages (sous-dossier) comme sur Vercel.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000, sourcemap: false },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
