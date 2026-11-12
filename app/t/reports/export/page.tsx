import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, buttonClass, Card, EmptyState, Field, PageHeader, Select } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { exportFileName } from '@/lib/mn/dates';
import { param, type SearchParams } from '@/lib/params';
import { loadClasses, loadTerms, pick } from '@/lib/teacher-data';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.exportPage.title };

export default async function ExportPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, teacher } = await requireTeacher();
  const sp = await searchParams;
  const [classes, { terms, currentTermId }] = await Promise.all([loadClasses(supabase), loadTerms(supabase)]);
  const term = pick(terms, param(sp.term), currentTermId);

  if (classes.length === 0 || !term) {
    return (
      <div>
        <PageHeader title={mn.exportPage.title} />
        <EmptyState
          title={classes.length === 0 ? mn.classes.empty : mn.dashboard.noTerms}
          action={
            <Link href={classes.length === 0 ? '/t/classes' : '/t/settings'} className={buttonClass('primary')}>
              {classes.length === 0 ? mn.classes.create : mn.nav.settings}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={mn.exportPage.title} subtitle={mn.exportPage.subtitle} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title={mn.exportPage.gradesTitle}>
          {/* A plain GET form: the browser downloads the file the route returns. */}
          <form method="get" action="/api/export/grades" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label={mn.common.class}>
                <Select name="class" defaultValue={param(sp.class) ?? 'all'}>
                  <option value="all">{mn.exportPage.allClasses}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={mn.common.term}>
                <Select name="term" defaultValue={term.id}>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button type="submit" size="lg">
              ⬇ {mn.exportPage.download}
            </Button>
          </form>
          <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>{mn.exportPage.note1}</li>
            <li>{mn.exportPage.note2}</li>
            <li>
              {mn.exportPage.note3} <span className="font-mono text-slate-800">{exportFileName(classes[0].name, mn.exportPage.fileKind)}</span>
            </li>
          </ul>
        </Card>

        <Card title={mn.exportPage.backupTitle}>
          <p className="mb-4 text-sm text-slate-600">{mn.exportPage.backupHint}</p>
          {teacher.role === 'owner' ? (
            <a href="/api/export/backup" className={buttonClass('secondary', 'lg')}>
              ⬇ {mn.exportPage.backupDownload}
            </a>
          ) : (
            <p className="text-sm font-semibold text-slate-700">{mn.exportPage.backupOwnerOnly}</p>
          )}
        </Card>
      </div>
      <p className="mt-6 text-sm text-slate-500">{mn.exportPage.moreSoon}</p>
    </div>
  );
}
