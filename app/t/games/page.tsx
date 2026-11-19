import type { Metadata } from 'next';
import Link from 'next/link';
import { buttonClass, Card, EmptyState, PageHeader, tableClass, tdClass, thClass } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { fill } from '@/lib/errors';
import { GAME_IDS } from '@/lib/games/levels';
import type { GameId } from '@/lib/games/types';
import { displayName } from '@/lib/mn/names';
import { param, type SearchParams } from '@/lib/params';
import { loadClasses, pick } from '@/lib/teacher-data';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.games.teacherTitle };

interface Progress {
  levels: { id: string; game: GameId; level: number; title: string }[];
  students: { student_id: string; first_name: string; family_initial: string | null; stars: Record<string, number> }[];
}

const STAR_CELL = ['', '★', '★★', '★★★'];

export default async function GamesProgressPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireTeacher();
  const sp = await searchParams;
  const classes = await loadClasses(supabase);
  const current = pick(classes, param(sp.class));
  const { data } = current ? await supabase.rpc('class_puzzle_progress', { p_class_id: current.id }) : { data: null };
  const progress = data as Progress | null;

  return (
    <div>
      <PageHeader
        title={mn.games.teacherTitle}
        subtitle={mn.games.teacherHint}
        actions={
          <Link href="/games" target="_blank" className={buttonClass('secondary', 'md')}>
            🧩 {mn.games.tryGames}
          </Link>
        }
      />
      <nav aria-label={mn.games.pickClass} className="mb-6 flex flex-wrap gap-2">
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/t/games?class=${c.id}`}
            className={buttonClass(c.id === current?.id ? 'accent' : 'secondary', 'sm')}
            aria-current={c.id === current?.id ? 'page' : undefined}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      {!progress || progress.students.length === 0 ? (
        <EmptyState title={mn.classes.noStudents} />
      ) : (
        <div className="space-y-6">
          {GAME_IDS.map((game) => {
            const levels = progress.levels.filter((l) => l.game === game);
            return (
              <Card key={game} title={mn.games.names[game]}>
                <div className="overflow-x-auto">
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        <th className={thClass}>{mn.common.name}</th>
                        {levels.map((l) => (
                          <th key={l.id} className={`${thClass} text-center`} title={l.title}>
                            {l.level}
                          </th>
                        ))}
                        <th className={`${thClass} text-right`}>{mn.common.total}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.students.map((s) => {
                        const total = levels.reduce((sum, l) => sum + (s.stars[l.id] ?? 0), 0);
                        return (
                          <tr key={s.student_id}>
                            <td className={`${tdClass} whitespace-nowrap font-semibold text-ink-900`}>{displayName(s)}</td>
                            {levels.map((l) => (
                              <td key={l.id} className={`${tdClass} text-center text-xs text-sun-600`} title={l.title}>
                                {STAR_CELL[s.stars[l.id] ?? 0]}
                              </td>
                            ))}
                            <td className={`${tdClass} text-right font-bold tabular-nums text-ink-900`}>
                              {fill(mn.games.totalStars, { n: total, total: levels.length * 3 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
