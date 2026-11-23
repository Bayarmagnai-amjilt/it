// The three game boards in SVG. The characters are pictures in public/games/
// (drawn facing right); each board replays a run's steps up to `index`, so the
// player can animate by counting up.
import { findCell } from '@/lib/games/maze';
import { targetSegments } from '@/lib/games/run';
import type { BirdFrame, BirdLevel, Dir, MazeLevel, MazeStep, Segment, TurtleLevel, TurtleStep } from '@/lib/games/types';

const BOARD = 'block w-full rounded-2xl border-[3px] border-ink-900 bg-white shadow-brut';
const CELL = 40;

/**
 * A character picture centred on (0, 0). It is never rotated (a side view turned
 * upside down looks wrong); it is mirrored when the character goes left.
 */
function Sprite({ name, size, flip }: { name: 'foal' | 'bird' | 'turtle'; size: number; flip: boolean }) {
  return (
    <g transform={flip ? 'scale(-1 1)' : undefined}>
      <image href={`/games/${name}.webp`} x={-size / 2} y={-size / 2} width={size} height={size} preserveAspectRatio="xMidYMid meet" />
    </g>
  );
}

/** Little arrow beside a character showing exactly where it is heading (SVG degrees: 0 = right, clockwise). */
function Pointer({ angle, distance, size }: { angle: number; distance: number; size: number }) {
  return (
    <path
      transform={`rotate(${angle})`}
      d={`M ${distance + size} 0 L ${distance} ${-size * 0.75} L ${distance} ${size * 0.75} Z`}
      fill="#fbbf24"
      stroke="#1f1c3d"
      strokeWidth={size * 0.2}
      strokeLinejoin="round"
    />
  );
}

// --- "Унагын зам": the foal walks the grid to its ger ---------------------------
function Foal({ x, y, dir, left, bump }: { x: number; y: number; dir: Dir; left: boolean; bump: boolean }) {
  return (
    <g style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform 0.22s ease-in-out' }}>
      <g className={bump ? 'shake' : undefined}>
        <Sprite name="foal" size={CELL * 0.95} flip={left} />
        <Pointer angle={(dir - 1) * 90} distance={CELL * 0.4} size={7} />
      </g>
    </g>
  );
}

function Ger({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M -15 10 L -15 0 Q 0 -16 15 0 L 15 10 Z" fill="#ffffff" stroke="#1f1c3d" strokeWidth="2" />
      <path d="M -15 1 Q 0 -10 15 1" stroke="#ef4444" strokeWidth="2.5" fill="none" />
      <rect x="-4" y="2" width="8" height="8" fill="#fb6a1f" stroke="#1f1c3d" strokeWidth="1.5" />
      <circle cx="0" cy="-9" r="2" fill="#fbbf24" stroke="#1f1c3d" strokeWidth="1" />
    </g>
  );
}

export function MazeStage({ level, steps, index }: { level: MazeLevel; steps: MazeStep[] | null; index: number }) {
  const start = findCell(level.grid, 'S');
  const goal = findCell(level.grid, 'G');
  let x = start.x;
  let y = start.y;
  let dir = level.startDir;
  // facing north or south, the foal keeps looking the way it last went sideways
  let left = dir === 3;
  let bump = false;
  for (const s of (steps ?? []).slice(0, index)) {
    if (s.kind === 'move') {
      x = s.x;
      y = s.y;
    } else if (s.kind === 'turn') {
      dir = s.dir;
      if (dir === 1 || dir === 3) left = dir === 3;
    }
    bump = s.kind === 'bump';
  }
  const w = level.grid[0].length * CELL;
  const h = level.grid.length * CELL;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={BOARD} role="img" aria-label="maze">
      {level.grid.map((row, r) =>
        [...row].map((ch, c) =>
          ch === '#' ? (
            <g key={`${r}-${c}`}>
              <rect x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill="#22c493" />
              <path d={`M ${c * CELL + 10} ${r * CELL + 28} q 4 -10 8 0 q 4 -8 8 0`} stroke="#15835f" strokeWidth="2" fill="none" />
            </g>
          ) : (
            <rect key={`${r}-${c}`} x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill="#fff1c9" stroke="#ffe594" strokeWidth="1" />
          ),
        ),
      )}
      <Ger x={goal.x * CELL + CELL / 2} y={goal.y * CELL + CELL / 2} />
      <Foal x={x * CELL + CELL / 2} y={y * CELL + CELL / 2} dir={dir} left={left} bump={bump} />
    </svg>
  );
}

// --- "Шувуу": world 0..100 with y up, drawn with y flipped ---------------------
function Bird({ x, y, heading }: { x: number; y: number; heading: number }) {
  const left = Math.cos((heading * Math.PI) / 180) < -0.01;
  return (
    <g transform={`translate(${x} ${100 - y})`}>
      <Sprite name="bird" size={16} flip={left} />
      {/* heading is maths-style (counter-clockwise, y up); SVG turns clockwise */}
      <Pointer angle={-heading} distance={9} size={3.2} />
    </g>
  );
}

export function BirdStage({
  level,
  frames,
  collected,
  index,
}: {
  level: BirdLevel;
  frames: BirdFrame[] | null;
  collected: number[] | null;
  index: number;
}) {
  const shown = frames?.slice(0, Math.max(1, index + 1)) ?? [];
  const now = shown.at(-1) ?? { x: level.start.x, y: level.start.y, heading: level.startHeading, left: level.berries.length };
  const taken = new Set((collected ?? []).slice(0, level.berries.length - now.left));
  return (
    <svg viewBox="0 0 100 100" className={BOARD} role="img" aria-label="bird">
      <rect x="0" y="0" width="100" height="100" fill="#eef1ff" />
      {[20, 40, 60, 80].map((v) => (
        <g key={v} stroke="#dfe4ff" strokeWidth="0.3">
          <line x1={v} y1="0" x2={v} y2="100" />
          <line x1="0" y1={v} x2="100" y2={v} />
        </g>
      ))}
      {level.walls.map((w, i) => (
        <rect key={i} x={w.x} y={100 - w.y - w.h} width={w.w} height={w.h} rx="2" fill="#a07a55" stroke="#1f1c3d" strokeWidth="0.8" />
      ))}
      <g transform={`translate(${level.nest.x} ${100 - level.nest.y})`}>
        <ellipse rx="7" ry="4" fill="#8b5a2b" stroke="#1f1c3d" strokeWidth="0.8" />
        <path d="M -6 -1 L 6 1 M -5 1 L 5 -1" stroke="#5b3a1e" strokeWidth="0.6" />
      </g>
      {level.berries.map((b, i) =>
        taken.has(i) ? null : (
          <g key={i} transform={`translate(${b.x} ${100 - b.y})`}>
            <circle r="2.8" fill="#8b5cf6" stroke="#1f1c3d" strokeWidth="0.6" />
            <path d="M 0 -2.8 l 1.5 -2" stroke="#15835f" strokeWidth="0.8" />
          </g>
        ),
      )}
      {shown.length > 1 ? (
        <polyline points={shown.map((f) => `${f.x},${100 - f.y}`).join(' ')} fill="none" stroke="#9ba8ff" strokeWidth="0.6" strokeDasharray="1.5 1.5" />
      ) : null}
      <Bird x={now.x} y={now.y} heading={now.heading} />
    </svg>
  );
}

// --- "Яст мэлхий": the grey target and the turtle's own drawing ----------------
function TurtleShape({ x, y, heading }: { x: number; y: number; heading: number }) {
  const left = Math.sin((heading * Math.PI) / 180) < -0.01;
  return (
    <g transform={`translate(${x} ${y})`}>
      <Sprite name="turtle" size={28} flip={left} />
      {/* turtle heading: 0° = up, clockwise; SVG 0° = right */}
      <Pointer angle={heading - 90} distance={16} size={5.5} />
    </g>
  );
}

const line = (s: Segment, extra: { stroke: string; strokeWidth: number; opacity?: number }, key: number) => (
  <line key={key} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeLinecap="round" {...extra} />
);

export function TurtleStage({ level, steps, index }: { level: TurtleLevel; steps: TurtleStep[] | null; index: number }) {
  const target = targetSegments(level);
  let x = level.start.x;
  let y = level.start.y;
  let heading = level.start.heading;
  const drawn: Segment[] = [];
  for (const s of (steps ?? []).slice(0, index)) {
    if (s.kind === 'line') {
      drawn.push(s.seg);
      x = s.seg.x2;
      y = s.seg.y2;
    } else if (s.kind === 'move') {
      x = s.x;
      y = s.y;
    } else heading = s.heading;
  }
  return (
    <svg viewBox="0 0 200 200" className={BOARD} role="img" aria-label="turtle">
      <rect x="0" y="0" width="200" height="200" fill="#fffdf6" />
      {target.map((s, i) => line(s, { stroke: '#aeaacd', strokeWidth: 6, opacity: 0.45 }, i))}
      {drawn.map((s, i) => line(s, { stroke: s.colour, strokeWidth: 2.5 }, i))}
      <TurtleShape x={x} y={y} heading={heading} />
    </svg>
  );
}
