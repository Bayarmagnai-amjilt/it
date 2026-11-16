// "Яст мэлхий": the turtle draws with its pen; the drawing must match the target.
import { TooLong, type Segment, type TurtleLevel, type TurtleStep } from './types.ts';

export const CANVAS = 200;
const MAX_STEPS = 3000;
const MAX_DISTANCE = 40000;

export function createTurtle(start: TurtleLevel['start']) {
  let x = start.x;
  let y = start.y;
  let heading = start.heading;
  let pen = true;
  let colour = '#1F2937';
  let distance = 0;
  const steps: TurtleStep[] = [];

  const count = (d = 0) => {
    distance += Math.abs(d);
    if (steps.length >= MAX_STEPS || distance > MAX_DISTANCE) throw new TooLong();
  };
  const move = (d: number, block?: string) => {
    const n = Number(d);
    if (!Number.isFinite(n)) return;
    count(n);
    const rad = (heading * Math.PI) / 180;
    const nx = x + Math.sin(rad) * n;
    const ny = y - Math.cos(rad) * n;
    if (pen) steps.push({ kind: 'line', seg: { x1: x, y1: y, x2: nx, y2: ny, colour }, block });
    else steps.push({ kind: 'move', x: nx, y: ny, block });
    x = nx;
    y = ny;
  };
  const turn = (deg: number, block?: string) => {
    const n = Number(deg);
    if (!Number.isFinite(n)) return;
    count();
    heading = (((heading + n) % 360) + 360) % 360;
    steps.push({ kind: 'turn', heading, block });
  };
  const api = {
    forward: (d: number, block?: string) => move(d, block),
    backward: (d: number, block?: string) => move(-d, block),
    turnRight: (deg: number, block?: string) => turn(deg, block),
    turnLeft: (deg: number, block?: string) => turn(-deg, block),
    penUp: () => {
      pen = false;
    },
    penDown: () => {
      pen = true;
    },
    penColour: (c: string) => {
      if (typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c)) colour = c;
    },
  };
  return { api, steps };
}

export function segmentsOf(steps: TurtleStep[]): Segment[] {
  return steps.flatMap((s) => (s.kind === 'line' ? [s.seg] : []));
}

// --- comparing two drawings ---------------------------------------------------
// Both drawings are traced onto a coarse grid; they match when almost every cell
// of each lies on (or right next to) the other. Colour does not matter.
const CELL = 2;
const SIDE = CANVAS / CELL;

function trace(segs: Segment[]): Set<number> {
  const cells = new Set<number>();
  for (const s of segs) {
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    const n = Math.max(1, Math.ceil(len * 2));
    for (let i = 0; i <= n; i++) {
      const cx = Math.floor((s.x1 + ((s.x2 - s.x1) * i) / n) / CELL);
      const cy = Math.floor((s.y1 + ((s.y2 - s.y1) * i) / n) / CELL);
      if (cx >= 0 && cx < SIDE && cy >= 0 && cy < SIDE) cells.add(cy * SIDE + cx);
    }
  }
  return cells;
}

function grow(cells: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const c of cells) {
    const cx = c % SIDE;
    const cy = Math.floor(c / SIDE);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < SIDE && ny >= 0 && ny < SIDE) out.add(ny * SIDE + nx);
      }
    }
  }
  return out;
}

export function sameDrawing(user: Segment[], target: Segment[]): boolean {
  const t = trace(target);
  const u = trace(user);
  if (t.size === 0) return u.size === 0;
  const tWide = grow(t);
  const uWide = grow(u);
  let missing = 0;
  for (const c of t) if (!uWide.has(c)) missing++;
  let extra = 0;
  for (const c of u) if (!tWide.has(c)) extra++;
  return missing <= t.size * 0.03 && extra <= Math.max(2, u.size * 0.03);
}
