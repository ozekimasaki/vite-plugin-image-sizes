import { defineConfig } from 'vite';
import path from 'path';
import imageSizes from '../dist/index.js';

export default defineConfig({
  root: __dirname,
  plugins: [
    imageSizes({
      addLazyLoading: true,
    }),
  ],
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        nested: path.resolve(__dirname, 'pages/sub/index.html'),
        picture: path.resolve(__dirname, 'pages/picture/index.html'),
        mixed: path.resolve(__dirname, 'pages/mixed/index.html'),
        formats: path.resolve(__dirname, 'pages/formats/index.html'),
      },
    },
  },
});


