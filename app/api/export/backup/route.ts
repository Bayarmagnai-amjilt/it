import { NextResponse } from 'next/server';
import { todayISO } from '@/lib/mn/dates';
import { fetchAll } from '@/lib/supabase/paginate';
import { createClient } from '@/lib/supabase/server';

// Tables of Phase 1 with the columns to export and a stable sort order.
// Picture-password hashes are left out on purpose.
const TABLES: { name: string; columns: string; order: string[] }[] = [
  { name: 'school_years', columns: '*', order: ['id'] },
  { name: 'terms', columns: '*', order: ['id'] },
  { name: 'classes', columns: '*', order: ['id'] },
  { name: 'class_teachers', columns: '*', order: ['class_id', 'teacher_id'] },
  { name: 'class_schedule_slots', columns: '*', order: ['id'] },
  { name: 'students', columns: 'id, first_name, family_initial, gender, avatar, status, created_at', order: ['id'] },
  { name: 'enrollments', columns: '*', order: ['id'] },
  { name: 'teacher_notes', columns: '*', order: ['id'] },
  { name: 'lesson_sessions', columns: '*', order: ['id'] },
  { name: 'attendance', columns: '*', order: ['id'] },
  { name: 'grade_scale_bands', columns: '*', order: ['id'] },
  { name: 'grade_components', columns: '*', order: ['id'] },
  { name: 'grade_items', columns: '*', order: ['id'] },
  { name: 'scores', columns: '*', order: ['id'] },
  { name: 'topics', columns: '*', order: ['id'] },
  { name: 'app_settings', columns: '*', order: ['key'] },
];

/** Everything the owner can read, as one JSON file: a manual backup. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: me } = await supabase.from('teachers').select('role, is_active').eq('id', user.id).maybeSingle();
  if (!me || !me.is_active || me.role !== 'owner') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const tables: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      tables[table.name] = await fetchAll<unknown>((from, to) => {
        let query = supabase.from(table.name).select(table.columns);
        for (const column of table.order) query = query.order(column);
        return query.range(from, to);
      });
    }
    const today = todayISO();
    const body = JSON.stringify({ app: 'amjilt-it', format: 1, exported_on: today, tables }, null, 1);
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="amjilt-it-backup-${today}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'backup_failed' }, { status: 500 });
  }
}
