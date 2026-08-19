import { defineConfig } from 'vite';
import pkg from './package.json';

export default defineConfig({
  clearScreen: false,
  publicDir: 'static',
  server: {
    port: 5173,
    strictPort: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    outDir: 'dist',
    emptyOutDir: true,
  }
});
