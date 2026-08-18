import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: resolve(import.meta.dirname, 'static'),
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'frontend/src/main.ts'),
      name: 'WH3ModManager',
      fileName: () => 'main.js',
      formats: ['iife']
    }
  }
});
