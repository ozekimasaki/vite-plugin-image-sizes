# vite-plugin-image-sizes

[![MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646cff?style=flat-square&logo=Vite&logoColor=white)](https://vitejs.dev/)

HTML内の`<img>`および`<source>`タグに、`width`と`height`属性を自動的に追加するViteプラグインです。ビルド時に画像の寸法を埋め込むことで、CLS (Cumulative Layout Shift) を防ぎ、ウェブパフォーマンスを向上させます。

画像処理には高機能な [sharp](https://sharp.pixelplumbing.com/) ライブラリを使用しています。

---

[English](./README.md) | [日本語](./README.ja.md) | [简体中文](./README.zh-CN.md)

---

## 主な機能

-   `<img>`および`<source>`タグに`width`と`height`属性を自動で追加します。
-   **開発時** (`serve`): `transformIndexHtml` フックにより、高速に動作します。
-   **ビルド時** (`build`): `closeBundle` フックにより、最終的なHTMLファイルに確実な変更を加えます。
-   `loading="lazy"` 属性をオプションで追加できます。
-   **対応形式:** `sharp`がサポートする多くの画像形式（JPEG, PNG, WebP, GIF, SVGなど）に対応しています。
    -   **注意:** AVIFは、`sharp`が依存する`libvips`のバージョンやビルド環境によって対応状況が異なります。

## インストール

```bash
# npm
npm install vite-plugin-image-sizes sharp --save-dev

# yarn
yarn add vite-plugin-image-sizes sharp --dev

# pnpm
pnpm add -D vite-plugin-image-sizes sharp
```

**重要:** このプラグインは `sharp` をピア依存関係として利用します。必ず一緒にインストールしてください。

## 使い方

`vite.config.ts`にプラグインを追加します。

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import imageSizes from 'vite-plugin-image-sizes';

export default defineConfig({
    plugins: [
        imageSizes({
            addLazyLoading: true, // オプション
        }),
    ],
});
```

### オプション

#### `addLazyLoading`

-   **型:** `boolean`
-   **デフォルト:** `false`

このオプションを`true`に設定すると、`loading`属性を持たない`<img>`タグに対して`loading="lazy"`を追加します。ただし、画像の寸法が正常に取得できた場合に限ります。

## ライセンス

[MIT](./LICENSE) 