# AGENTS.md

Guidelines for coding agents working in this repository. Keep everything here consistent with the actual codebase.

## Project Overview

`vite-plugin-image-sizes` is a Vite plugin that automatically adds `width` and `height` attributes to `<img>` and `<source>` tags in HTML. By embedding image dimensions at build/dev time, it reduces Cumulative Layout Shift (CLS) and improves web performance. (See the `description` field in `package.json`.)

## Project Structure

- `src/index.ts`: Plugin entrypoint. Default-exports `imageSizes(options)` and processes HTML through two Vite hooks: `transformIndexHtml` (during `serve`/dev) and `closeBundle` (during `build`). The `processHtml` function parses HTML with `cheerio` and reads image metadata with `sharp`.
- `src/concurrency.ts`: Semaphore utility (`createSemaphore`) that limits the number of concurrent image reads.
- `src/utils/html.ts`: HTML/srcset parsing helpers, e.g. `pickFirstFromSrcOrSrcset`.
- `src/utils/path.ts`: Path resolution helpers: `normalizeUrl`, `stripQueryAndHash`, `removeBasePrefix`, `isAbsoluteLike`, `tryReadFile`, `resolveCandidatePaths`.
- `test/processHtml.spec.ts`: Unit tests (Vitest).
- `e2e-smoke/`: End-to-end smoke test. `scripts/generate-images.mjs` generates test images, `scripts/check-e2e.mjs` verifies the output, and `vite.config.ts` holds the build configuration.
- `README.md`, `README.ja.md`, `README.zh-CN.md`: Documentation (English, Japanese, Simplified Chinese).

## Development Commands

Reflect the `scripts` in `package.json` exactly:

- `npm run dev`: Start the dev server (`vite`).
- `npm run build`: Clean `dist` and compile with `tsc` (`clean` + `tsc`).
- `npm run test`: Run unit tests once (`vitest run`).
- `npm run test:watch`: Run unit tests in watch mode (`vitest`).
- `npm run e2e`: Run the E2E build (`e2e:build`) and check (`e2e:check`).
- `npm run test:build`: Verify a production build via `vite build`.

There is **no** dedicated `lint` or `typecheck` script. Type checking is done by `tsc` as part of `npm run build` (strict mode). Run `npm run build` to catch type errors.

## Continuous Integration

`.github/workflows/ci.yml` runs on every push and pull request. On Node `22.x` it executes: `npm ci` → `npm run build` → `npm test` → generate E2E images → `vite build` (E2E config) → `node e2e-smoke/scripts/check-e2e.mjs`. Make sure these pass locally before opening a PR.

## Tech Stack and Conventions

- Node.js `>=22.12.0` is required (see `engines`).
- ESM only (`"type": "module"`). Relative imports must use the `.js` extension (e.g. `./concurrency.js`, `./utils/html.js`). The `import` statements in `src/index.ts` follow this convention — match it in new code.
- TypeScript runs in strict mode (`tsconfig.json`: `strict: true`, `target`/`module`: `ESNext`, `moduleResolution: bundler`, `declaration: true`).
- Runtime dependencies: `cheerio` (HTML parsing), `glob` (finding built HTML files), `sharp` (image metadata).
- `vite` is a peer dependency (`^7.0.0 || ^8.0.0`).
- Plugin options (`ImageSizeOptions`):
  - `addLazyLoading` (default `false`): add `loading="lazy"` to `<img>` tags that lack a `loading` attribute, only when dimensions are successfully retrieved.
  - `includeTags` (default `['img', 'source']`): which tags to apply dimensions to.
  - `concurrency` (default `8`): maximum number of concurrent image metadata reads.
  - `enableCache` (default `true`): in-memory cache of image dimensions within a single dev session or build run.

## Notes for Agents

- After any code change, always run `npm run test` to confirm there are no regressions.
- If you change the image-processing logic, also run `npm run e2e` to exercise the E2E smoke test.
- `sharp` is a native dependency. For tests, two globals are available to avoid native/IO flakiness:
  - `globalThis.__IMAGE_SIZES_TEST_SHARP__`: injects a mock `sharp` module.
  - `globalThis.__IMAGE_SIZES_TEST_FORCE_DIMS__`: a test-only fast path that applies fixed dimensions, avoiding IO/native dependencies.
- The only published build artifact is `dist/` (`files: ["dist"]`).
- License: MIT.
