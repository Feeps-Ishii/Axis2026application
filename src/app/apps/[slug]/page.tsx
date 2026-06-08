import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam, getTeams } from "@/lib/teams";

export function generateStaticParams() {
  return getTeams().map((t) => ({ slug: t.slug }));
}

export default async function AppHostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = getTeam(slug);

  if (!team) {
    notFound();
  }

  return (
    <div className="flex h-screen flex-col">
      <header
        className="flex items-center gap-4 border-b border-black/10 px-4 py-3 dark:border-white/15"
        style={{ borderBottomColor: team.accent, borderBottomWidth: 3 }}
      >
        <Link
          href="/"
          className="rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          ← ポータルへ戻る
        </Link>
        <div className="min-w-0">
          <p className="truncate text-xs text-black/50 dark:text-white/50">
            {team.name} ／ {team.category}
          </p>
          <h1 className="truncate text-sm font-bold">{team.appName}</h1>
        </div>
      </header>

      {team.ready ? (
        <iframe
          src={`/team-apps/${team.slug}/index.html`}
          title={team.appName}
          className="min-h-0 flex-1 border-0 bg-white"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-lg font-semibold">このチームのアプリはまだ配置されていません</p>
          <p className="max-w-md text-sm text-black/60 dark:text-white/60">
            成果物（HTML / CSS）を
            <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">
              public/team-apps/{team.slug}/
            </code>
            に配置し、
            <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">
              src/data/teams.json
            </code>
            の <code className="font-mono">ready</code> を <code className="font-mono">true</code> にしてください。
          </p>
        </div>
      )}
    </div>
  );
}
