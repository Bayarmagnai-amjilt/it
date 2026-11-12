import type { Metadata } from 'next';
import Link from 'next/link';
import { Flash } from '@/components/teacher/Flash';
import { Button, buttonClass, Card, ClassChip, EmptyState, Field, Input, PageHeader, Select, tableClass, tdClass, thClass } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { animalEmoji } from '@/lib/constants';
import { fill } from '@/lib/errors';
import { compareNames, displayName } from '@/lib/mn/names';
import { param, type SearchParams } from '@/lib/params';
import { loadClasses } from '@/lib/teacher-data';
import type { ListedStudent } from '@/lib/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.nav.students };

export default async function StudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireTeacher();
  const sp = await searchParams;
  const q = (param(sp.q) ?? '').trim().toLocaleLowerCase('mn');
  const classFilter = param(sp.class) ?? '';

  const [{ data }, classes] = await Promise.all([supabase.rpc('all_students'), loadClasses(supabase)]);
  const emojiByClass = new Map(classes.map((c) => [c.id, animalEmoji(c.animal_icon)]));
  const all = (data ?? []) as ListedStudent[];
  const list = all
    .filter((s) => !classFilter || s.class_id === classFilter)
    .filter((s) => !q || displayName(s).toLocaleLowerCase('mn').includes(q))
    .sort((a, b) => a.grade - b.grade || a.class_name.localeCompare(b.class_name, 'mn') || compareNames(a, b));

  return (
    <div>
      <PageHeader
        title={mn.nav.students}
        subtitle={fill(mn.students.count, { n: list.length, total: all.length })}
        actions={
          <Link href="/t/students/import" className={buttonClass('primary')}>
            {mn.importPage.title}
          </Link>
        }
      />
      <Flash params={sp} />
      <Card>
        <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
          <Field label={mn.common.search}>
            <Input name="q" defaultValue={param(sp.q) ?? ''} placeholder={mn.students.searchPlaceholder} className="w-64" />
          </Field>
          <Field label={mn.common.class}>
            <Select name="class" defaultValue={classFilter} className="w-32">
              <option value="">{mn.common.all}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="secondary">
            {mn.common.show}
          </Button>
        </form>

        {list.length === 0 ? (
          <EmptyState title={mn.students.empty} hint={mn.students.emptyHint} />
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>№</th>
                  <th className={thClass}>{mn.common.name}</th>
                  <th className={thClass}>{mn.common.class}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s, i) => (
                  <tr key={s.student_id}>
                    <td className={`${tdClass} w-10 tabular-nums text-slate-500`}>{i + 1}</td>
                    <td className={tdClass}>
                      <Link href={`/t/students/${s.student_id}`} className="font-semibold text-slate-900 hover:underline">
                        {displayName(s)}
                      </Link>
                    </td>
                    <td className={tdClass}>
                      <Link href={`/t/classes/${s.class_id}`}>
                        <ClassChip name={s.class_name} color={s.color} emoji={emojiByClass.get(s.class_id) ?? ''} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
