import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GamePlayer } from '@/components/games/GamePlayer';
import { buttonClass } from '@/components/ui';
import { fill } from '@/lib/errors';
import { findLevel, isGameId, LEVELS } from '@/lib/games/levels';
import { studentGameProgress } from '@/lib/games/progress';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.games.title };
export const dynamic = 'force-dynamic';

export default async function GameLevelPage({ params }: { params: Promise<{ game: string; level: string }> }) {
  const { game, level: levelParam } = await params;
  if (!isGameId(game) || !/^\d{1,2}$/.test(levelParam)) notFound();
  const level = findLevel(game, Number(levelParam));
  if (!level) notFound();
  const progress = await studentGameProgress();
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">
          {mn.games.names[game]} · {fill(mn.games.level, { n: level.level })}: {level.title}
        </h1>
        <Link href={`/games/${game}`} className={buttonClass('secondary', 'md')}>
          ← {mn.games.backToLevels}
        </Link>
      </div>
      <GamePlayer key={`${game}-${level.level}`} level={level} total={LEVELS[game].length} serverProgress={progress} />
    </div>
  );
}
