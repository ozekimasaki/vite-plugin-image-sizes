# vite-plugin-image-sizes

[![MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646cff?style=flat-square&logo=Vite&logoColor=white)](https://vitejs.dev/)

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
npm install vite-plugin-image-sizes

# yarn
yarn add vite-plugin-image-sizes

# pnpm
pnpm add -D vite-plugin-image-sizes
```

**重要：**  
自 v1.0.4 起，`sharp` 和 `glob` 都已作为运行时依赖内置于插件中。  
用户无需单独安装这些依赖。

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