import type { Metadata } from 'next';
import Link from 'next/link';
import { ImportStudents } from '@/components/teacher/ImportStudents';
import { buttonClass, Card, EmptyState, PageHeader } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { param, type SearchParams } from '@/lib/params';
import { loadClasses, pick } from '@/lib/teacher-data';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.importPage.title };

export default async function ImportStudentsPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase } = await requireTeacher();
  const classes = await loadClasses(supabase);
  const selected = pick(classes, param((await searchParams).class));

  return (
    <div>
      <PageHeader title={mn.importPage.title} subtitle={mn.importPage.subtitle} />
      {!selected ? (
        <EmptyState
          title={mn.classes.empty}
          hint={mn.classes.emptyHint}
          action={
            <Link href="/t/classes" className={buttonClass('primary')}>
              {mn.classes.create}
            </Link>
          }
        />
      ) : (
        <Card>
          <ImportStudents classes={classes.map((c) => ({ id: c.id, name: c.name }))} initialClassId={selected.id} />
        </Card>
      )}
    </div>
  );
}
