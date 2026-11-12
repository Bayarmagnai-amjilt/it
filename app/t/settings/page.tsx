import type { Metadata } from 'next';
import { Flash } from '@/components/teacher/Flash';
import { Alert, Badge, Button, Card, Field, Input, PageHeader, tableClass, tdClass, thClass } from '@/components/ui';
import { createSchoolYear, deleteTerm, saveLessonMinutes, saveTerm, updateSchoolYear } from '@/features/settings/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import type { SearchParams } from '@/lib/params';
import { loadTerms } from '@/lib/teacher-data';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.nav.settings };

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, teacher } = await requireTeacher();
  const sp = await searchParams;
  const [{ year, terms, currentTermId }, { data: minutesRow }, { data: teacherData }] = await Promise.all([
    loadTerms(supabase),
    supabase.from('app_settings').select('value').eq('key', 'lesson_minutes').maybeSingle(),
    supabase.from('teachers').select('id, full_name, email, role, is_active').order('created_at'),
  ]);
  const isOwner = teacher.role === 'owner';
  const lessonMinutes = Number((minutesRow as { value?: unknown } | null)?.value ?? 40) || 40;
  const teachers = (teacherData ?? []) as { id: string; full_name: string; email: string; role: string; is_active: boolean }[];
  const thisYear = new Date().getFullYear();

  return (
    <div>
      <PageHeader title={mn.nav.settings} />
      <Flash params={sp} />
      {!isOwner ? (
        <div className="mb-4">
          <Alert tone="info">{mn.settings.ownerOnly}</Alert>
        </div>
      ) : null}

      <div className="space-y-6">
        <Card title={mn.settings.yearTitle}>
          {year ? (
            <form action={updateSchoolYear} className="grid gap-3 sm:grid-cols-[1fr_11rem_11rem_auto] sm:items-end">
              <input type="hidden" name="id" value={year.id} />
              <Field label={mn.settings.yearName}>
                <Input name="name" defaultValue={year.name} maxLength={30} required disabled={!isOwner} />
              </Field>
              <Field label={mn.settings.startsOn}>
                <Input type="date" name="starts_on" defaultValue={year.starts_on} required disabled={!isOwner} />
              </Field>
              <Field label={mn.settings.endsOn}>
                <Input type="date" name="ends_on" defaultValue={year.ends_on} required disabled={!isOwner} />
              </Field>
              <Button type="submit" disabled={!isOwner}>
                {mn.common.save}
              </Button>
            </form>
          ) : (
            <form action={createSchoolYear} className="grid gap-3 sm:grid-cols-[1fr_11rem_11rem_auto] sm:items-end">
              <Field label={mn.settings.yearName} hint={mn.settings.yearFirstHint}>
                <Input name="name" defaultValue={`${thisYear}-${thisYear + 1}`} maxLength={30} required disabled={!isOwner} />
              </Field>
              <Field label={mn.settings.startsOn}>
                <Input type="date" name="starts_on" defaultValue={`${thisYear}-09-01`} required disabled={!isOwner} />
              </Field>
              <Field label={mn.settings.endsOn}>
                <Input type="date" name="ends_on" defaultValue={`${thisYear + 1}-06-01`} required disabled={!isOwner} />
              </Field>
              <Button type="submit" disabled={!isOwner}>
                {mn.settings.createYear}
              </Button>
            </form>
          )}
        </Card>

        {year ? (
          <Card title={mn.settings.termsTitle}>
            <p className="mb-3 text-sm text-slate-600">{mn.settings.termsHint}</p>
            <div className="space-y-3">
              {terms.map((t) => (
                <div key={t.id} className="flex flex-wrap items-end gap-3 border-b border-slate-100 pb-3">
                  <form action={saveTerm} className="grid flex-1 gap-3 sm:grid-cols-[1fr_11rem_11rem_5rem_auto] sm:items-end">
                    <input type="hidden" name="id" value={t.id} />
                    <Field label={mn.settings.termName}>
                      <Input name="name" defaultValue={t.name} maxLength={30} required disabled={!isOwner} />
                    </Field>
                    <Field label={mn.settings.startsOn}>
                      <Input type="date" name="starts_on" defaultValue={t.starts_on} required disabled={!isOwner} />
                    </Field>
                    <Field label={mn.settings.endsOn}>
                      <Input type="date" name="ends_on" defaultValue={t.ends_on} required disabled={!isOwner} />
                    </Field>
                    <Field label={mn.settings.order}>
                      <Input type="number" name="sort_order" defaultValue={t.sort_order} min={1} max={12} disabled={!isOwner} />
                    </Field>
                    <Button type="submit" variant="secondary" disabled={!isOwner}>
                      {mn.common.save}
                    </Button>
                  </form>
                  <div className="flex items-center gap-2">
                    {t.id === currentTermId ? <Badge tone="success">{mn.settings.currentTerm}</Badge> : null}
                    <form action={deleteTerm}>
                      <input type="hidden" name="id" value={t.id} />
                      <Button type="submit" variant="ghost" size="sm" disabled={!isOwner} aria-label={mn.common.delete}>
                        ✕
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
              <form action={saveTerm} className="grid gap-3 pt-1 sm:grid-cols-[1fr_11rem_11rem_5rem_auto] sm:items-end">
                <input type="hidden" name="school_year_id" value={year.id} />
                <Field label={mn.settings.newTerm}>
                  <Input name="name" placeholder={mn.settings.termPlaceholder} maxLength={30} required disabled={!isOwner} />
                </Field>
                <Field label={mn.settings.startsOn}>
                  <Input type="date" name="starts_on" required disabled={!isOwner} />
                </Field>
                <Field label={mn.settings.endsOn}>
                  <Input type="date" name="ends_on" required disabled={!isOwner} />
                </Field>
                <Field label={mn.settings.order}>
                  <Input type="number" name="sort_order" defaultValue={terms.length + 1} min={1} max={12} disabled={!isOwner} />
                </Field>
                <Button type="submit" disabled={!isOwner}>
                  + {mn.common.add}
                </Button>
              </form>
            </div>
          </Card>
        ) : null}

        <Card title={mn.settings.lessonTitle}>
          <form action={saveLessonMinutes} className="flex flex-wrap items-end gap-3">
            <Field label={mn.settings.lessonMinutes} hint={mn.settings.lessonMinutesHint}>
              <Input type="number" name="lesson_minutes" defaultValue={lessonMinutes} min={10} max={180} required disabled={!isOwner} className="w-32" />
            </Field>
            <Button type="submit" disabled={!isOwner}>
              {mn.common.save}
            </Button>
          </form>
        </Card>

        <Card title={mn.settings.teachersTitle}>
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>{mn.common.name}</th>
                  <th className={thClass}>{mn.teacherAuth.email}</th>
                  <th className={thClass}>{mn.settings.role}</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id}>
                    <td className={`${tdClass} font-semibold`}>{t.full_name}</td>
                    <td className={tdClass}>{t.email}</td>
                    <td className={tdClass}>
                      <Badge tone={t.role === 'owner' ? 'info' : 'neutral'}>{t.role === 'owner' ? mn.nav.owner : mn.settings.teacherRole}</Badge>{' '}
                      {!t.is_active ? <Badge tone="warning">{mn.settings.inactive}</Badge> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">{mn.settings.teachersHint}</p>
        </Card>
      </div>
    </div>
  );
}
