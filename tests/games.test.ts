import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BIRD_LEVELS, MAZE_LEVELS, TURTLE_LEVELS } from '../lib/games/levels.ts';
import { runProgram } from '../lib/games/run.ts';
import type { Level } from '../lib/games/types.ts';

// A reference solution per level, written the way the blocks generate code,
// with the number of blocks it takes. Each must solve its level within the
// three-star count, so every level is winnable with full stars.
const MAZE: [string, number][] = [
  ['moveForward(); moveForward();', 2],
  ['moveForward(); moveForward(); turnRight(); moveForward(); moveForward();', 5],
  ['moveBackward(); moveBackward(); moveBackward();', 3],
  ['moveForward(); turnRight(); moveForward(); turnLeft(); moveForward(); turnRight(); moveForward(); turnLeft(); moveForward();', 9],
  ['for (let i = 0; i < 7; i++) { loopTrap(); moveForward(); }', 2],
  ['for (let i = 0; i < 5; i++) { loopTrap(); moveForward(); turnLeft(); moveForward(); turnRight(); }', 5],
  ['while (!atGoal()) { loopTrap(); moveForward(); }', 2],
  ["while (!atGoal()) { loopTrap(); if (isPath('right')) { turnRight(); } moveForward(); }", 4],
  ["while (!atGoal()) { loopTrap(); if (isPath('ahead')) { moveForward(); } else { turnLeft(); } }", 4],
  [
    "while (!atGoal()) { loopTrap(); if (isPath('left')) { turnLeft(); } if (isPath('ahead')) { moveForward(); } else { turnRight(); } }",
    6,
  ],
  [
    'function step() { moveForward(); moveForward(); turnRight(); moveForward(); moveForward(); turnLeft(); } step(); step(); step();',
    10,
  ],
  [
    'var n = 1; while (!atGoal()) { loopTrap(); for (let i = 0; i < n; i++) { loopTrap(); moveForward(); } turnRight(); n += 1; }',
    7,
  ],
];

const BIRD: [string, number][] = [
  ['heading(0);', 1],
  ['heading(45);', 1],
  ['if (hasAllBerries()) { heading(0); } else { heading(90); }', 4],
  ['if (hasAllBerries()) { heading(300); } else { if (getY() < 80) { heading(90); } else { heading(0); } }', 8],
  ['if (hasAllBerries()) { heading(135); } else { if (getX() < 88) { heading(0); } else { heading(90); } }', 8],
  ['if (hasAllBerries()) { heading(180); } else { if (getX() < 90) { heading(0); } else { heading(90); } }', 8],
];

const TURTLE: [string, number][] = [
  ['forward(100);', 1],
  ['forward(100); turnRight(90); forward(100);', 3],
  ['for (let i = 0; i < 4; i++) { loopTrap(); forward(100); turnRight(90); }', 3],
  ['for (let i = 0; i < 5; i++) { loopTrap(); forward(10); penUp(); forward(10); penDown(); }', 5],
  ['for (let i = 0; i < 3; i++) { loopTrap(); forward(100); turnRight(120); }', 3],
  [
    'forward(60); turnRight(30); forward(100); turnRight(120); forward(100); turnRight(30); forward(60); turnRight(90); forward(100);',
    9,
  ],
  ['for (let i = 0; i < 5; i++) { loopTrap(); forward(120); turnRight(144); }', 3],
  ['for (let i = 0; i < 36; i++) { loopTrap(); forward(10); turnRight(10); }', 3],
  [
    'for (let j = 0; j < 8; j++) { loopTrap(); for (let i = 0; i < 4; i++) { loopTrap(); forward(60); turnRight(90); } turnRight(45); }',
    5,
  ],
  ['var n = 10; for (let i = 0; i < 14; i++) { loopTrap(); forward(n); turnRight(90); n += 10; }', 6],
];

function check(levels: Level[], solutions: [string, number][]) {
  assert.equal(solutions.length, levels.length, 'one reference solution per level');
  levels.forEach((level, i) => {
    const [code, blocks] = solutions[i];
    const result = runProgram(level, code);
    assert.equal(result.ok, true, `${level.game} ${level.level} should be solved, got ${result.reason}`);
    assert.ok(blocks <= level.stars.three, `${level.game} ${level.level}: ${blocks} blocks > 3-star limit`);
    assert.ok(level.stars.two >= level.stars.three);
    assert.equal(level.level, i + 1, 'levels are numbered 1, 2, 3 …');
  });
}

test('every maze level is solvable with three stars', () => check(MAZE_LEVELS, MAZE));
test('every bird level is solvable with three stars', () => check(BIRD_LEVELS, BIRD));
test('every turtle level is solvable with three stars', () => check(TURTLE_LEVELS, TURTLE));

test('the maze reports walls, unfinished paths and endless loops', () => {
  const corridor = MAZE_LEVELS[0];
  assert.equal(runProgram(corridor, 'turnLeft(); moveForward();').reason, 'wall');
  assert.equal(runProgram(corridor, 'moveForward();').reason, 'not_finished');
  assert.equal(runProgram(MAZE_LEVELS[6], 'while (true) { loopTrap(); turnLeft(); }').reason, 'too_long');
  assert.equal(runProgram(corridor, 'nonsense();').reason, 'error');
});

test('the bird must collect every berry before landing', () => {
  // straight to the nest of level 3 without the berry: flies past and out of the world
  assert.notEqual(runProgram(BIRD_LEVELS[2], 'heading(0);').ok, true);
  assert.equal(runProgram(BIRD_LEVELS[3], 'heading(0);').reason, 'wall');
});

test('the turtle drawing must match the target', () => {
  assert.equal(runProgram(TURTLE_LEVELS[2], 'forward(100); turnRight(90); forward(100);').reason, 'wrong_drawing');
  assert.equal(runProgram(TURTLE_LEVELS[0], 'forward(120);').reason, 'wrong_drawing');
  assert.equal(runProgram(TURTLE_LEVELS[0], 'penColour("#EF4444"); forward(100);').ok, true);
});

test('user code cannot reach the network or storage', () => {
  const level = MAZE_LEVELS[0];
  assert.equal(runProgram(level, 'fetch("https://example.com");').reason, 'error');
  assert.equal(runProgram(level, 'globalThis.x = 1;').reason, 'error');
});
