// Mongolian names: display, ordering and parsing of pasted class lists.
// Self-contained on purpose (no imports) so tests can load it directly.

export interface NameParts {
  first_name: string;
  family_initial?: string | null;
}

export interface ParsedStudent {
  first_name: string;
  family_initial: string | null;
  gender: 'male' | 'female' | null;
}

// The "mn" collation puts Ө after О and Ү after У, as the Mongolian alphabet does.
const collator = new Intl.Collator('mn', { sensitivity: 'base', numeric: true });

/** "Б. Тэмүүлэн" when the initial is known, otherwise just the first name. */
export function displayName(s: NameParts): string {
  return s.family_initial ? `${s.family_initial}. ${s.first_name}` : s.first_name;
}

export function compareNames(a: NameParts, b: NameParts): number {
  return (
    collator.compare(a.first_name, b.first_name) ||
    collator.compare(a.family_initial ?? '', b.family_initial ?? '')
  );
}

export function sortByName<T extends NameParts>(list: T[]): T[] {
  return [...list].sort(compareNames);
}

export function compareText(a: string, b: string): number {
  return collator.compare(a, b);
}

export function firstLetter(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('mn');
}

/** Distinct first letters of the names, in alphabet order: the letter filter. */
export function letterIndex(list: NameParts[]): string[] {
  return [...new Set(list.map((s) => firstLetter(s.first_name)).filter(Boolean))].sort(collator.compare);
}

const CYR_UPPER = 'А-ЯӨҮЁ';
const INITIAL_FIRST = new RegExp(`^([${CYR_UPPER}])\\s*\\.\\s*(.+)$`, 'u');
const INITIAL_LAST = new RegExp(`^(.+?)\\s+([${CYR_UPPER}])\\.?$`, 'u');
const SINGLE_LETTER = new RegExp(`^[${CYR_UPPER}]\\.?$`, 'iu');
const HEADER = /^(№|#|д\/д|нэр|нэрс|овог|овгийн|сурагч|сурагчийн|хүйс)/iu;

function capitalize(text: string): string {
  const t = text.trim().replace(/\s+/g, ' ');
  return t ? t.charAt(0).toLocaleUpperCase('mn') + t.slice(1) : t;
}

function parseGender(cell: string): 'male' | 'female' | null {
  const c = cell.trim().toLocaleLowerCase('mn');
  if (['эр', 'эрэгтэй', 'хүү', 'male', 'm', 'м'].includes(c)) return 'male';
  if (['эм', 'эмэгтэй', 'охин', 'female', 'f', 'ж'].includes(c)) return 'female';
  return null;
}

function parseSingle(text: string): { first_name: string; family_initial: string | null } {
  const t = text.trim().replace(/\s+/g, ' ');
  let m = INITIAL_FIRST.exec(t);
  if (m) return { first_name: capitalize(m[2]), family_initial: m[1].toLocaleUpperCase('mn') };
  m = INITIAL_LAST.exec(t);
  if (m) return { first_name: capitalize(m[1]), family_initial: m[2].toLocaleUpperCase('mn') };
  // "Бат Тэмүүлэн" / "Батын Тэмүүлэн": father's name first, then the given name
  const words = t.split(' ');
  if (words.length === 2 && words[0].length > 1 && words[1].length > 1) {
    return { first_name: capitalize(words[1]), family_initial: words[0].charAt(0).toLocaleUpperCase('mn') };
  }
  return { first_name: capitalize(t), family_initial: null };
}

/**
 * Turns pasted text into students. Accepts one name per line in any of these forms:
 *   Тэмүүлэн · Б. Тэмүүлэн · Б.Тэмүүлэн · Тэмүүлэн Б · Бат Тэмүүлэн
 * and rows copied from Excel (tab-separated): a number column, the name, the
 * family initial and the gender may come in any order. Header rows are skipped.
 */
export function parseStudentLines(text: string): ParsedStudent[] {
  const out: ParsedStudent[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const cells = rawLine
      .split(/\t|;/)
      .map((c) => c.trim())
      .filter((c) => c !== '');
    if (cells.length === 0) continue;
    if (HEADER.test(cells[0]) && cells.every((c) => !/\d/.test(c) && c.length < 30) && out.length === 0) {
      // first non-empty row that looks like column titles
      if (cells.some((c) => /нэр|овог|сурагч|хүйс|№/iu.test(c))) continue;
    }

    let initial: string | null = null;
    let gender: 'male' | 'female' | null = null;
    const nameCells: string[] = [];
    for (const cell of cells) {
      if (/^\d+[.)]?$/.test(cell)) continue; // row number
      const g = parseGender(cell);
      if (g && cells.length > 1) {
        gender = g;
        continue;
      }
      if (SINGLE_LETTER.test(cell) && cells.length > 1) {
        initial = cell.charAt(0).toLocaleUpperCase('mn');
        continue;
      }
      nameCells.push(cell);
    }
    if (nameCells.length === 0) continue;

    let first_name: string;
    if (initial) {
      first_name = capitalize(nameCells[nameCells.length - 1]);
    } else if (nameCells.length >= 2) {
      // two text columns: "Овог | Нэр"
      first_name = capitalize(nameCells[1]);
      initial = nameCells[0].charAt(0).toLocaleUpperCase('mn');
    } else {
      const single = parseSingle(nameCells[0].replace(/^\d+[.)]\s*/, ''));
      first_name = single.first_name;
      initial = single.family_initial;
    }
    if (!first_name) continue;
    out.push({ first_name, family_initial: initial, gender });
  }
  return out;
}
