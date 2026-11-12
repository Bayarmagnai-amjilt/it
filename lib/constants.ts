import type { AttendanceStatus, ComponentSource } from './types';

// Class mascots. Keys are stored in classes.animal_icon; labels live in locales/mn.ts.
// Emoji for now: they need no image files and can be swapped for drawings later.
export const ANIMALS: Record<string, string> = {
  camel_calf: '🐫',
  foal: '🐴',
  lamb: '🐑',
  kid: '🐐',
  calf: '🐮',
  puppy: '🐶',
  marmot: '🦫',
  eagle: '🦅',
  deer: '🦌',
  rabbit: '🐰',
  fox: '🦊',
  swan: '🦢',
};
export const ANIMAL_KEYS = Object.keys(ANIMALS);

export function animalEmoji(key: string | null | undefined): string {
  return ANIMALS[key ?? ''] ?? ANIMALS.foal;
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
  present: { icon: '✓', active: 'bg-emerald-600 text-white border-emerald-600', cell: 'bg-emerald-100 text-emerald-800' },
  late: { icon: '⏰', active: 'bg-amber-500 text-white border-amber-500', cell: 'bg-amber-100 text-amber-800' },
  absent: { icon: '✗', active: 'bg-red-600 text-white border-red-600', cell: 'bg-red-100 text-red-800' },
  excused: { icon: '📝', active: 'bg-sky-600 text-white border-sky-600', cell: 'bg-sky-100 text-sky-800' },
  sick: { icon: '🤒', active: 'bg-violet-600 text-white border-violet-600', cell: 'bg-violet-100 text-violet-800' },
};

export const COMPONENT_SOURCES: ComponentSource[] = ['attendance', 'quiz', 'scratch', 'practice', 'lesson', 'manual'];

// Cells below this percent are shown in red (gradebook and Excel export).
export const LOW_PERCENT = 60;

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}
