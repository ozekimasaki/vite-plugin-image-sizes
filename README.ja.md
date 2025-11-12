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

## 要件

- Vite: ^7.0.0
- Node.js: >= 22.12.0

## インストール

```bash
# npm
npm install vite-plugin-image-sizes

# yarn
yarn add vite-plugin-image-sizes

# pnpm
pnpm add -D vite-plugin-image-sizes
```

**重要:**
v1.0.4 以降、`sharp` および `glob` はプラグインに内包されています。
利用者が個別にインストールする必要はありません。

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

## URL解決ルール

- 絶対URL（`/...` または `base` 付き）: ビルド時は出力ルート、開発時はプロジェクトルートから解決します。
- 相対URL（`./`、`../`、ファイル名のみ）: 処理対象の各HTMLファイルが置かれているディレクトリを基準に解決します。
- `publicDir: false` をサポートし、無効時はプロジェクトルートをフォールバックとして利用します。
- ファイル探索時はクエリ（`?`）やハッシュ（`#`）は無視します。

### オプション

#### `addLazyLoading`

-   **型:** `boolean`
-   **デフォルト:** `false`

このオプションを`true`に設定すると、`loading`属性を持たない`<img>`タグに対して`loading="lazy"`を追加します。ただし、画像の寸法が正常に取得できた場合に限ります。

#### `includeTags`

-   **型:** `Array<'img' | 'source'>`
-   **デフォルト:** `['img', 'source']`

寸法を付与する対象タグを指定します。既定では`<img>`と`<source>`の両方が対象です。注意: ブラウザは一般に`<source>`の`width`/`height`を解釈しませんが、マークアップ上の一貫性のために付与します。

#### `concurrency`

-   **型:** `number`
-   **デフォルト:** `8`

画像メタデータ取得の同時実行数を制限します。極端に小さな画像が多数ある場合やマシンリソースに余裕がある場合は増やし、ピークのメモリ/FD使用量を抑えたい場合は減らしてください。

#### `enableCache`

-   **型:** `boolean`
-   **デフォルト:** `true`

同一ファイルに対する寸法取得結果を、開発セッション/ビルド1回の範囲でメモリキャッシュします。複数回出現する画像での重複処理を防ぎます。

## ライセンス

[MIT](./LICENSE) 