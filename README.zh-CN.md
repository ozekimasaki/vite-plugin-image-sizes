# vite-plugin-image-sizes

一个 Vite 插件，可以自动为 HTML 中的 `<img>` 和 `<source>` 标签添加 `width` 和 `height` 属性。通过在构建时嵌入图像尺寸，有助于防止累积布局偏移 (CLS) 并提高 Web 性能。

该插件使用高性能的 [sharp](https://sharp.pixelplumbing.com/) 库进行图像处理。

---

[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md)

---

## 主要功能

-   自动为 `<img>` 和 `<source>` 标签添加 `width` 和 `height` 属性。
-   **开发模式 (`serve`):** 使用 `transformIndexHtml` 钩子，实现高速运行。
-   **构建模式 (`build`):** 使用 `closeBundle` 钩子，对最终的 HTML 文件进行可靠的修改。
-   可选择添加 `loading="lazy"` 属性。
-   **支持的格式:** 支持 `sharp` 处理的多种图像格式 (JPEG, PNG, WebP, GIF, SVG 等)。
    -   **注意:** 对 AVIF 的支持取决于 `sharp` 所依赖的 `libvips` 的版本和构建环境。

## 安装

```bash
# npm
npm install vite-plugin-image-sizes sharp --save-dev

# yarn
yarn add vite-plugin-image-sizes sharp --dev

# pnpm
pnpm add -D vite-plugin-image-sizes sharp
```

**重要:** 此插件将 `sharp` 作为对等依赖项 (peer dependency)。请务必与插件一同安装。

## 使用方法

在 `vite.config.ts` 中添加插件。

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import imageSizes from 'vite-plugin-image-sizes';

export default defineConfig({
    plugins: [
        imageSizes({
            addLazyLoading: true, // 可选
        }),
    ],
});
```

### 选项

#### `addLazyLoading`

-   **类型:** `boolean`
-   **默认值:** `false`

如果设置为 `true`，此选项会为没有 `loading` 属性的 `<img>` 标签添加 `loading="lazy"`。仅在成功获取图像尺寸时应用。

## 许可证

[MIT](./LICENSE) 