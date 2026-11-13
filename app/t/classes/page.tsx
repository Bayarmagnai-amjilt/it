import type { Metadata } from 'next';
import Link from 'next/link';
import { ClassLogo } from '@/components/ClassLogo';
import { DeleteClassForm } from '@/components/teacher/DeleteClassForm';
import { Flash } from '@/components/teacher/Flash';
import { LessonButtons } from '@/components/teacher/LessonButtons';
import { LogoPicker } from '@/components/teacher/LogoPicker';
import { Alert, Badge, Button, buttonClass, Card, EmptyState, Field, PageHeader, Select } from '@/components/ui';
import { createClass, setClassStatus } from '@/features/classes/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import { CLASS_COLORS, CLASS_SECTIONS, isLogoUrl } from '@/lib/constants';
import { fill } from '@/lib/errors';
import type { SearchParams } from '@/lib/params';
import { loadClasses, loadTerms } from '@/lib/teacher-data';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.nav.classes };

export default async function ClassesPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireTeacher();
  const sp = await searchParams;
  const [all, { year }] = await Promise.all([loadClasses(supabase, true), loadTerms(supabase)]);
  const active = all.filter((c) => c.status === 'active');
  const archived = all.filter((c) => c.status === 'archived');

  return (
    <div>
      <PageHeader title={mn.nav.classes} subtitle={year ? fill(mn.classes.yearSubtitle, { year: year.name }) : undefined} />
      <Flash params={sp} />
      {!year ? (
        <Alert tone="warning">
          {mn.dashboard.noYear}{' '}
          <Link href="/t/settings" className="font-bold underline">
            {mn.nav.settings}
          </Link>
        </Alert>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            {active.length === 0 ? (
              <EmptyState title={mn.classes.empty} hint={mn.classes.emptyHint} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {active.map((c) => (
                  <div key={c.id} className="overflow-hidden rounded-2xl border-[3px] border-ink-900 bg-white shadow-brut">
                    <Link
                      href={`/t/classes/${c.id}`}
                      className="flex items-center gap-3 border-b-[3px] border-ink-900 px-5 py-4 text-white [text-shadow:0_2px_0_rgb(0_0_0/0.2)]"
                      style={{ backgroundColor: c.color }}
                    >
                      {isLogoUrl(c.animal_icon) ? (
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-ink-900 bg-white text-3xl">
                          <ClassLogo icon={c.animal_icon} />
                        </span>
                      ) : null}
                      <span className="font-heading text-3xl font-bold">{c.name}</span>
                      {c.open_lesson_id ? (
                        <span className="ml-auto rounded-lg border-2 border-ink-900 bg-mint-200 px-2 py-0.5 text-xs font-extrabold text-ink-900 [text-shadow:none]">
                          {mn.lesson.open}
                        </span>
                      ) : null}
                    </Link>
                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
                        <span>{fill(mn.classes.studentCount, { n: c.student_count })}</span>
                        {c.picture_password_enabled ? <Badge tone="info">{mn.classes.picturePasswordOn}</Badge> : null}
                        {c.home_practice_enabled ? <Badge tone="warning">{mn.classes.homePracticeOn}</Badge> : null}
                      </div>
                      <LessonButtons classId={c.id} isOpen={Boolean(c.open_lesson_id)} returnTo="/t/classes" />
                      <DeleteDisclosure classId={c.id} name={c.name} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {archived.length > 0 ? (
              <Card title={mn.classes.archivedTitle}>
                <ul className="divide-y-2 divide-dashed divide-ink-100">
                  {archived.map((c) => (
                    <li key={c.id} className="py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-slate-700">
                          <ClassLogo icon={c.animal_icon} /> {c.name}
                        </span>
                        <form action={setClassStatus}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="status" value="active" />
                          <Button type="submit" size="sm" variant="secondary">
                            {mn.classes.restore}
                          </Button>
                        </form>
                      </div>
                      <DeleteDisclosure classId={c.id} name={c.name} />
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>

          <Card title={mn.classes.create}>
            <form action={createClass} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label={mn.classes.grade}>
                  <Select name="grade" defaultValue="1" required>
                    {[1, 2, 3, 4, 5].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={mn.classes.section} hint={mn.classes.sectionHint}>
                  <Select name="section" defaultValue="1" required>
                    {CLASS_SECTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <LogoPicker />
              <fieldset>
                <legend className="mb-1 text-sm font-bold text-ink-900">{mn.classes.color}</legend>
                <div className="flex flex-wrap gap-2">
                  {CLASS_COLORS.map((color, i) => (
                    <label key={color} className="cursor-pointer">
                      <input type="radio" name="color" value={color} defaultChecked={i === 0} className="peer sr-only" />
                      <span
                        className="block h-9 w-9 rounded-xl border-2 border-ink-900 ring-offset-2 peer-checked:shadow-brut-sm peer-checked:ring-2 peer-checked:ring-ink-900 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" className="w-full">
                {mn.classes.create}
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

/** "Delete class" under each class; it opens the confirmation instead of deleting at once. */
function DeleteDisclosure({ classId, name }: { classId: string; name: string }) {
  return (
    <details className="group border-t-2 border-dashed border-ink-100 pt-3">
      <summary className={buttonClass('danger', 'sm', 'cursor-pointer list-none [&::-webkit-details-marker]:hidden')}>
        <span aria-hidden="true">🗑</span> {mn.classes.deleteTitle}
        <span aria-hidden="true" className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="pt-3">
        <DeleteClassForm classId={classId} name={name} returnTo="/t/classes" />
      </div>
    </details>
  );
}
