// "Унагын зам": the foal walks a grid maze to its ger.
import { Crashed, GoalReached, TooLong, type Dir, type MazeLevel, type MazeStep } from './types.ts';

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const RELATIVE = { ahead: 0, right: 1, behind: 2, left: 3 } as const;
export type Relative = keyof typeof RELATIVE;

export function findCell(grid: string[], ch: string): { x: number; y: number } {
  for (let y = 0; y < grid.length; y++) {
    const x = grid[y].indexOf(ch);
    if (x >= 0) return { x, y };
  }
  throw new Error(`maze has no "${ch}"`);
}

export function isOpen(grid: string[], x: number, y: number): boolean {
  const row = grid[y];
  return row !== undefined && x >= 0 && x < row.length && row[x] !== '#';
}

/** The functions the maze blocks call, plus the steps they produced. */
export function createMaze(level: MazeLevel, maxSteps = 400) {
  const start = findCell(level.grid, 'S');
  const goal = findCell(level.grid, 'G');
  let x = start.x;
  let y = start.y;
  let dir: Dir = level.startDir;
  const steps: MazeStep[] = [];

  const count = () => {
    if (steps.length >= maxSteps) throw new TooLong();
  };
  const move = (back: boolean, block?: string) => {
    count();
    const d = back ? (dir + 2) % 4 : dir;
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (!isOpen(level.grid, nx, ny)) {
      steps.push({ kind: 'bump', block });
      throw new Crashed('wall');
    }
    x = nx;
    y = ny;
    steps.push({ kind: 'move', x, y, block });
    if (x === goal.x && y === goal.y) throw new GoalReached();
  };
  const turn = (delta: 1 | -1, block?: string) => {
    count();
    dir = ((dir + delta + 4) % 4) as Dir;
    steps.push({ kind: 'turn', dir, block });
  };
  const api = {
    moveForward: (block?: string) => move(false, block),
    moveBackward: (block?: string) => move(true, block),
    turnLeft: (block?: string) => turn(-1, block),
    turnRight: (block?: string) => turn(1, block),
    isPath: (where: Relative) => {
      const d = (dir + (RELATIVE[where] ?? 0)) % 4;
      return isOpen(level.grid, x + DX[d], y + DY[d]);
    },
    atGoal: () => x === goal.x && y === goal.y,
  };
  return { api, steps, atGoal: api.atGoal };
}
