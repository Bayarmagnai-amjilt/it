import { SUPABASE_URL } from './supabase/env';
import type { AttendanceStatus, ComponentSource } from './types';

// Sections are numbered: grade 1, section 2 is the class '1-2'.
export const CLASS_SECTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));

// Class logos: a picture the teacher uploads to Supabase Storage, files at
// '<class id>/<name>'. Its public URL is kept in classes.animal_icon (the column
// kept its old name); any other value there, such as an old animal key, means no logo.
export const LOGO_BUCKET = 'class-logos';
export const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
// the browser shrinks a picture to this many pixels on its longer side before sending it
export const LOGO_PIXELS = 256;
const LOGO_URL_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${LOGO_BUCKET}/`;

/** True when animal_icon holds a logo uploaded to this project. */
export function isLogoUrl(value: string | null | undefined): value is string {
  return Boolean(SUPABASE_URL) && typeof value === 'string' && value.startsWith(LOGO_URL_PREFIX);
}

export const CLASS_COLORS = [
  '#F59E0B', '#EF4444', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
  '#14B8A6', '#F97316', '#6366F1', '#84CC16', '#06B6D4', '#D946EF',
];

// The nine tiles of the picture password. Ids are what gets hashed: never rename them.
export const PICTURE_TILES = [
  { id: 'horse', emoji: '🐎' },
  { id: 'camel', emoji: '🐪' },
  { id: 'ger', emoji: '🛖' },
  { id: 'sun', emoji: '☀️' },
  { id: 'star', emoji: '⭐' },
  { id: 'moon', emoji: '🌙' },
  { id: 'mountain', emoji: '⛰️' },
  { id: 'flower', emoji: '🌸' },
  { id: 'fish', emoji: '🐟' },
] as const;
export type PictureId = (typeof PICTURE_TILES)[number]['id'];
export const PICTURE_IDS: string[] = PICTURE_TILES.map((t) => t.id);

// Grades 1-2 remember two pictures, grades 3-5 three.
export function pictureLength(grade: number): number {
  return grade <= 2 ? 2 : 3;
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['present', 'late', 'absent', 'excused', 'sick'];

export const ATTENDANCE_STYLE: Record<AttendanceStatus, { icon: string; active: string; cell: string }> = {
  present: { icon: '✓', active: 'bg-emerald-500 text-white border-ink-900 shadow-brut-sm', cell: 'bg-emerald-100 text-emerald-900' },
  late: { icon: '⏰', active: 'bg-sun-500 text-ink-900 border-ink-900 shadow-brut-sm', cell: 'bg-amber-100 text-amber-900' },
  absent: { icon: '✗', active: 'bg-red-500 text-white border-ink-900 shadow-brut-sm', cell: 'bg-red-100 text-red-900' },
  excused: { icon: '📝', active: 'bg-sky-500 text-white border-ink-900 shadow-brut-sm', cell: 'bg-sky-100 text-sky-900' },
  sick: { icon: '🤒', active: 'bg-grape-500 text-white border-ink-900 shadow-brut-sm', cell: 'bg-violet-100 text-violet-900' },
};

export const COMPONENT_SOURCES: ComponentSource[] = ['attendance', 'quiz', 'scratch', 'practice', 'lesson', 'manual'];

// Cells below this percent are shown in red (gradebook and Excel export).
export const LOW_PERCENT = 60;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
