import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeam, getTeams } from "@/lib/teams";

export function generateStaticParams() {
  return getTeams().map((t) => ({ slug: t.slug }));
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const team = getTeam(slug);

  if (!team) {
    notFound();
  }

  const company = team.company;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
      >
        ← ポータルへ戻る
      </Link>

      {/* ヒーロー：チーム情報とモデル企業名 */}
      <section
        className="mt-6 rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/15 dark:bg-white/[0.03]"
        style={{ borderTopColor: team.accent, borderTopWidth: 4 }}
      >
        <div className="flex items-center gap-3">
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

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
          モデル企業
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          {company?.name ?? "（モデル企業 準備中）"}
        </h1>
        {company?.tagline && (
          <p
            className="mt-2 text-lg font-medium"
            style={{ color: team.accent }}
          >
            {company.tagline}
          </p>
        )}
        <p className="mt-3 text-sm text-black/60 dark:text-white/60">
          {company?.industry ? `業種：${company.industry}` : null}
        </p>
        <p className="mt-4 text-sm text-black/55 dark:text-white/55">
          成果物アプリ：<span className="font-semibold">{team.appName}</span>
        </p>
      </section>

      {company ? (
        <>
          {/* 企業概要 */}
          <Section title="企業概要" accent={team.accent}>
            <p className="text-sm leading-relaxed text-black/75 dark:text-white/75">
              {company.overview}
            </p>
          </Section>

          {/* 企業データ */}
          {company.facts && company.facts.length > 0 && (
            <Section title="企業データ" accent={team.accent}>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {company.facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/15 dark:bg-white/[0.03]"
                  >
                    <dt className="text-xs font-medium text-black/50 dark:text-white/50">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-base font-bold">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}

          {/* 課題 */}
          {company.challenges && company.challenges.length > 0 && (
            <Section title="抱える課題" accent={team.accent}>
              <ul className="space-y-2">
                {company.challenges.map((c, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm leading-relaxed text-black/75 dark:text-white/75"
                  >
                    <span style={{ color: team.accent }}>●</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* このアプリによる解決 */}
          {company.solution && (
            <Section title="このアプリが提供する価値" accent={team.accent}>
              <p className="text-sm leading-relaxed text-black/75 dark:text-white/75">
                {company.solution}
              </p>
            </Section>
          )}
        </>
      ) : (
        <Section title="モデル企業情報" accent={team.accent}>
          <p className="text-sm text-black/60 dark:text-white/60">
            このチームのモデル企業情報は準備中です。
            <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">
              src/data/teams.json
            </code>
            の該当チームに <code className="font-mono">company</code>{" "}
            を追記してください。
          </p>
        </Section>
      )}

      {/* 起動ボタン */}
      <div className="mt-10 flex flex-col items-center gap-3 border-t border-black/10 pt-8 dark:border-white/15">
        {team.ready ? (
          <>
            <Link
              href={`/apps/${team.slug}`}
              className="inline-flex w-full max-w-sm items-center justify-center rounded-full px-6 py-3.5 text-base font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: team.accent }}
            >
              アプリを起動する
            </Link>
          </>
        ) : (
          <span className="inline-flex w-full max-w-sm items-center justify-center rounded-full border border-dashed border-black/20 px-6 py-3.5 text-base font-medium text-black/40 dark:border-white/20 dark:text-white/40">
            アプリ未配置
          </span>
        )}
      </div>
    </main>
  );
}

/** 詳細画面のセクション見出し付きブロック。 */
function Section({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span
          className="inline-block h-5 w-1.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
        {title}
      </h2>
      {children}
    </section>
  );
}
