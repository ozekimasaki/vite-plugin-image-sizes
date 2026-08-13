import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import imageSizes from '../dist/index.js';

const e2eRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: e2eRoot,
  plugins: [
    imageSizes({
      addLazyLoading: true,
    }),
  ],
  build: {
    assetsInlineLimit: 0,
    // rollupOptions は Vite 7 (Rollup) と Vite 8 (Rolldown) の両方で有効
    rollupOptions: {
      input: {
        main: path.resolve(e2eRoot, 'index.html'),
        nested: path.resolve(e2eRoot, 'pages/sub/index.html'),
        picture: path.resolve(e2eRoot, 'pages/picture/index.html'),
        mixed: path.resolve(e2eRoot, 'pages/mixed/index.html'),
        formats: path.resolve(e2eRoot, 'pages/formats/index.html'),
      },
    },
  },
});
