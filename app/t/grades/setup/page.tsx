import type { Metadata } from 'next';
import Link from 'next/link';
import { ClassTermForm } from '@/components/teacher/ClassTermForm';
import { ComponentsEditor } from '@/components/teacher/ComponentsEditor';
import { Flash } from '@/components/teacher/Flash';
import { Button, buttonClass, Card, EmptyState, Field, Input, PageHeader, Select, tableClass, tdClass, thClass } from '@/components/ui';
import { copyComponents, saveBands } from '@/features/grading/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import { param, type SearchParams } from '@/lib/params';
import { loadClasses, loadTerms, pick } from '@/lib/teacher-data';
import type { GradeComponentRow } from '@/lib/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.grades.setupLink };

interface Band {
  id: string;
  min_percent: number;
  letter: string;
  teacher_label: string;
  stars: number;
  student_message: string;
}

export default async function GradeSetupPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, teacher } = await requireTeacher();
  const sp = await searchParams;
  const [classes, { terms, currentTermId }] = await Promise.all([loadClasses(supabase), loadTerms(supabase)]);
  const cls = pick(classes, param(sp.class));
  const term = pick(terms, param(sp.term), currentTermId);

  if (!cls || !term) {
    return (
      <div>
        <PageHeader title={mn.grades.setupLink} />
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

  const [{ data: componentData }, { data: bandData }] = await Promise.all([
    supabase.from('grade_components').select('*').eq('class_id', cls.id).eq('term_id', term.id).order('sort_order'),
    supabase.from('grade_scale_bands').select('*').is('class_id', null).order('min_percent', { ascending: false }),
  ]);
  const components = (componentData ?? []) as GradeComponentRow[];
  const bands = (bandData ?? []) as Band[];

  let lockedIds: string[] = [];
  if (components.length > 0) {
    const { data } = await supabase.from('grade_items').select('component_id').in('component_id', components.map((c) => c.id));
    lockedIds = [...new Set(((data ?? []) as { component_id: string }[]).map((r) => r.component_id))];
  }
  const others = classes.filter((c) => c.id !== cls.id);
  const here = `/t/grades/setup?class=${cls.id}&term=${term.id}`;
  const isOwner = teacher.role === 'owner';

  return (
    <div>
      <PageHeader
        title={mn.grades.setupLink}
        subtitle={`${cls.name} · ${term.name}`}
        actions={
          <Link href={`/t/grades?class=${cls.id}&term=${term.id}`} className={buttonClass('secondary')}>
            ← {mn.nav.grades}
          </Link>
        }
      />
      <Flash params={sp} />

      <Card className="mb-6">
        <ClassTermForm classes={classes} terms={terms} classId={cls.id} termId={term.id} />
      </Card>

      <div className="space-y-6">
        <Card title={mn.grades.setup.title}>
          <p className="mb-4 text-sm text-slate-600">{mn.grades.setup.hint}</p>
          {/* key: switching class or term starts the editor from that setup */}
          <ComponentsEditor
            key={`${cls.id}-${term.id}-${components.map((c) => c.id).join('.')}`}
            classId={cls.id}
            termId={term.id}
            initial={components.map((c) => ({
              id: c.id,
              name: c.name,
              weight: Number(c.weight),
              source: c.source,
              missing_policy: c.missing_policy,
            }))}
            lockedIds={lockedIds}
          />
        </Card>

        {others.length > 0 ? (
          <Card title={mn.grades.setup.copyTitle}>
            <p className="mb-3 text-sm text-slate-600">{mn.grades.setup.copyHint}</p>
            <form action={copyComponents} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="to_class_id" value={cls.id} />
              <input type="hidden" name="term_id" value={term.id} />
              <Field label={mn.grades.setup.copyFrom}>
                <Select name="from_class_id" required defaultValue="" className="w-32">
                  <option value="" disabled>
                    —
                  </option>
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" variant="secondary">
                {mn.grades.setup.copyButton}
              </Button>
            </form>
          </Card>
        ) : null}

        <Card title={mn.grades.bands.title}>
          <p className="mb-3 text-sm text-slate-600">{isOwner ? mn.grades.bands.hint : mn.grades.bands.ownerOnly}</p>
          <form action={saveBands}>
            <input type="hidden" name="return_to" value={here} />
            <input type="hidden" name="count" value={bands.length} />
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th className={thClass}>{mn.grades.letter}</th>
                    <th className={thClass}>{mn.grades.bands.from}</th>
                    <th className={thClass}>{mn.grades.bands.teacherLabel}</th>
                    <th className={thClass}>{mn.grades.bands.stars}</th>
                    <th className={thClass}>{mn.grades.bands.studentMessage}</th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((b, i) => (
                    <tr key={b.id}>
                      <td className={`${tdClass} text-lg font-extrabold`}>
                        {b.letter}
                        <input type="hidden" name={`letter_${i}`} value={b.letter} />
                        <input type="hidden" name={`stars_${i}`} value={b.stars} />
                      </td>
                      <td className={tdClass}>
                        <Input
                          type="number"
                          name={`min_${i}`}
                          min={0}
                          max={100}
                          step="any"
                          defaultValue={Number(b.min_percent)}
                          disabled={!isOwner}
                          className="w-24 text-right"
                          aria-label={`${b.letter} — ${mn.grades.bands.from}`}
                        />
                      </td>
                      <td className={tdClass}>
                        <Input name={`label_${i}`} defaultValue={b.teacher_label} maxLength={30} disabled={!isOwner} aria-label={`${b.letter} — ${mn.grades.bands.teacherLabel}`} />
                      </td>
                      <td className={`${tdClass} whitespace-nowrap`} aria-label={String(b.stars)}>
                        {'★'.repeat(b.stars)}
                        <span className="text-slate-300">{'★'.repeat(5 - b.stars)}</span>
                      </td>
                      <td className={tdClass}>
                        <Input name={`message_${i}`} defaultValue={b.student_message} maxLength={60} disabled={!isOwner} aria-label={`${b.letter} — ${mn.grades.bands.studentMessage}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isOwner ? (
              <div className="mt-4">
                <Button type="submit">{mn.common.save}</Button>
              </div>
            ) : null}
          </form>
        </Card>
      </div>
    </div>
  );
}
