/**
 * VITE_MAJOR_VERSION に応じて Vite 6 / 7 / 8 で E2E 用ビルドを実行する。
 * 設定ファイル経由だと `import 'vite'` が常に最新版へ解決されるため、
 * 対象バージョンの `build()` にインライン設定を渡す。
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import imageSizes from '../../dist/index.js'

const e2eRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const major = process.env.VITE_MAJOR_VERSION ?? '8'
const specifier = major === '6' ? 'vite6' : major === '7' ? 'vite7' : 'vite'

const { build } = await import(specifier)

await build({
  root: e2eRoot,
  configFile: false,
  logLevel: 'warn',
  plugins: [
    imageSizes({
      addLazyLoading: true,
    }),
  ],
  build: {
    assetsInlineLimit: 0,
    outDir: 'dist',
    emptyOutDir: true,
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
})
