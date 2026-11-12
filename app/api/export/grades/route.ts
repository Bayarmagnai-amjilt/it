import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import type { ExcusedPolicy } from '@/lib/attendance';
import { isUuid } from '@/lib/constants';
import { addAttendanceSheet, addGradesSheet } from '@/lib/excel/grades';
import { exportFileName, todayISO } from '@/lib/mn/dates';
import { compareText, sortByName } from '@/lib/mn/names';
import { fetchAll } from '@/lib/supabase/paginate';
import { createClient } from '@/lib/supabase/server';
import type { AttendanceStatus, RosterStudent, TeacherClass, TermGradeRow } from '@/lib/types';
import { mn } from '@/locales/mn';

// Excel export: for each chosen class one "grades" sheet and one "attendance"
// sheet for the chosen term. /api/export/grades?class=<id|all>&term=<id>
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const classParam = url.searchParams.get('class') ?? '';
  const termId = url.searchParams.get('term') ?? '';
  if (!isUuid(termId) || !(classParam === 'all' || isUuid(classParam))) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const [{ data: classData }, { data: termData }] = await Promise.all([
    supabase.rpc('my_classes', { p_include_archived: false }),
    supabase.from('terms').select('id, name').eq('id', termId).maybeSingle(),
  ]);
  const term = termData as { id: string; name: string } | null;
  const all = ((classData ?? []) as TeacherClass[]).sort((a, b) => a.grade - b.grade || compareText(a.section, b.section));
  const targets = classParam === 'all' ? all : all.filter((c) => c.id === classParam);
  if (!term || targets.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = mn.app.name;
    workbook.created = new Date();
    const today = todayISO();

    for (const cls of targets) {
      const [{ data: gradeData, error: gradeError }, { data: rosterData }, { data: settingsData }, { data: lessonData }] =
        await Promise.all([
          supabase.rpc('term_grades', { p_class_id: cls.id, p_term_id: term.id }),
          supabase.rpc('class_roster', { p_class_id: cls.id }),
          supabase.from('classes').select('late_coefficient, excused_policy').eq('id', cls.id).maybeSingle(),
          supabase
            .from('lesson_sessions')
            .select('id, held_on, period')
            .eq('class_id', cls.id)
            .eq('term_id', term.id)
            .order('held_on')
            .order('period'),
        ]);
      if (gradeError) throw new Error('grades_failed');

      addGradesSheet(workbook, {
        className: cls.name,
        termName: term.name,
        rows: sortByName((gradeData ?? []) as TermGradeRow[]),
        exportedOn: today,
      });

      const lessons = (lessonData ?? []) as { id: string; held_on: string; period: number }[];
      const marks = new Map<string, AttendanceStatus>();
      if (lessons.length > 0) {
        const ids = lessons.map((l) => l.id);
        const rows = await fetchAll<{ lesson_session_id: string; student_id: string; status: AttendanceStatus }>((from, to) =>
          supabase
            .from('attendance')
            .select('lesson_session_id, student_id, status')
            .in('lesson_session_id', ids)
            .order('lesson_session_id')
            .order('student_id')
            .range(from, to),
        );
        for (const a of rows) marks.set(`${a.lesson_session_id}:${a.student_id}`, a.status);
      }
      const settings = (settingsData ?? {}) as { late_coefficient?: number; excused_policy?: ExcusedPolicy };
      addAttendanceSheet(workbook, {
        className: cls.name,
        termName: term.name,
        lateCoefficient: Number(settings.late_coefficient ?? 0.5),
        excusedPolicy: settings.excused_policy ?? 'exclude',
        lessons,
        students: sortByName((rosterData ?? []) as RosterStudent[]),
        marks,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = exportFileName(targets.length === 1 ? targets[0].name : mn.exportPage.allClassesFile, mn.exportPage.fileKind);
    return new Response(new Uint8Array(buffer as unknown as ArrayBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        // ASCII fallback first, then the real (Mongolian) name for modern browsers
        'Content-Disposition': `attachment; filename="grades_${today}.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }
}
