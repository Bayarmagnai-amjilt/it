import type { CellValue, Fill, Workbook, Worksheet } from 'exceljs';
import { attendancePercent, countStatuses, type ExcusedPolicy } from '@/lib/attendance';
import { LOW_PERCENT } from '@/lib/constants';
import { formatDate, formatDayMonth } from '@/lib/mn/dates';
import { displayName } from '@/lib/mn/names';
import type { AttendanceStatus, NameLike, TermGradeRow } from '@/lib/types';
import { mn } from '@/locales/mn';

const RED_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } };
const HEADER_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
const STATUS_FILL: Record<AttendanceStatus, string> = {
  present: 'FFD1FAE5',
  late: 'FFFEF3C7',
  absent: 'FFFECACA',
  excused: 'FFE0F2FE',
  sick: 'FFEDE9FE',
};

/** A cell that holds a formula plus the value already computed for it. */
function formulaCell(formula: string, result: number | string): CellValue {
  return { formula, result, date1904: false } as CellValue;
}

/** 1 -> A, 2 -> B, 27 -> AA */
export function columnLetter(index: number): string {
  let n = index;
  let out = '';
  while (n > 0) {
    const rest = (n - 1) % 26;
    out = String.fromCharCode(65 + rest) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Excel sheet names: at most 31 characters, none of \ / ? * [ ] : */
function sheetName(text: string): string {
  return text.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
}

/**
 * Column widths from the table itself. The title lines above the table (rows
 * before `fromRow`) are left out: they may run across the neighbouring cells.
 */
function fitColumns(sheet: Worksheet, fromRow: number, min = 6, max = 40): void {
  sheet.columns.forEach((column) => {
    let width = min;
    column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber < fromRow) return;
      const value = cell.value;
      const text =
        value === null || value === undefined
          ? ''
          : typeof value === 'object' && 'result' in value
            ? String(value.result ?? '')
            : String(value);
      width = Math.max(width, Math.min(text.length + 2, max));
    });
    column.width = width;
  });
}

/**
 * "Нэгдсэн дүн": one row per student, one column per grading component.
 * The final grade is a real Excel formula over the component columns and the
 * weight row, so the teacher can check (or change) the calculation in Excel.
 */
export function addGradesSheet(
  workbook: Workbook,
  opts: { className: string; termName: string; rows: TermGradeRow[]; exportedOn: string },
): void {
  const { className, termName, rows } = opts;
  const sheet = workbook.addWorksheet(sheetName(`${className} ${mn.exportPage.sheetGrades}`), {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }],
  });
  const components = rows[0]?.components ?? [];
  const firstCol = 3; // C
  const lastCol = firstCol + components.length - 1;
  const finalCol = lastCol + 1;

  sheet.addRow([`${className} · ${termName} · ${mn.exportPage.sheetGrades}`]).font = { bold: true, size: 14 };
  sheet.addRow([`${mn.exportPage.exportedOn}: ${formatDate(opts.exportedOn)}`]).font = { color: { argb: 'FF64748B' } };

  const header = sheet.addRow([
    '№',
    mn.common.name,
    ...components.map((c) => c.name),
    mn.grades.final,
    mn.grades.letter,
    mn.exportPage.level,
    mn.exportPage.coverage,
  ]);
  const weights = sheet.addRow(['', mn.exportPage.weightRow, ...components.map((c) => Number(c.weight))]);
  for (const row of [header, weights]) {
    row.font = { bold: true };
    row.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.alignment = { vertical: 'middle', wrapText: true };
    });
  }

  rows.forEach((student, index) => {
    const r = sheet.addRow([
      index + 1,
      displayName(student),
      ...components.map((_, i) => {
        const percent = student.components[i]?.percent;
        return percent === null || percent === undefined ? null : Number(percent);
      }),
    ]);
    const n = r.number;
    if (components.length > 0) {
      const range = `${columnLetter(firstCol)}${n}:${columnLetter(lastCol)}${n}`;
      const weightRange = `$${columnLetter(firstCol)}$4:$${columnLetter(lastCol)}$4`;
      // weighted average over the components that have a value (empty cells are skipped)
      r.getCell(finalCol).value = formulaCell(
        `IFERROR(ROUND(SUMPRODUCT((${range}<>"")*${range}*${weightRange})/SUMPRODUCT((${range}<>"")*${weightRange}),2),"")`,
        student.final_percent === null ? '' : Number(student.final_percent),
      );
    }
    r.getCell(finalCol).font = { bold: true };
    r.getCell(finalCol + 1).value = student.letter ?? '';
    r.getCell(finalCol + 2).value = student.teacher_label ?? '';
    r.getCell(finalCol + 3).value = Number(student.weight_covered);

    // below 60 %: red cells, for components and for the final grade
    components.forEach((_, i) => {
      const percent = student.components[i]?.percent;
      if (percent !== null && percent !== undefined && Number(percent) < LOW_PERCENT) {
        r.getCell(firstCol + i).fill = RED_FILL;
      }
    });
    if (student.final_percent !== null && Number(student.final_percent) < LOW_PERCENT) {
      r.getCell(finalCol).fill = RED_FILL;
    }
  });

  fitColumns(sheet, 3);
  sheet.getColumn(2).width = Math.max(sheet.getColumn(2).width ?? 10, 22);
}

export interface AttendanceExport {
  className: string;
  termName: string;
  lateCoefficient: number;
  excusedPolicy: ExcusedPolicy;
  lessons: { id: string; held_on: string; period: number }[];
  students: (NameLike & { student_id: string })[];
  marks: Map<string, AttendanceStatus>; // `${lessonId}:${studentId}` -> status
}

/** "Ирц": one row per student, one column per lesson, totals and percent as formulas. */
export function addAttendanceSheet(workbook: Workbook, data: AttendanceExport): void {
  const sheet = workbook.addWorksheet(sheetName(`${data.className} ${mn.exportPage.sheetAttendance}`), {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 3 }],
  });
  const short = mn.attendanceShort;
  const firstCol = 3;
  const lastCol = firstCol + data.lessons.length - 1;
  const totalCol = lastCol + 1; // present, late, absent, excused, sick, percent
  const countsAsPresent = data.excusedPolicy === 'count_present';

  sheet.addRow([`${data.className} · ${data.termName} · ${mn.exportPage.sheetAttendance}`]).font = { bold: true, size: 14 };
  // C2 holds the late coefficient; the percent formulas below refer to it
  sheet.addRow([
    '',
    mn.exportPage.lateCoefficient,
    Number(data.lateCoefficient),
    '',
    `${mn.classes.excusedPolicy}: ${countsAsPresent ? mn.classes.excusedPresent : mn.classes.excusedExclude}`,
  ]).font = { color: { argb: 'FF64748B' } };

  const header = sheet.addRow([
    '№',
    mn.common.name,
    ...data.lessons.map((l) => (l.period > 1 ? `${formatDayMonth(l.held_on)} #${l.period}` : formatDayMonth(l.held_on))),
    mn.attendanceStatus.present,
    mn.attendanceStatus.late,
    mn.attendanceStatus.absent,
    mn.attendanceStatus.excused,
    mn.attendanceStatus.sick,
    mn.exportPage.attendancePercent,
  ]);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  data.students.forEach((student, index) => {
    const statuses = data.lessons.map((l) => data.marks.get(`${l.id}:${student.student_id}`));
    const r = sheet.addRow([index + 1, displayName(student), ...statuses.map((s) => (s ? short[s] : null))]);
    const n = r.number;
    statuses.forEach((s, i) => {
      if (!s) return;
      const cell = r.getCell(firstCol + i);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[s] } };
      cell.alignment = { horizontal: 'center' };
    });

    const counts = countStatuses(statuses);
    if (data.lessons.length > 0) {
      const range = `${columnLetter(firstCol)}${n}:${columnLetter(lastCol)}${n}`;
      const order: AttendanceStatus[] = ['present', 'late', 'absent', 'excused', 'sick'];
      order.forEach((status, i) => {
        r.getCell(totalCol + i).value = formulaCell(`COUNTIF(${range},"${short[status]}")`, counts[status]);
      });
      const [p, l, a, e, s] = [0, 1, 2, 3, 4].map((i) => `${columnLetter(totalCol + i)}${n}`);
      const excused = countsAsPresent ? `+${e}+${s}` : '';
      const percent = attendancePercent(counts, Number(data.lateCoefficient), data.excusedPolicy);
      const percentCell = r.getCell(totalCol + 5);
      percentCell.value = formulaCell(
        `IFERROR(ROUND((${p}+${l}*$C$2${excused})/(${p}+${l}+${a}${excused})*100,2),"")`,
        percent === null ? '' : percent,
      );
      percentCell.font = { bold: true };
      if (percent !== null && percent < LOW_PERCENT) percentCell.fill = RED_FILL;
    }
  });

  fitColumns(sheet, 3, 5, 30);
  sheet.getColumn(2).width = Math.max(sheet.getColumn(2).width ?? 10, 24);
}
