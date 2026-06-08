export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="rounded-full border border-black/10 px-3 py-1 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
          Next.js + TypeScript + Tailwind CSS
        </span>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Axis 2026 へようこそ
        </h1>
        <p className="max-w-xl text-base text-black/70 dark:text-white/70">
          Next.js アプリのひな型を用意しました。
          <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 font-mono text-sm dark:bg-white/10">
            src/app/page.tsx
          </code>
          を編集して開発を始めましょう。
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <a
          href="https://nextjs.org/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          ドキュメントを見る
        </a>
        <a
          href="https://nextjs.org/learn"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-black/10 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
        >
          チュートリアル
        </a>
      </div>
    </main>
  );
}
