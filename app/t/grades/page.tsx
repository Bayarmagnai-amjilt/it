import type { Metadata } from 'next';
import Link from 'next/link';
import { ClassTermForm } from '@/components/teacher/ClassTermForm';
import { Flash } from '@/components/teacher/Flash';
import { ScoreGrid } from '@/components/teacher/ScoreGrid';
import { Alert, Badge, Button, buttonClass, Card, EmptyState, Field, Input, PageHeader, tableClass, tdClass, thClass, thRightClass } from '@/components/ui';
import { createGradeItem, deleteGradeItem } from '@/features/grading/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import { isUuid, LOW_PERCENT } from '@/lib/constants';
import { fill } from '@/lib/errors';
import { formatDate, formatPercent, todayISO } from '@/lib/mn/dates';
import { displayName, sortByName } from '@/lib/mn/names';
import { param, type SearchParams } from '@/lib/params';
import { loadClasses, loadTerms, pick } from '@/lib/teacher-data';
import type { GradeComponentRow, GradeItemSheet, TermGradeRow } from '@/lib/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.nav.grades };

interface Item {
  id: string;
  component_id: string;
  title: string;
  max_score: number;
  held_on: string | null;
}

export default async function GradesPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireTeacher();
  const sp = await searchParams;
  const [classes, { terms, currentTermId }] = await Promise.all([loadClasses(supabase), loadTerms(supabase)]);
  const cls = pick(classes, param(sp.class));
  const term = pick(terms, param(sp.term), currentTermId);

  if (!cls || !term) {
    return (
      <div>
        <PageHeader title={mn.nav.grades} />
        <EmptyState
          title={!cls ? mn.classes.empty : mn.dashboard.noTerms}
          action={
            <Link href={!cls ? '/t/classes' : '/t/settings'} className={buttonClass('primary')}>
              {!cls ? mn.classes.create : mn.nav.settings}
            </Link>
          }
        />
      </div>
    );
  }

  const base = `/t/grades?class=${cls.id}&term=${term.id}`;
  const itemId = param(sp.item);
  const [{ data: gradeData, error: gradeError }, { data: componentData }, sheetResult] = await Promise.all([
    supabase.rpc('term_grades', { p_class_id: cls.id, p_term_id: term.id }),
    supabase.from('grade_components').select('*').eq('class_id', cls.id).eq('term_id', term.id).order('sort_order'),
    isUuid(itemId) ? supabase.rpc('grade_item_sheet', { p_grade_item_id: itemId }) : Promise.resolve({ data: null }),
  ]);
  const grades = sortByName((gradeData ?? []) as TermGradeRow[]);
  const components = (componentData ?? []) as GradeComponentRow[];
  const sheet = sheetResult.data as GradeItemSheet | null;

  let items: Item[] = [];
  if (components.length > 0) {
    const { data } = await supabase
      .from('grade_items')
      .select('id, component_id, title, max_score, held_on')
      .in('component_id', components.map((c) => c.id))
      .order('held_on')
      .order('created_at');
    items = (data ?? []) as Item[];
  }
  const scorable = components.filter((c) => c.source !== 'attendance');
  const partial = grades.some((g) => g.weight_covered > 0 && g.weight_covered < 100);
  const low = (v: number | null) => v !== null && v < LOW_PERCENT;

  return (
    <div>
      <PageHeader
        title={mn.nav.grades}
        subtitle={`${cls.name} · ${term.name}`}
        actions={
          <>
            <Link href={`/t/grades/setup?class=${cls.id}&term=${term.id}`} className={buttonClass('secondary')}>
              {mn.grades.setupLink}
            </Link>
            <a href={`/api/export/grades?class=${cls.id}&term=${term.id}`} className={buttonClass('primary')}>
              ⬇ Excel
            </a>
          </>
        }
      />
      <Flash params={sp} />

      <Card className="mb-6">
        <ClassTermForm classes={classes} terms={terms} classId={cls.id} termId={term.id} />
      </Card>

      {components.length === 0 ? (
        <EmptyState
          title={mn.grades.noSetup}
          hint={mn.grades.noSetupHint}
          action={
            <Link href={`/t/grades/setup?class=${cls.id}&term=${term.id}`} className={buttonClass('primary')}>
              {mn.grades.setupLink}
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {sheet?.item ? (
            <Card
              title={`${sheet.item.component_name} · ${sheet.item.title}`}
              actions={
                <>
                  <Badge>{fill(mn.grades.maxScoreN, { max: sheet.item.max_score })}</Badge>
                  <Link href={base} className={buttonClass('ghost', 'sm')}>
                    {mn.common.close} ✕
                  </Link>
                </>
              }
              className="ring-2 ring-brand-300"
            >
              <ScoreGrid key={sheet.item.id} itemId={sheet.item.id} maxScore={Number(sheet.item.max_score)} rows={sortByName(sheet.rows)} />
            </Card>
          ) : null}

          <Card title={mn.grades.tableTitle}>
            {gradeError ? (
              <Alert tone="error">{mn.errors.generic}</Alert>
            ) : grades.length === 0 ? (
              <p className="text-sm text-slate-600">{mn.classes.noStudents}</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className={tableClass}>
                    <thead>
                      <tr>
                        <th className={thClass}>№</th>
                        <th className={thClass}>{mn.common.name}</th>
                        {components.map((c) => (
                          <th key={c.id} className={thRightClass}>
                            {c.name}
                            <span className="block text-xs font-normal text-slate-500">{formatPercent(Number(c.weight))}%</span>
                          </th>
                        ))}
                        <th className={thRightClass}>{mn.grades.final}</th>
                        <th className={thClass}>{mn.grades.letter}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((g, i) => (
                        <tr key={g.student_id}>
                          <td className={`${tdClass} w-10 tabular-nums text-slate-500`}>{i + 1}</td>
                          <td className={`${tdClass} whitespace-nowrap font-semibold`}>
                            <Link href={`/t/students/${g.student_id}`} className="hover:underline">
                              {displayName(g)}
                            </Link>
                          </td>
                          {components.map((c) => {
                            const value = g.components.find((x) => x.component_id === c.id)?.percent ?? null;
                            return (
                              <td key={c.id} className={`${tdClass} text-right tabular-nums ${low(value) ? 'bg-red-50 font-bold text-red-700' : ''}`}>
                                {value === null ? <span className="text-slate-300">—</span> : formatPercent(value)}
                              </td>
                            );
                          })}
                          <td className={`${tdClass} text-right text-base font-extrabold tabular-nums ${low(g.final_percent) ? 'bg-red-50 text-red-700' : ''}`}>
                            {g.final_percent === null ? '—' : `${formatPercent(g.final_percent)}%`}
                            {g.weight_covered > 0 && g.weight_covered < 100 ? (
                              <span className="block text-[10px] font-normal text-slate-500">
                                {fill(mn.grades.coverage, { n: formatPercent(Number(g.weight_covered)) })}
                              </span>
                            ) : null}
                          </td>
                          <td className={tdClass}>
                            {g.letter ? (
                              <span className="whitespace-nowrap">
                                <span className="font-extrabold">{g.letter}</span>{' '}
                                <span className="text-slate-600">{g.teacher_label}</span>
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {partial ? <p className="mt-3 text-xs text-slate-500">{mn.grades.partialNote}</p> : null}
              </>
            )}
          </Card>

          <Card title={mn.grades.itemsTitle}>
            {scorable.length === 0 ? (
              <p className="text-sm text-slate-600">{mn.grades.noScorable}</p>
            ) : (
              <div className="space-y-6">
                {scorable.map((c) => {
                  const own = items.filter((it) => it.component_id === c.id);
                  return (
                    <div key={c.id}>
                      <h3 className="mb-2 flex items-center gap-2 font-bold text-slate-900">
                        {c.name} <Badge>{mn.sources[c.source]}</Badge>
                      </h3>
                      {own.length === 0 ? (
                        <p className="text-sm text-slate-500">{mn.grades.noItems}</p>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {own.map((it) => (
                            <li key={it.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                              <span>
                                <span className="font-semibold">{it.title}</span>{' '}
                                <span className="text-slate-500">
                                  · {fill(mn.grades.maxScoreN, { max: it.max_score })}
                                  {it.held_on ? ` · ${formatDate(it.held_on)}` : ''}
                                </span>
                              </span>
                              <span className="flex items-center gap-2">
                                <Link href={`${base}&item=${it.id}`} className={buttonClass(itemId === it.id ? 'primary' : 'secondary', 'sm')}>
                                  {mn.grades.enterScores}
                                </Link>
                                <form action={deleteGradeItem}>
                                  <input type="hidden" name="class_id" value={cls.id} />
                                  <input type="hidden" name="term_id" value={term.id} />
                                  <input type="hidden" name="item_id" value={it.id} />
                                  <Button type="submit" size="sm" variant="ghost" aria-label={mn.common.delete} title={mn.grades.deleteItemHint}>
                                    ✕
                                  </Button>
                                </form>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <form action={createGradeItem} className="mt-3 grid gap-2 sm:grid-cols-[1fr_7rem_11rem_auto] sm:items-end">
                        <input type="hidden" name="class_id" value={cls.id} />
                        <input type="hidden" name="term_id" value={term.id} />
                        <input type="hidden" name="component_id" value={c.id} />
                        <Field label={mn.grades.itemTitle}>
                          <Input name="title" maxLength={80} required />
                        </Field>
                        <Field label={mn.grades.maxScore}>
                          <Input type="number" name="max_score" min={1} max={1000} step="any" defaultValue={10} required />
                        </Field>
                        <Field label={mn.common.date}>
                          <Input type="date" name="held_on" defaultValue={todayISO()} />
                        </Field>
                        <Button type="submit" variant="secondary">
                          + {mn.grades.addItem}
                        </Button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
