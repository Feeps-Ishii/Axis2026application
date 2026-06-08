import Link from "next/link";
import { getTeams } from "@/lib/teams";

export default function Home() {
  const teams = getTeams();
  const readyCount = teams.filter((t) => t.ready).length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium text-black/50 dark:text-white/50">
          成果発表ポータル
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          Axis 2026 チーム成果物
        </h1>
        <p className="mt-3 max-w-2xl text-black/70 dark:text-white/70">
          全{teams.length}チームの成果物を講師側でまとめた起動ポータルです。
          各カードの「起動」から擬似アプリ（JSON + localStorage モック）を開きます。
          現在 {readyCount} / {teams.length} チーム配置済み。
        </p>
      </header>

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <li key={team.slug}>
            <div
              className="flex h-full flex-col rounded-2xl border border-black/10 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-white/15 dark:bg-white/[0.03]"
              style={{ borderTopColor: team.accent, borderTopWidth: 4 }}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-black/60 dark:text-white/60">
                  {team.name}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${team.accent}1a`, color: team.accent }}
                >
                  {team.category}
                </span>
              </div>

              <h2 className="text-lg font-bold leading-snug">{team.appName}</h2>
              <p className="mt-2 flex-1 text-sm text-black/65 dark:text-white/65">
                {team.description}
              </p>

              <div className="mt-5">
                {team.ready ? (
                  <Link
                    href={`/apps/${team.slug}`}
                    className="inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: team.accent }}
                  >
                    起動する
                  </Link>
                ) : (
                  <span className="inline-flex w-full items-center justify-center rounded-full border border-dashed border-black/20 px-4 py-2.5 text-sm font-medium text-black/40 dark:border-white/20 dark:text-white/40">
                    未配置
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
