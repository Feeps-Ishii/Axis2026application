# Axis2026application

成果発表用の **チーム成果物まとめポータル** です。
受講生側の環境が動かない場合のフォールバックとして、全9チームの成果物（HTML / CSS）を
講師側で1つのアプリにまとめて起動できます。DB は使わず、JSON データを `localStorage` に
保存して擬似的にアプリを動かします（ブラウザを閉じてもデータは残ります）。

Next.js（App Router）+ TypeScript + Tailwind CSS + ESLint で構築されています。

## 仕組み

- **ポータル（`/`）**: `src/data/teams.json` を元に9チーム分のカードを表示します。
- **起動画面（`/apps/<slug>`）**: 各チームの成果物を `iframe` で表示します。
  成果物の実体は `public/team-apps/<slug>/index.html`（静的ファイル）です。
- **共通モックストア（`public/mock/store.js`）**: 各チームの HTML から `<script>` で読み込み、
  JSON データの一覧・追加・更新・削除を `localStorage` 経由で再現します。
  チームごとに名前空間が分かれるためデータは混ざりません。
- **サンプル**: `public/team-apps/team1/`（在庫管理アプリ）が配線済みのテンプレートです。
  新しいチームを追加するときのコピー元として使えます。

## チームの成果物を追加する手順

1. git から取得した成果物（`index.html` と CSS など）を
   `public/team-apps/<slug>/` に置く（例: `public/team-apps/team2/`）。
2. データを擬似的に動かしたい場合は、HTML に共通モックストアを読み込む:
   ```html
   <script src="/mock/store.js"></script>
   <script>
     MockStore.seed('items', [ /* 初期データ */ ]);
     const items = MockStore.list('items');
     MockStore.add('items', { /* ... */ });
   </script>
   ```
   API は `seed / list / get / add / update / remove / saveAll / reset / clearAll`。
   詳細は `public/mock/store.js` の冒頭コメントを参照。
3. `src/data/teams.json` の該当チームの `appName` / `description` / `category` を更新し、
   `ready` を `true` にする（カードに「起動」ボタンが出ます）。

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
