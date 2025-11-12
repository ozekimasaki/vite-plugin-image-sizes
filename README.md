# vite-plugin-image-sizes

[![MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646cff?style=flat-square&logo=Vite&logoColor=white)](https://vitejs.dev/)

A Vite plugin that automatically adds `width` and `height` attributes to `<img>` and `<source>` tags in your HTML. By embedding image dimensions during the build process, it helps prevent Cumulative Layout Shift (CLS) and improves web performance.

This plugin uses the high-performance [sharp](https://sharp.pixelplumbing.com/) library for image processing.

---

[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md)

---

## Features

-   Automatically adds `width` and `height` attributes to `<img>` and `<source>` tags.
-   **During Development (`serve`):** Operates at high speed using the `transformIndexHtml` hook.
-   **During Build (`build`):** Reliably modifies the final HTML files using the `closeBundle` hook.
-   Optionally adds the `loading="lazy"` attribute.
-   **Supported Formats:** Supports many image formats handled by `sharp` (JPEG, PNG, WebP, GIF, SVG, etc.).
    -   **Note:** AVIF support depends on the version and build environment of `libvips`, which `sharp` relies on.

## Requirements

- Vite: ^7.0.0
- Node.js: >= 22.12.0

## Installation

```bash
# npm
npm install vite-plugin-image-sizes

# yarn
yarn add vite-plugin-image-sizes

# pnpm
pnpm add -D vite-plugin-image-sizes
```

**Important:**
From v1.0.4, both `sharp` and `glob` are bundled as runtime dependencies.
You do **not** need to install them separately.

## Usage

Add the plugin to your `vite.config.ts`:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import imageSizes from 'vite-plugin-image-sizes';

export default defineConfig({
    plugins: [
        imageSizes({
            addLazyLoading: true, // Optional
        }),
    ],
});
```

## Path Resolution Rules

- Absolute URLs (`/...` or prefixed with `base`): resolved from the build output root (build) or project root (dev).
- Relative URLs (`./`, `../`, or filename only): resolved from the directory of each HTML file being processed.
- `publicDir: false` is supported; resolution falls back to project root when `publicDir` is disabled.
- Query (`?x=1`) and hash (`#y`) parts are ignored when locating files.

### Options

#### `addLazyLoading`

-   **Type:** `boolean`
-   **Default:** `false`

If set to `true`, this option adds `loading="lazy"` to `<img>` tags that do not have a `loading` attribute. This is only applied if the image dimensions are successfully retrieved.

#### `includeTags`

-   **Type:** `Array<'img' | 'source'>`
-   **Default:** `['img', 'source']`

Specifies which tags to apply dimensions to. By default, both `<img>` and `<source>` are targeted. Note: `width`/`height` on `<source>` are generally ignored by browsers; they are added here for consistency across markup.

#### `concurrency`

-   **Type:** `number`
-   **Default:** `8`

Limits the number of concurrent image metadata reads. Increase if you have many small images and sufficient resources; decrease to reduce peak memory/FD usage.

#### `enableCache`

-   **Type:** `boolean`
-   **Default:** `true`

Enables an in-memory cache of image dimensions within a single dev session or build run, preventing duplicate work when the same file appears multiple times.

## License

[MIT](./LICENSE) 