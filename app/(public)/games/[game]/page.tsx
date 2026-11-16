import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LevelGrid } from '@/components/games/Progress';
import { buttonClass } from '@/components/ui';
import { isGameId, LEVELS } from '@/lib/games/levels';
import { studentGameProgress } from '@/lib/games/progress';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.games.title };
export const dynamic = 'force-dynamic';

export default async function GameLevelsPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!isGameId(game)) notFound();
  const progress = await studentGameProgress();
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900 sm:text-4xl">{mn.games.names[game]}</h1>
          <p className="mt-2 font-semibold text-slate-600">{mn.games.descriptions[game]}</p>
        </div>
        <Link href="/games" className={buttonClass('secondary', 'md')}>
          ← {mn.games.backToGames}
        </Link>
      </div>
      <LevelGrid
        game={game}
        levels={LEVELS[game].map((l) => ({ level: l.level, title: l.title, concept: l.concept }))}
        serverProgress={progress}
      />
    </div>
  );
}
