# Axis2026application

Next.js（App Router）+ TypeScript + Tailwind CSS + ESLint で構築されたアプリです。

## 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くと表示されます。
`src/app/page.tsx` を編集すると自動でリロードされます。

## 主なコマンド

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番用ビルドを作成 |
| `npm run start` | ビルド済みアプリを起動 |
| `npm run lint` | ESLint を実行 |

## 構成

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイル**: Tailwind CSS v4
- **ソース**: `src/` ディレクトリ、import エイリアス `@/*`
