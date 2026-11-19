// "Шувуу": the bird picks every berry, then lands on its nest.
// The program runs again on every tick and only decides the heading;
// the bird keeps flying one unit per tick in that direction.
import { Crashed, GoalReached, type BirdFrame, type BirdLevel, type Point, type Rect } from './types.ts';

export const WORLD = 100;
export const PICK_RADIUS = 6;
export const MAX_TICKS = 400;

const inside = (p: Point, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const near = (a: Point, b: Point, r: number) => Math.hypot(a.x - b.x, a.y - b.y) <= r;

export function createBird(level: BirdLevel) {
  let x = level.start.x;
  let y = level.start.y;
  let heading = level.startHeading;
  const left = new Set(level.berries.map((_, i) => i));
  const collected: number[] = [];
  const frames: BirdFrame[] = [{ x, y, heading, left: left.size }];

  const api = {
    heading: (angle: number) => {
      if (Number.isFinite(angle)) heading = ((angle % 360) + 360) % 360;
    },
    hasAllBerries: () => left.size === 0,
    getX: () => Math.round(x),
    getY: () => Math.round(y),
  };

  /** One unit of flight. Throws when the bird lands home or crashes. */
  const step = () => {
    const rad = (heading * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
    const p = { x, y };
    for (const i of [...left]) {
      if (near(p, level.berries[i], PICK_RADIUS)) {
        left.delete(i);
        collected.push(i);
      }
    }
    frames.push({ x, y, heading, left: left.size });
    if (x < 0 || x > WORLD || y < 0 || y > WORLD) throw new Crashed('out_of_bounds');
    if (level.walls.some((w) => inside(p, w))) throw new Crashed('wall');
    if (left.size === 0 && near(p, level.nest, PICK_RADIUS)) throw new GoalReached();
  };

  return { api, step, frames, collected };
}
