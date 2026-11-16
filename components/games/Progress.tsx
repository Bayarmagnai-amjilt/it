'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/components/ui';
import { fill } from '@/lib/errors';
import type { GameId } from '@/lib/games/types';
import { mn } from '@/locales/mn';

// A logged-in student's stars come from the server; a guest's live in this browser.
function useProgress(serverProgress: Record<string, number> | null) {
  const [progress, setProgress] = useState<Record<string, number>>(serverProgress ?? {});
  useEffect(() => {
    if (serverProgress) return;
    try {
      setProgress(JSON.parse(localStorage.getItem('games:progress') ?? '{}') as Record<string, number>);
    } catch {
      setProgress({});
    }
  }, [serverProgress]);
  return progress;
}

export function GameStars({ game, levels, serverProgress }: { game: GameId; levels: number; serverProgress: Record<string, number> | null }) {
  const progress = useProgress(serverProgress);
  let total = 0;
  for (let l = 1; l <= levels; l++) total += progress[`${game}:${l}`] ?? 0;
  return <span className="font-heading text-lg font-bold text-ink-900">★ {fill(mn.games.totalStars, { n: total, total: levels * 3 })}</span>;
}

export function LevelGrid({
  game,
  levels,
  serverProgress,
}: {
  game: GameId;
  levels: { level: number; title: string; concept: string }[];
  serverProgress: Record<string, number> | null;
}) {
  const progress = useProgress(serverProgress);
  return (
    <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {levels.map((l) => {
        const stars = progress[`${game}:${l.level}`] ?? 0;
        const open = l.level === 1 || (progress[`${game}:${l.level - 1}`] ?? 0) > 0;
        const body = (
          <>
            <span className="font-mono text-sm font-bold uppercase text-slate-500">{fill(mn.games.level, { n: l.level })}</span>
            <span className="text-lg font-extrabold text-ink-900">{open ? l.title : '🔒'}</span>
            <span className="mt-auto text-2xl tracking-wider" aria-label={fill(mn.games.stars, { n: stars })}>
              {[1, 2, 3].map((s) => (
                <span key={s} className={s <= stars ? 'text-sun-500' : 'text-ink-200'}>
                  ★
                </span>
              ))}
            </span>
          </>
        );
        const tile = 'flex h-full min-h-32 flex-col gap-1 rounded-2xl border-[3px] border-ink-900 bg-white p-4 shadow-brut-sm';
        return (
          <li key={l.level}>
            {open ? (
              <Link href={`/games/${game}/${l.level}`} className={cn(tile, 'lift hover:bg-sun-50')}>
                {body}
              </Link>
            ) : (
              <div className={cn(tile, 'bg-ink-50 opacity-70')} title={mn.games.locked}>
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
