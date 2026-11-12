import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/teacher/Flash';
import { LessonButtons } from '@/components/teacher/LessonButtons';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from '@/components/ui';
import { createClass, setClassStatus } from '@/features/classes/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import { ANIMAL_KEYS, animalEmoji, CLASS_COLORS } from '@/lib/constants';
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
  const animals = mn.animals as Record<string, string>;

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
                  <div key={c.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <Link
                      href={`/t/classes/${c.id}`}
                      className="flex items-center gap-3 px-5 py-4 text-white"
                      style={{ backgroundColor: c.color }}
                    >
                      <span className="text-4xl" aria-hidden="true">
                        {animalEmoji(c.animal_icon)}
                      </span>
                      <span className="text-3xl font-extrabold">{c.name}</span>
                      {c.open_lesson_id ? (
                        <span className="ml-auto rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-emerald-800">{mn.lesson.open}</span>
                      ) : null}
                    </Link>
                    <div className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span>{fill(mn.classes.studentCount, { n: c.student_count })}</span>
                        {c.picture_password_enabled ? <Badge tone="info">{mn.classes.picturePasswordOn}</Badge> : null}
                        {c.home_practice_enabled ? <Badge tone="warning">{mn.classes.homePracticeOn}</Badge> : null}
                      </div>
                      <LessonButtons classId={c.id} isOpen={Boolean(c.open_lesson_id)} returnTo="/t/classes" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {archived.length > 0 ? (
              <Card title={mn.classes.archivedTitle}>
                <ul className="divide-y divide-slate-100">
                  {archived.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="font-semibold text-slate-700">
                        {animalEmoji(c.animal_icon)} {c.name}
                      </span>
                      <form action={setClassStatus}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="status" value="active" />
                        <Button type="submit" size="sm" variant="secondary">
                          {mn.classes.restore}
                        </Button>
                      </form>
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
                  <Input name="section" maxLength={2} placeholder="А" required />
                </Field>
              </div>
              <Field label={mn.classes.animal}>
                <Select name="animal_icon" defaultValue="foal">
                  {ANIMAL_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {animalEmoji(key)} {animals[key] ?? key}
                    </option>
                  ))}
                </Select>
              </Field>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold text-slate-700">{mn.classes.color}</legend>
                <div className="flex flex-wrap gap-2">
                  {CLASS_COLORS.map((color, i) => (
                    <label key={color} className="cursor-pointer">
                      <input type="radio" name="color" value={color} defaultChecked={i === 0} className="peer sr-only" />
                      <span
                        className="block h-8 w-8 rounded-full border-2 border-white ring-2 ring-transparent peer-checked:ring-slate-900 peer-focus-visible:ring-brand-500"
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
