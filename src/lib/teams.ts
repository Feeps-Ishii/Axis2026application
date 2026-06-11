import teamsData from "@/data/teams.json";

/** 詳細画面に並べる企業データ（設立年・従業員数・店舗数 など）。 */
export type CompanyFact = {
  /** 見出し（例: 設立 / 従業員数） */
  label: string;
  /** 値（例: 2018年 / 約120名） */
  value: string;
};

/** カードを開いた先で紹介する「モデル企業」の情報。 */
export type ModelCompany = {
  /** モデル企業名（例: ことのは書房） */
  name: string;
  /** 業種（例: 書籍小売） */
  industry: string;
  /** キャッチコピー（任意） */
  tagline?: string;
  /** 企業概要（数行の紹介文） */
  overview: string;
  /** 企業が抱える課題（任意） */
  challenges?: string[];
  /** このアプリが提供する価値・解決策（任意） */
  solution?: string;
  /** 企業データのハイライト（任意） */
  facts?: CompanyFact[];
};

export type Team = {
  /** URL に使うスラッグ。public/team-apps/<slug>/ と対応します。 */
  slug: string;
  /** グループ名（例: グループ1） */
  name: string;
  /** アプリ名（例: 在庫管理アプリ） */
  appName: string;
  /** カードに表示する説明 */
  description: string;
  /** ジャンル（例: 業務系 / ツール / ゲーム など） */
  category: string;
  /** カードのアクセントカラー（CSS カラー文字列） */
  accent: string;
  /** 成果物を配置済みか。false の場合は「未配置」と表示します。 */
  ready: boolean;
  /** iframe で最初に開くファイル名。省略時は index.html。 */
  entry?: string;
  /** モデル企業の情報。未設定のチームは詳細画面で「準備中」と表示します。 */
  company?: ModelCompany;
};

const teams = teamsData as Team[];

export function getTeams(): Team[] {
  return teams;
}

export function getTeam(slug: string): Team | undefined {
  return teams.find((t) => t.slug === slug);
}
