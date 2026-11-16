import type { Metadata } from 'next';
import Link from 'next/link';
import { GameStars } from '@/components/games/Progress';
import { buttonClass } from '@/components/ui';
import { getStudentSession } from '@/lib/auth/student';
import { GAME_IDS, LEVELS } from '@/lib/games/levels';
import { studentGameProgress } from '@/lib/games/progress';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.games.title };
export const dynamic = 'force-dynamic';

const ICONS = { maze: '🐴', bird: '🐦', turtle: '🐢' } as const;
const COLORS = { maze: 'bg-sun-100', bird: 'bg-brand-50', turtle: 'bg-mint-100' } as const;

// Anyone can play; a logged-in student's stars and levels are saved.
export default async function GamesPage() {
  const [session, progress] = await Promise.all([getStudentSession(), studentGameProgress()]);
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-900 sm:text-5xl">🧩 {mn.games.title}</h1>
          <p className="mt-2 text-lg font-semibold text-slate-600 sm:text-xl">{mn.games.subtitle}</p>
        </div>
        {session ? (
          <Link href="/s/home" className={buttonClass('secondary', 'md')}>
            ← {mn.common.home}
          </Link>
        ) : null}
      </div>
      <ul className="grid gap-5 md:grid-cols-3">
        {GAME_IDS.map((game) => (
          <li key={game}>
            <Link
              href={`/games/${game}`}
              className={`lift flex h-full flex-col gap-3 rounded-3xl border-[3px] border-ink-900 p-6 shadow-brut ${COLORS[game]}`}
            >
              <span className="text-6xl" aria-hidden="true">{ICONS[game]}</span>
              <span className="text-2xl font-extrabold text-ink-900">{mn.games.names[game]}</span>
              <span className="font-semibold text-slate-700">{mn.games.descriptions[game]}</span>
              <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                <span className="font-bold text-slate-600">{mn.games.levels} · {LEVELS[game].length}</span>
                <GameStars game={game} levels={LEVELS[game].length} serverProgress={progress} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
