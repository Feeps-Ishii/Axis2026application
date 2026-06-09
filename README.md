# Axis2026application

成果発表用の **チーム成果物まとめポータル** です。
受講生側の環境が動かない場合のフォールバックとして、全9チームの成果物を
講師側で1つのアプリにまとめ、**Vercel にデプロイして** 起動できます。

各チームは Spring Boot（Java + Thymeleaf + DB）で作られていますが、Vercel では Java も
DB も動かせないため、**画面（Thymeleaf テンプレート）を静的 HTML + JavaScript に書き換え、
DB の代わりに JSON データを `localStorage` に載せて擬似的に動かします**
（ブラウザを閉じるまでデータは残り、本物に近い操作感になります）。

Next.js（App Router）+ TypeScript + Tailwind CSS + ESLint で構築されています。

## 仕組み

- **ポータル（`/`）**: `src/data/teams.json` を元に9チーム分のカードを表示します。
- **起動画面（`/apps/<slug>`）**: 各チームのモックを `iframe` で表示します。
  実体は `public/team-apps/<slug>/`（静的 HTML/CSS/JS）です。
- **各チームのモック**: Spring の画面を静的 HTML に変換し、DB アクセスを JavaScript の
  データ層（`localStorage`）に置き換えたものです。

## 見本（teamE：ニシキギ 建設現場管理システム）

`public/team-apps/teamE/` が変換済みの**見本**です。残り8チームはこの構成に倣って作ります。

```
public/team-apps/teamE/
├── data/seed.json   … 受領した SQL（スキーマ＋初期データ）を JSON 化したもの
├── js/db.js         … 擬似データ層（seed を localStorage に投入／クエリ／擬似セッション）
├── css/ images/     … Spring の static からそのままコピー
├── login.html       … ログイン（POST→JS 認証）
├── list.html        … 本社ホーム（現場一覧・優先度分類・通知）
├── home.html        … 現場ホーム（チャット・ステータス）
├── portal.html      … 現場ポータル
├── dailylist/dailyreportdetail/dailyreport.html   … 日報（一覧／詳細／作成・編集）
├── safetylist/safetycheckdetail/safetycheck.html  … 安全点検
└── troublelist/troubledetail/trouble.html         … トラブル
```

変換のポイント（Thymeleaf → 静的）：

- `th:each` → JS で `localStorage` のデータをループ描画
- `th:text` / `th:if` → JS で textContent 設定・表示制御
- `th:href="@{/...}"` → 相対パスの `.html` リンク（例 `./dailylist.html`）
- フォーム POST → JS で `localStorage` に保存し、`location.href` で遷移
- WebSocket チャット → `localStorage` ベースの擬似チャット

## チームを追加する手順

1. 対象チームのリポジトリを取得し、**実装ブランチ**（teamE は `develop`）を確認する。
   ※ `master` が空のスケルトンなことがあるので注意。
2. `src/main/resources/static`（CSS/画像）を `public/team-apps/<slug>/` にコピー。
3. 受領した SQL を `data/seed.json` に変換（スキーマ＝JSON のキー、INSERT＝初期レコード）。
4. `js/db.js` 相当のデータ層を用意（seed 投入・クエリ・セッション）。
5. Thymeleaf テンプレートを上記ポイントに沿って静的 HTML+JS に書き換え。
6. `src/data/teams.json` の該当チームを更新し `ready` を `true` にする。

### 動作確認（任意）

`scripts/teamE-smoke.mjs` は teamE をブラウザで自動クリックして検証する Playwright スクリプトです。
利用する場合のみ Playwright を入れて実行します（デプロイには不要）：

```bash
npm i -D playwright && npx playwright install chromium
PORT=3010 npm run dev &        # 別ターミナルで
node scripts/teamE-smoke.mjs
```

## 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くと表示されます。
`src/app/page.tsx` を編集すると自動でリロードされます。

## 主なコマンド

| コマンド        | 説明                   |
| --------------- | ---------------------- |
| `npm run dev`   | 開発サーバーを起動     |
| `npm run build` | 本番用ビルドを作成     |
| `npm run start` | ビルド済みアプリを起動 |
| `npm run lint`  | ESLint を実行          |

## 構成

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **スタイル**: Tailwind CSS v4
- **ソース**: `src/` ディレクトリ、import エイリアス `@/*`
