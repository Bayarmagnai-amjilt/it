import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/teacher/Flash';
import { LessonButtons } from '@/components/teacher/LessonButtons';
import { Badge, Button, buttonClass, Card, EmptyState, Field, Input, PageHeader, Select, tableClass, tdClass, thClass } from '@/components/ui';
import {
  addScheduleSlot,
  addStudent,
  deleteScheduleSlot,
  kickAllStudents,
  removeStudent,
  resetPicturePassword,
  setClassStatus,
  transferStudent,
  updateClassSettings,
} from '@/features/classes/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import { ANIMAL_KEYS, animalEmoji, CLASS_COLORS, isUuid } from '@/lib/constants';
import { fill } from '@/lib/errors';
import { formatTime } from '@/lib/mn/dates';
import { displayName, sortByName } from '@/lib/mn/names';
import type { SearchParams } from '@/lib/params';
import { loadClasses } from '@/lib/teacher-data';
import type { RosterStudent } from '@/lib/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.nav.classes };

interface ClassRow {
  id: string;
  name: string;
  grade: number;
  color: string;
  animal_icon: string;
  status: 'active' | 'archived';
  class_code: string;
  homeroom_teacher_name: string | null;
  picture_password_enabled: boolean;
  home_practice_enabled: boolean;
  late_after_minutes: number;
  late_coefficient: number;
  excused_policy: 'exclude' | 'count_present';
}

interface Slot {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
}

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireTeacher();

  const [{ data: classData }, { data: rosterData }, { data: slotData }, classes] = await Promise.all([
    supabase.from('classes').select('*').eq('id', id).maybeSingle(),
    supabase.rpc('class_roster', { p_class_id: id }),
    supabase.from('class_schedule_slots').select('id, weekday, starts_at, ends_at').eq('class_id', id).order('weekday').order('starts_at'),
    loadClasses(supabase),
  ]);
  const cls = classData as ClassRow | null;
  if (!cls) notFound();

  const roster = sortByName((rosterData ?? []) as RosterStudent[]);
  const slots = (slotData ?? []) as Slot[];
  const isOpen = Boolean(classes.find((c) => c.id === id)?.open_lesson_id);
  const others = classes.filter((c) => c.id !== id);
  const online = roster.filter((s) => s.online).length;
  const back = `/t/classes/${id}`;
  const animals = mn.animals as Record<string, string>;

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
              style={{ backgroundColor: cls.color }}
              aria-hidden="true"
            >
              {animalEmoji(cls.animal_icon)}
            </span>
            {cls.name}
            {isOpen ? <Badge tone="success">{mn.lesson.open}</Badge> : null}
            {cls.status === 'archived' ? <Badge tone="warning">{mn.classes.archived}</Badge> : null}
          </span>
        }
        subtitle={fill(mn.classes.detailSubtitle, { n: roster.length, online })}
        actions={
          <>
            <LessonButtons classId={id} isOpen={isOpen} returnTo={back} />
            <form action={kickAllStudents}>
              <input type="hidden" name="class_id" value={id} />
              <input type="hidden" name="return_to" value={back} />
              <Button type="submit" size="sm" variant="secondary" disabled={online === 0}>
                {mn.lesson.kickAll}
              </Button>
            </form>
          </>
        }
      />
      <Flash params={sp} />

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        {/* ---- students ---- */}
        <div className="space-y-6">
          <Card
            title={mn.common.students}
            actions={
              <Link href={`/t/students/import?class=${id}`} className={buttonClass('secondary', 'sm')}>
                {mn.importPage.title}
              </Link>
            }
          >
            {roster.length === 0 ? (
              <EmptyState title={mn.classes.noStudents} hint={mn.classes.noStudentsHint} />
            ) : (
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>№</th>
                      <th className={thClass}>{mn.common.name}</th>
                      <th className={thClass}>{mn.classes.loginColumn}</th>
                      <th className={thClass}>{mn.common.actions}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((s, i) => (
                      <tr key={s.student_id}>
                        <td className={`${tdClass} w-10 tabular-nums text-slate-500`}>{i + 1}</td>
                        <td className={tdClass}>
                          <Link href={`/t/students/${s.student_id}`} className="font-semibold text-slate-900 hover:underline">
                            {displayName(s)}
                          </Link>
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap gap-1">
                            {s.online ? <Badge tone="success">{mn.classes.online}</Badge> : null}
                            {cls.picture_password_enabled ? (
                              s.has_picture_password ? (
                                <Badge tone="info">{mn.classes.pictureSet}</Badge>
                              ) : (
                                <Badge>{mn.classes.pictureNotSet}</Badge>
                              )
                            ) : null}
                          </div>
                        </td>
                        <td className={tdClass}>
                          <div className="flex flex-wrap items-center gap-2">
                            {s.has_picture_password ? (
                              <form action={resetPicturePassword}>
                                <input type="hidden" name="student_id" value={s.student_id} />
                                <input type="hidden" name="return_to" value={back} />
                                <Button type="submit" size="sm" variant="ghost">
                                  {mn.classes.resetPicture}
                                </Button>
                              </form>
                            ) : null}
                            {others.length > 0 ? (
                              <form action={transferStudent} className="flex items-center gap-1">
                                <input type="hidden" name="student_id" value={s.student_id} />
                                <input type="hidden" name="return_to" value={back} />
                                <Select name="to_class_id" className="h-8 w-24 py-0 text-xs" aria-label={mn.classes.transferTo} defaultValue="">
                                  <option value="" disabled>
                                    {mn.classes.transferTo}
                                  </option>
                                  {others.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </Select>
                                <Button type="submit" size="sm" variant="ghost">
                                  →
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form action={addStudent} className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_6rem_8rem_auto] sm:items-end">
              <input type="hidden" name="class_id" value={id} />
              <Field label={mn.students.firstName}>
                <Input name="first_name" maxLength={60} required />
              </Field>
              <Field label={mn.students.familyInitial}>
                <Input name="family_initial" maxLength={1} placeholder="Б" />
              </Field>
              <Field label={mn.students.gender}>
                <Select name="gender" defaultValue="">
                  <option value="">—</option>
                  <option value="male">{mn.students.male}</option>
                  <option value="female">{mn.students.female}</option>
                </Select>
              </Field>
              <Button type="submit">{mn.students.add}</Button>
            </form>
          </Card>

          {roster.length > 0 ? (
            <Card title={mn.classes.removeTitle}>
              <p className="mb-3 text-sm text-slate-600">{mn.classes.removeHint}</p>
              <form action={removeStudent} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="return_to" value={back} />
                <Field label={mn.common.student}>
                  <Select name="student_id" required defaultValue="">
                    <option value="" disabled>
                      —
                    </option>
                    {roster.map((s) => (
                      <option key={s.student_id} value={s.student_id}>
                        {displayName(s)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" variant="danger">
                  {mn.classes.removeButton}
                </Button>
              </form>
            </Card>
          ) : null}
        </div>

        {/* ---- settings column ---- */}
        <div className="space-y-6">
          <Card title={mn.classes.loginTitle}>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-600">{mn.classes.classCode}</dt>
                <dd className="font-mono text-base font-bold tracking-wider">{cls.class_code}</dd>
              </div>
            </dl>
            <Link href={`/present/qr/${id}`} target="_blank" className={buttonClass('secondary', 'md', 'mt-3 w-full')}>
              {mn.classes.showQr}
            </Link>
            <p className="mt-2 text-xs text-slate-500">{mn.classes.qrHint}</p>
          </Card>

          <Card title={mn.classes.settingsTitle}>
            <form action={updateClassSettings} className="space-y-4">
              <input type="hidden" name="id" value={id} />
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="picture_password_enabled" defaultChecked={cls.picture_password_enabled} className="mt-1 h-4 w-4" />
                <span>
                  <span className="font-semibold text-slate-800">{mn.classes.picturePassword}</span>
                  <span className="block text-xs text-slate-500">{mn.classes.picturePasswordHint}</span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="home_practice_enabled" defaultChecked={cls.home_practice_enabled} className="mt-1 h-4 w-4" />
                <span>
                  <span className="font-semibold text-slate-800">{mn.classes.homePractice}</span>
                  <span className="block text-xs text-slate-500">{mn.classes.homePracticeHint}</span>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <Field label={mn.classes.lateAfter}>
                  <Input type="number" name="late_after_minutes" min={0} max={60} defaultValue={cls.late_after_minutes} />
                </Field>
                <Field label={mn.classes.lateCoefficient}>
                  <Input type="number" name="late_coefficient" min={0} max={1} step={0.05} defaultValue={cls.late_coefficient} />
                </Field>
              </div>
              <Field label={mn.classes.excusedPolicy}>
                <Select name="excused_policy" defaultValue={cls.excused_policy}>
                  <option value="exclude">{mn.classes.excusedExclude}</option>
                  <option value="count_present">{mn.classes.excusedPresent}</option>
                </Select>
              </Field>
              <Field label={mn.classes.homeroom}>
                <Input name="homeroom_teacher_name" maxLength={60} defaultValue={cls.homeroom_teacher_name ?? ''} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={mn.classes.animal}>
                  <Select name="animal_icon" defaultValue={cls.animal_icon}>
                    {ANIMAL_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {animalEmoji(key)} {animals[key] ?? key}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={mn.classes.color}>
                  <Select name="color" defaultValue={cls.color}>
                    {(CLASS_COLORS.includes(cls.color) ? CLASS_COLORS : [cls.color, ...CLASS_COLORS]).map((color, i) => (
                      <option key={color} value={color}>
                        {fill(mn.classes.colorOption, { n: i + 1 })}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Button type="submit" className="w-full">
                {mn.common.save}
              </Button>
            </form>
          </Card>

          <Card title={mn.classes.scheduleTitle}>
            {slots.length === 0 ? (
              <p className="text-sm text-slate-600">{mn.classes.noSchedule}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {slots.map((slot) => (
                  <li key={slot.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-semibold">{mn.weekdays[slot.weekday - 1]}</span>{' '}
                      <span className="tabular-nums text-slate-600">
                        {formatTime(slot.starts_at)}–{formatTime(slot.ends_at)}
                      </span>
                    </span>
                    <form action={deleteScheduleSlot}>
                      <input type="hidden" name="class_id" value={id} />
                      <input type="hidden" name="id" value={slot.id} />
                      <Button type="submit" size="sm" variant="ghost" aria-label={mn.common.delete}>
                        ✕
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={addScheduleSlot} className="mt-4 grid grid-cols-[1fr_auto_auto] items-end gap-2 border-t border-slate-100 pt-4">
              <input type="hidden" name="class_id" value={id} />
              <Field label={mn.classes.weekday}>
                <Select name="weekday" defaultValue="1">
                  {mn.weekdays.map((day, i) => (
                    <option key={day} value={i + 1}>
                      {day}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={mn.classes.startsAt}>
                <Input type="time" name="starts_at" defaultValue="08:00" required className="w-28" />
              </Field>
              <Field label={mn.classes.endsAt}>
                <Input type="time" name="ends_at" defaultValue="08:40" required className="w-28" />
              </Field>
              <Button type="submit" variant="secondary" className="col-span-3">
                {mn.classes.addSlot}
              </Button>
            </form>
          </Card>

          <Card title={mn.classes.archiveTitle}>
            <p className="mb-3 text-sm text-slate-600">{mn.classes.archiveHint}</p>
            <form action={setClassStatus}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value={cls.status === 'archived' ? 'active' : 'archived'} />
              <Button type="submit" variant={cls.status === 'archived' ? 'secondary' : 'danger'}>
                {cls.status === 'archived' ? mn.classes.restore : mn.classes.archive}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
