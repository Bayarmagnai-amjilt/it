// Runs a program made of blocks against a level. Called inside a Web Worker
// (lib/games/runner.worker.ts) and by the tests, never on the main thread.
import { createBird, MAX_TICKS } from './bird.ts';
import { createMaze } from './maze.ts';
import { createTurtle, sameDrawing, segmentsOf } from './turtle.ts';
import { makeLoopTrap, stopReason, type FailReason, type Level, type RunResult, type Segment, type TurtleLevel } from './types.ts';

// Shadowed with undefined inside the program, so generated code cannot reach
// the network, storage or the page even by accident. ("eval" cannot be a
// parameter name in strict mode; the worker removes it from its global instead.)
const SHADOWED = [
  'self', 'globalThis', 'window', 'document', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
  'importScripts', 'postMessage', 'close', 'indexedDB', 'caches', 'localStorage', 'sessionStorage',
  'navigator', 'location', 'Function', 'setTimeout', 'setInterval', 'Worker', 'SharedWorker',
  'BroadcastChannel', 'require', 'process',
];

function compile(code: string, api: Record<string, unknown>): () => void {
  const names = Object.keys(api);
  const fn = new Function(...names, ...SHADOWED, `'use strict';\n${code}`);
  return () => fn(...names.map((n) => api[n]), ...SHADOWED.map(() => undefined));
}

export function targetSegments(level: TurtleLevel): Segment[] {
  const t = createTurtle(level.start);
  compile(level.target, { ...t.api, loopTrap: makeLoopTrap() })();
  return segmentsOf(t.steps);
}

export function runProgram(level: Level, code: string): RunResult {
  const loopTrap = makeLoopTrap(level.game === 'bird' ? 200000 : 10000);
  let reason: FailReason | undefined;

  if (level.game === 'maze') {
    const maze = createMaze(level);
    try {
      compile(code, { ...maze.api, loopTrap })();
      reason = maze.atGoal() ? undefined : 'not_finished';
    } catch (error) {
      reason = stopReason(error);
    }
    return { game: 'maze', ok: reason === undefined, reason, steps: maze.steps };
  }

  if (level.game === 'bird') {
    const bird = createBird(level);
    try {
      const program = compile(code, { ...bird.api, loopTrap });
      reason = 'not_finished';
      for (let t = 0; t < MAX_TICKS; t++) {
        program();
        bird.step();
      }
    } catch (error) {
      reason = stopReason(error);
    }
    return { game: 'bird', ok: reason === undefined, reason, frames: bird.frames, collected: bird.collected };
  }

  const turtle = createTurtle(level.start);
  try {
    compile(code, { ...turtle.api, loopTrap })();
    reason = sameDrawing(segmentsOf(turtle.steps), targetSegments(level)) ? undefined : 'wrong_drawing';
  } catch (error) {
    reason = stopReason(error);
  }
  return { game: 'turtle', ok: reason === undefined, reason, steps: turtle.steps };
}
