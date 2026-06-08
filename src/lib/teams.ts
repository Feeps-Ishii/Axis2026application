import teamsData from "@/data/teams.json";

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
};

const teams = teamsData as Team[];

export function getTeams(): Team[] {
  return teams;
}

export function getTeam(slug: string): Team | undefined {
  return teams.find((t) => t.slug === slug);
}
