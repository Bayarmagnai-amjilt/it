import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { parseStudentLines } from '@/lib/mn/names';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 2 * 1024 * 1024;

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return '';
  if (typeof value === 'object') {
    const v = value as { text?: unknown; result?: unknown; richText?: { text?: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((part) => part.text ?? '').join('');
    if (v.text !== undefined) return cellText(v.text);
    if (v.result !== undefined) return cellText(v.result);
  }
  return '';
}

/**
 * Reads an uploaded .xlsx or .csv class list and returns the students found in
 * it. Nothing is saved here: the teacher confirms the preview first.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'bad_file' }, { status: 400 });
  }

  try {
    const lines: string[] = [];
    if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
      const text = (await file.text()).replace(/^﻿/, '');
      for (const line of text.split(/\r?\n/)) lines.push(line.replaceAll(',', '\t'));
    } else {
      const workbook = new ExcelJS.Workbook();
      // ExcelJS typings name their own Buffer type; at run time an ArrayBuffer is fine.
      await workbook.xlsx.load((await file.arrayBuffer()) as never);
      const sheet = workbook.worksheets[0];
      if (!sheet) return NextResponse.json({ rows: [] });
      sheet.eachRow((row) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        lines.push(values.map(cellText).join('\t'));
      });
    }
    return NextResponse.json({ rows: parseStudentLines(lines.join('\n')).slice(0, 200) });
  } catch {
    return NextResponse.json({ error: 'unreadable' }, { status: 400 });
  }
}
