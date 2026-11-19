// Block-coding games: level definitions and what a run produces.
// Self-contained (no "@/..." imports) so the Web Worker and the tests can load it.

export type GameId = 'maze' | 'bird' | 'turtle';

/** Block types a level may offer in its toolbox (see lib/games/blocks.ts). */
export type BlockId =
  // maze
  | 'maze_forward' | 'maze_backward' | 'maze_turn_left' | 'maze_turn_right'
  | 'maze_until_goal' | 'maze_if' | 'maze_if_else' | 'maze_path'
  // bird
  | 'bird_heading' | 'bird_has_all' | 'bird_x' | 'bird_y'
  // turtle
  | 'turtle_forward' | 'turtle_backward' | 'turtle_turn_right' | 'turtle_turn_left'
  | 'turtle_pen' | 'turtle_colour'
  // shared (Blockly's own blocks)
  | 'repeat' | 'while' | 'if' | 'if_else' | 'compare' | 'logic' | 'not' | 'number' | 'arithmetic'
  | 'variables' | 'functions';

export interface StarRule {
  /** at most this many blocks for 3 stars */
  three: number;
  /** at most this many blocks for 2 stars; any working program gets at least 1 */
  two: number;
}

interface LevelBase {
  game: GameId;
  level: number;
  title: string;
  /** what the level teaches: sequence, loop, condition, function, variable */
  concept: 'sequence' | 'loop' | 'condition' | 'function' | 'variable';
  /** short task shown above the stage */
  goal: string;
  hint: string;
  blocks: BlockId[];
  stars: StarRule;
}

export type Dir = 0 | 1 | 2 | 3; // north, east, south, west

/** Grid rows: '#' wall, '.' path, 'S' start, 'G' goal (the ger). */
export interface MazeLevel extends LevelBase {
  game: 'maze';
  grid: string[];
  startDir: Dir;
}

export interface Point {
  x: number;
  y: number;
}

/** Axis-aligned rectangle in world units. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** World is 100 x 100, y grows upwards (like maths), heading 0° = east, 90° = north. */
export interface BirdLevel extends LevelBase {
  game: 'bird';
  start: Point;
  startHeading: number;
  berries: Point[];
  nest: Point;
  walls: Rect[];
}

/** Turtle canvas is 200 x 200, y grows downwards, heading 0° = up, clockwise. */
export interface TurtleLevel extends LevelBase {
  game: 'turtle';
  start: Point & { heading: number };
  /** the drawing to copy, as a program in the same API the blocks call */
  target: string;
}

export type Level = MazeLevel | BirdLevel | TurtleLevel;

/** Why a run did not reach the goal. */
export type FailReason = 'wall' | 'not_finished' | 'too_long' | 'timeout' | 'error' | 'out_of_bounds' | 'wrong_drawing';

export type MazeStep =
  | { kind: 'move'; x: number; y: number; block?: string }
  | { kind: 'turn'; dir: Dir; block?: string }
  | { kind: 'bump'; block?: string };

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colour: string;
}

export type TurtleStep =
  | { kind: 'line'; seg: Segment; block?: string }
  | { kind: 'move'; x: number; y: number; block?: string }
  | { kind: 'turn'; heading: number; block?: string };

export interface BirdFrame {
  x: number;
  y: number;
  heading: number;
  /** berries still on the map */
  left: number;
}

export type RunResult =
  | { game: 'maze'; ok: boolean; reason?: FailReason; steps: MazeStep[] }
  | { game: 'bird'; ok: boolean; reason?: FailReason; frames: BirdFrame[]; collected: number[] }
  | { game: 'turtle'; ok: boolean; reason?: FailReason; steps: TurtleStep[] };

/** Signal thrown to stop the user's program as soon as the goal is reached. */
export class GoalReached extends Error {
  constructor() {
    super('goal');
  }
}

/** Signal thrown when a program runs too many steps. */
export class TooLong extends Error {
  constructor() {
    super('too_long');
  }
}

/** Signal thrown when the program crashes the character into something. */
export class Crashed extends Error {
  readonly reason: 'wall' | 'out_of_bounds';
  constructor(reason: 'wall' | 'out_of_bounds') {
    super(reason);
    this.reason = reason;
  }
}

/** Loop guard the generated code calls on every pass of every loop. */
export function makeLoopTrap(limit = 10000): () => void {
  let left = limit;
  return () => {
    if (--left < 0) throw new TooLong();
  };
}

/** Turns whatever stopped a program into a result reason (undefined = reached the goal). */
export function stopReason(error: unknown): FailReason | undefined {
  if (error instanceof GoalReached) return undefined;
  if (error instanceof Crashed) return error.reason;
  if (error instanceof TooLong) return 'too_long';
  return 'error';
}

export function starsFor(blockCount: number, rule: StarRule): 1 | 2 | 3 {
  if (blockCount <= rule.three) return 3;
  if (blockCount <= rule.two) return 2;
  return 1;
}
