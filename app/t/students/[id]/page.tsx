import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Flash } from '@/components/teacher/Flash';
import { Badge, Button, Card, ClassChip, Field, Input, PageHeader, Select, tableClass, tdClass, thClass } from '@/components/ui';
import { addNote, deleteNote, resetPicturePassword, transferStudent, updateStudent } from '@/features/classes/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import { animalEmoji, ATTENDANCE_STATUSES, ATTENDANCE_STYLE, isUuid } from '@/lib/constants';
import { formatClock, formatDate } from '@/lib/mn/dates';
import { displayName } from '@/lib/mn/names';
import type { SearchParams } from '@/lib/params';
import { loadClasses } from '@/lib/teacher-data';
import type { StudentProfile } from '@/lib/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.students.profile };

export default async function StudentProfilePage({
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
  const [{ data, error }, classes] = await Promise.all([
    supabase.rpc('student_profile', { p_student_id: id }),
    loadClasses(supabase),
  ]);
  const profile = data as StudentProfile | null;
  if (error || !profile?.student) notFound();

  const { student, class: cls } = profile;
  const back = `/t/students/${id}`;
  const others = classes.filter((c) => c.id !== cls?.id);
  const reasons = mn.students.endReasons as Record<string, string>;

  return (
    <div>
      <PageHeader
        title={displayName(student)}
        subtitle={
          cls ? (
            <Link href={`/t/classes/${cls.id}`}>
              <ClassChip name={cls.name} color={cls.color} emoji={animalEmoji(cls.animal_icon)} />
            </Link>
          ) : (
            <Badge tone="warning">{mn.students.left}</Badge>
          )
        }
      />
      <Flash params={sp} />

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title={mn.nav.attendance}>
            <div className="mb-4 flex flex-wrap gap-2">
              {ATTENDANCE_STATUSES.map((status) => (
                <span key={status} className={`rounded-lg px-3 py-2 text-sm font-semibold ${ATTENDANCE_STYLE[status].cell}`}>
                  {ATTENDANCE_STYLE[status].icon} {mn.attendanceStatus[status]}: {profile.attendance?.[status] ?? 0}
                </span>
              ))}
            </div>
            {profile.recent_attendance.length === 0 ? (
              <p className="text-sm text-slate-600">{mn.students.noAttendance}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className={thClass}>{mn.common.date}</th>
                      <th className={thClass}>{mn.common.period}</th>
                      <th className={thClass}>{mn.attendance.status}</th>
                      <th className={thClass}>{mn.attendance.note}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.recent_attendance.map((a) => (
                      <tr key={`${a.held_on}-${a.period}`}>
                        <td className={`${tdClass} tabular-nums`}>{formatDate(a.held_on)}</td>
                        <td className={`${tdClass} tabular-nums`}>{a.period}</td>
                        <td className={tdClass}>
                          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ATTENDANCE_STYLE[a.status].cell}`}>
                            {mn.attendanceStatus[a.status]}
                          </span>
                        </td>
                        <td className={`${tdClass} text-slate-600`}>{a.note ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title={mn.students.notes}>
            <form action={addNote} className="mb-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="student_id" value={id} />
              <input type="hidden" name="return_to" value={back} />
              <div className="min-w-64 flex-1">
                <Field label={mn.students.newNote} hint={mn.students.notesHint}>
                  <Input name="body" maxLength={2000} required />
                </Field>
              </div>
              <Button type="submit">{mn.common.add}</Button>
            </form>
            {profile.notes.length === 0 ? (
              <p className="text-sm text-slate-600">{mn.students.noNotes}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {profile.notes.map((n) => (
                  <li key={n.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="text-slate-900">{n.body}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {n.teacher} · {formatDate(n.created_at)} {formatClock(n.created_at)}
                      </p>
                    </div>
                    <form action={deleteNote}>
                      <input type="hidden" name="note_id" value={n.id} />
                      <input type="hidden" name="return_to" value={back} />
                      <Button type="submit" size="sm" variant="ghost" aria-label={mn.common.delete}>
                        ✕
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={mn.students.history}>
            <ul className="space-y-1 text-sm">
              {profile.history.map((h, i) => (
                <li key={i} className="flex flex-wrap gap-2">
                  <span className="font-semibold">{h.class_name}</span>
                  <span className="tabular-nums text-slate-600">
                    {formatDate(h.started_on)} – {h.ended_on ? formatDate(h.ended_on) : mn.students.now}
                  </span>
                  {h.end_reason ? <Badge>{reasons[h.end_reason] ?? h.end_reason}</Badge> : null}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {cls ? (
          <div className="space-y-6">
            <Card title={mn.students.editTitle}>
              <form action={updateStudent} className="space-y-4">
                <input type="hidden" name="student_id" value={id} />
                <input type="hidden" name="return_to" value={back} />
                <Field label={mn.students.firstName}>
                  <Input name="first_name" defaultValue={student.first_name} maxLength={60} required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={mn.students.familyInitial}>
                    <Input name="family_initial" defaultValue={student.family_initial ?? ''} maxLength={1} />
                  </Field>
                  <Field label={mn.students.gender}>
                    <Select name="gender" defaultValue={student.gender ?? ''}>
                      <option value="">—</option>
                      <option value="male">{mn.students.male}</option>
                      <option value="female">{mn.students.female}</option>
                    </Select>
                  </Field>
                </div>
                <Button type="submit" className="w-full">
                  {mn.common.save}
                </Button>
              </form>
            </Card>

            <Card title={mn.classes.picturePassword}>
              <p className="mb-3 text-sm text-slate-600">
                {student.has_picture_password ? mn.students.pictureSetHint : mn.students.pictureNotSetHint}
              </p>
              <form action={resetPicturePassword}>
                <input type="hidden" name="student_id" value={id} />
                <input type="hidden" name="return_to" value={back} />
                <Button type="submit" variant="secondary" disabled={!student.has_picture_password}>
                  {mn.classes.resetPicture}
                </Button>
              </form>
            </Card>

            {others.length > 0 ? (
              <Card title={mn.students.transferTitle}>
                <p className="mb-3 text-sm text-slate-600">{mn.students.transferHint}</p>
                <form action={transferStudent} className="flex items-end gap-3">
                  <input type="hidden" name="student_id" value={id} />
                  <input type="hidden" name="return_to" value={back} />
                  <div className="flex-1">
                    <Field label={mn.classes.transferTo}>
                      <Select name="to_class_id" required defaultValue="">
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
                  </div>
                  <Button type="submit" variant="secondary">
                    {mn.students.transferButton}
                  </Button>
                </form>
              </Card>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
