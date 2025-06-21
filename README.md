# vite-plugin-image-sizes

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

## Installation

```bash
# npm
npm install vite-plugin-image-sizes sharp --save-dev

# yarn
yarn add vite-plugin-image-sizes sharp --dev

# pnpm
pnpm add -D vite-plugin-image-sizes sharp
```

**Important:** This plugin uses `sharp` as a peer dependency. You must install it alongside the plugin.

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

### Options

#### `addLazyLoading`

-   **Type:** `boolean`
-   **Default:** `false`

If set to `true`, this option adds `loading="lazy"` to `<img>` tags that do not have a `loading` attribute. This is only applied if the image dimensions are successfully retrieved.

## License

[MIT](./LICENSE) 