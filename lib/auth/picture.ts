// Picture password hashing. Self-contained (node:crypto only) so tests can load it.
import { createHash, scryptSync } from 'node:crypto';

const TILE_IDS = ['horse', 'camel', 'ger', 'sun', 'star', 'moon', 'mountain', 'flower', 'fish'];

function pepper(): string {
  return process.env.PICTURE_PASSWORD_PEPPER ?? '';
}

/** A sequence of 2 or 3 known tile ids. Order matters; a tile may repeat. */
export function validPictures(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 3 &&
    value.every((v) => typeof v === 'string' && TILE_IDS.includes(v))
  );
}

/**
 * Nine tiles and three taps give only 729 combinations, so the hash alone cannot
 * protect a picture password: the database also limits wrong tries (5 per 10
 * minutes). The salt (student id) and the server-side pepper keep equal picture
 * choices of two students from producing equal hashes.
 */
export function hashPictures(studentId: string, pictures: string[]): string {
  return scryptSync(pictures.join('>'), `${studentId}:${pepper()}`, 32).toString('hex');
}

/** IP addresses are stored only as a short hash (login rate limiting). */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${ip}:${pepper()}`).digest('hex').slice(0, 32);
}
