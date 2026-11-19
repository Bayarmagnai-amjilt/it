// Browser only (loaded with a dynamic import): Blockly, our game blocks in
// Mongolian, the JavaScript each block generates, and the toolbox of a level.
import * as Blockly from 'blockly/core';
import 'blockly/blocks';
import { javascriptGenerator, Order } from 'blockly/javascript';
import * as En from 'blockly/msg/en';
import { mn } from '@/locales/mn';
import type { BlockId, Level } from './types';

const M = mn.blockly;
const MOVE = 160;
const LOOP = 120;
const LOGIC = 210;
const PEN = 290;

export const COLOURS: [string, string][] = M.COLOURS.split(',').map((name, i) => [
  name,
  ['#1F2937', '#EF4444', '#4458F2', '#22C493', '#E0A30B', '#EC4899'][i] ?? '#1F2937',
]);

const statement = (type: string, message0: string, colour: number, tooltip: string, args0: object[] = []) => ({
  type,
  message0,
  args0,
  previousStatement: null,
  nextStatement: null,
  colour,
  tooltip,
});

const DIRECTIONS = [
  [M.MAZE_AHEAD, 'ahead'],
  [M.MAZE_LEFT, 'left'],
  [M.MAZE_RIGHT, 'right'],
];

let ready = false;

/** Registers the blocks, generators and messages once per page. */
function setup() {
  if (ready) return;
  ready = true;
  Blockly.setLocale(En as unknown as Record<string, string>);
  for (const [key, value] of Object.entries(M)) Blockly.Msg[key] = value;

  Blockly.common.defineBlocksWithJsonArray([
    statement('maze_forward', `${M.MAZE_FORWARD} ⬆`, MOVE, M.MAZE_FORWARD_TIP),
    statement('maze_backward', `${M.MAZE_BACKWARD} ⬇`, MOVE, M.MAZE_BACKWARD_TIP),
    statement('maze_turn_left', M.MAZE_TURN_LEFT, MOVE, M.MAZE_TURN_TIP),
    statement('maze_turn_right', M.MAZE_TURN_RIGHT, MOVE, M.MAZE_TURN_TIP),
    {
      type: 'maze_until_goal',
      message0: `${M.MAZE_UNTIL_GOAL} 🏠`,
      message1: `${M.MAZE_DO} %1`,
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: LOOP,
      tooltip: M.MAZE_UNTIL_TIP,
    },
    {
      type: 'maze_if',
      message0: `${M.MAZE_IF} %1 ${M.MAZE_PATH}`,
      args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
      message1: `${M.MAZE_DO} %1`,
      args1: [{ type: 'input_statement', name: 'DO' }],
      previousStatement: null,
      nextStatement: null,
      colour: LOGIC,
      tooltip: M.MAZE_IF_TIP,
    },
    {
      type: 'maze_if_else',
      message0: `${M.MAZE_IF} %1 ${M.MAZE_PATH}`,
      args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
      message1: `${M.MAZE_DO} %1`,
      args1: [{ type: 'input_statement', name: 'DO' }],
      message2: `${M.MAZE_ELSE} %1`,
      args2: [{ type: 'input_statement', name: 'ELSE' }],
      previousStatement: null,
      nextStatement: null,
      colour: LOGIC,
      tooltip: M.MAZE_IF_TIP,
    },
    {
      type: 'maze_path',
      message0: `%1 ${M.MAZE_PATH_BOOL}`,
      args0: [{ type: 'field_dropdown', name: 'DIR', options: DIRECTIONS }],
      output: 'Boolean',
      colour: LOGIC,
      tooltip: M.MAZE_IF_TIP,
    },
    statement('bird_heading', `${M.BIRD_HEADING} %1 ${M.BIRD_DEGREES}`, MOVE, M.BIRD_HEADING_TIP, [
      { type: 'input_value', name: 'ANGLE', check: 'Number' },
    ]),
    { type: 'bird_has_all', message0: `${M.BIRD_HAS_ALL} 🍇`, output: 'Boolean', colour: LOGIC, tooltip: M.BIRD_HAS_ALL_TIP },
    { type: 'bird_x', message0: M.BIRD_X, output: 'Number', colour: LOGIC, tooltip: M.BIRD_XY_TIP },
    { type: 'bird_y', message0: M.BIRD_Y, output: 'Number', colour: LOGIC, tooltip: M.BIRD_XY_TIP },
    statement('turtle_forward', `${M.TURTLE_FORWARD} %1 ${M.TURTLE_STEPS}`, MOVE, M.TURTLE_MOVE_TIP, [
      { type: 'input_value', name: 'STEPS', check: 'Number' },
    ]),
    statement('turtle_backward', `${M.TURTLE_BACKWARD} %1 ${M.TURTLE_STEPS}`, MOVE, M.TURTLE_MOVE_TIP, [
      { type: 'input_value', name: 'STEPS', check: 'Number' },
    ]),
    statement('turtle_turn_right', `${M.TURTLE_TURN_RIGHT} %1 ${M.TURTLE_DEGREES} ↻`, MOVE, M.TURTLE_TURN_TIP, [
      { type: 'input_value', name: 'ANGLE', check: 'Number' },
    ]),
    statement('turtle_turn_left', `${M.TURTLE_TURN_LEFT} %1 ${M.TURTLE_DEGREES} ↺`, MOVE, M.TURTLE_TURN_TIP, [
      { type: 'input_value', name: 'ANGLE', check: 'Number' },
    ]),
    statement('turtle_pen', '%1 ✏️', PEN, M.TURTLE_PEN_TIP, [
      { type: 'field_dropdown', name: 'PEN', options: [[M.TURTLE_PEN_UP, 'up'], [M.TURTLE_PEN_DOWN, 'down']] },
    ]),
    statement('turtle_colour', `${M.TURTLE_COLOUR} %1`, PEN, M.TURTLE_PEN_TIP, [
      { type: 'field_dropdown', name: 'COLOUR', options: COLOURS.map(([name, hex]) => [name, hex]) },
    ]),
  ]);

  const js = javascriptGenerator;
  const id = (block: Blockly.Block) => JSON.stringify(block.id);
  const dir = (block: Blockly.Block) => JSON.stringify(['ahead', 'left', 'right'].includes(block.getFieldValue('DIR')) ? block.getFieldValue('DIR') : 'ahead');
  const num = (block: Blockly.Block, name: string, fallback: string) => js.valueToCode(block, name, Order.NONE) || fallback;
  js.INFINITE_LOOP_TRAP = 'loopTrap();\n';
  js.addReservedWords(
    'moveForward,moveBackward,turnLeft,turnRight,isPath,atGoal,heading,hasAllBerries,getX,getY,forward,backward,penUp,penDown,penColour,loopTrap',
  );
  js.forBlock['maze_forward'] = (b) => `moveForward(${id(b)});\n`;
  js.forBlock['maze_backward'] = (b) => `moveBackward(${id(b)});\n`;
  js.forBlock['maze_turn_left'] = (b) => `turnLeft(${id(b)});\n`;
  js.forBlock['maze_turn_right'] = (b) => `turnRight(${id(b)});\n`;
  js.forBlock['maze_until_goal'] = (b, g) => `while (!atGoal()) {\n${g.addLoopTrap(g.statementToCode(b, 'DO'), b)}}\n`;
  js.forBlock['maze_if'] = (b, g) => `if (isPath(${dir(b)})) {\n${g.statementToCode(b, 'DO')}}\n`;
  js.forBlock['maze_if_else'] = (b, g) =>
    `if (isPath(${dir(b)})) {\n${g.statementToCode(b, 'DO')}} else {\n${g.statementToCode(b, 'ELSE')}}\n`;
  js.forBlock['maze_path'] = (b) => [`isPath(${dir(b)})`, Order.FUNCTION_CALL];
  js.forBlock['bird_heading'] = (b) => `heading(${num(b, 'ANGLE', '0')});\n`;
  js.forBlock['bird_has_all'] = () => ['hasAllBerries()', Order.FUNCTION_CALL];
  js.forBlock['bird_x'] = () => ['getX()', Order.FUNCTION_CALL];
  js.forBlock['bird_y'] = () => ['getY()', Order.FUNCTION_CALL];
  js.forBlock['turtle_forward'] = (b) => `forward(${num(b, 'STEPS', '0')}, ${id(b)});\n`;
  js.forBlock['turtle_backward'] = (b) => `backward(${num(b, 'STEPS', '0')}, ${id(b)});\n`;
  js.forBlock['turtle_turn_right'] = (b) => `turnRight(${num(b, 'ANGLE', '0')}, ${id(b)});\n`;
  js.forBlock['turtle_turn_left'] = (b) => `turnLeft(${num(b, 'ANGLE', '0')}, ${id(b)});\n`;
  js.forBlock['turtle_pen'] = (b) => (b.getFieldValue('PEN') === 'up' ? 'penUp();\n' : 'penDown();\n');
  js.forBlock['turtle_colour'] = (b) => `penColour(${JSON.stringify(String(b.getFieldValue('COLOUR')))});\n`;
}

type ToolboxBlock = Blockly.utils.toolbox.BlockInfo;
const shadowNumber = (n: number) => ({ shadow: { type: 'math_number', fields: { NUM: n } } });
const VARIABLE = { name: 'n' };

const TOOLBOX: Record<Exclude<BlockId, 'functions'>, ToolboxBlock[]> = {
  maze_forward: [{ kind: 'block', type: 'maze_forward' }],
  maze_backward: [{ kind: 'block', type: 'maze_backward' }],
  maze_turn_left: [{ kind: 'block', type: 'maze_turn_left' }],
  maze_turn_right: [{ kind: 'block', type: 'maze_turn_right' }],
  maze_until_goal: [{ kind: 'block', type: 'maze_until_goal' }],
  maze_if: [{ kind: 'block', type: 'maze_if' }],
  maze_if_else: [{ kind: 'block', type: 'maze_if_else' }],
  maze_path: [{ kind: 'block', type: 'maze_path' }],
  bird_heading: [{ kind: 'block', type: 'bird_heading', inputs: { ANGLE: shadowNumber(0) } }],
  bird_has_all: [{ kind: 'block', type: 'bird_has_all' }],
  bird_x: [{ kind: 'block', type: 'bird_x' }],
  bird_y: [{ kind: 'block', type: 'bird_y' }],
  turtle_forward: [{ kind: 'block', type: 'turtle_forward', inputs: { STEPS: shadowNumber(100) } }],
  turtle_backward: [{ kind: 'block', type: 'turtle_backward', inputs: { STEPS: shadowNumber(100) } }],
  turtle_turn_right: [{ kind: 'block', type: 'turtle_turn_right', inputs: { ANGLE: shadowNumber(90) } }],
  turtle_turn_left: [{ kind: 'block', type: 'turtle_turn_left', inputs: { ANGLE: shadowNumber(90) } }],
  turtle_pen: [{ kind: 'block', type: 'turtle_pen' }],
  turtle_colour: [{ kind: 'block', type: 'turtle_colour' }],
  repeat: [{ kind: 'block', type: 'controls_repeat_ext', inputs: { TIMES: shadowNumber(4) } }],
  while: [{ kind: 'block', type: 'controls_whileUntil' }],
  if: [{ kind: 'block', type: 'controls_if' }],
  if_else: [{ kind: 'block', type: 'controls_ifelse' }],
  compare: [{ kind: 'block', type: 'logic_compare', fields: { OP: 'LT' }, inputs: { B: shadowNumber(50) } }],
  logic: [{ kind: 'block', type: 'logic_operation' }],
  not: [{ kind: 'block', type: 'logic_negate' }],
  number: [{ kind: 'block', type: 'math_number' }],
  arithmetic: [{ kind: 'block', type: 'math_arithmetic' }],
  // one ready-made variable "n": set, read, add to
  variables: [
    { kind: 'block', type: 'variables_set', fields: { VAR: VARIABLE }, inputs: { VALUE: shadowNumber(1) } },
    { kind: 'block', type: 'variables_get', fields: { VAR: VARIABLE } },
    { kind: 'block', type: 'math_change', fields: { VAR: VARIABLE }, inputs: { DELTA: shadowNumber(1) } },
  ],
};

function toolboxFor(level: Level): Blockly.utils.toolbox.ToolboxDefinition {
  const blocks = level.blocks.filter((b): b is Exclude<BlockId, 'functions'> => b !== 'functions').flatMap((b) => TOOLBOX[b]);
  if (!level.blocks.includes('functions')) return { kind: 'flyoutToolbox', contents: blocks };
  return {
    kind: 'categoryToolbox',
    contents: [
      { kind: 'category', name: mn.games.categories.blocks, colour: String(MOVE), contents: blocks },
      { kind: 'category', name: mn.games.categories.functions, colour: '290', custom: 'PROCEDURE' },
    ],
  };
}

export interface GameWorkspace {
  workspace: Blockly.WorkspaceSvg;
  code(): string;
  blockCount(): number;
  save(): object;
  highlight(id: string | null): void;
  dispose(): void;
}

/** Puts a Blockly editor for the level into `host`, restoring `saved` if given. */
export function createWorkspace(host: HTMLElement, level: Level, saved: object | null, onChange: () => void): GameWorkspace {
  setup();
  const workspace = Blockly.inject(host, {
    toolbox: toolboxFor(level),
    renderer: 'zelos',
    media: '/blockly-media/',
    sounds: false,
    trashcan: false,
    zoom: { controls: false, wheel: true, startScale: 0.8, maxScale: 1.4, minScale: 0.5 },
    move: { scrollbars: true, drag: true, wheel: false },
    grid: { spacing: 24, length: 2, colour: '#d0cde6', snap: true },
    maxBlocks: Math.max(30, level.stars.two * 4),
  });
  if (saved) {
    try {
      Blockly.serialization.workspaces.load(saved, workspace);
    } catch {
      workspace.clear();
    }
  }
  workspace.addChangeListener((e) => {
    if (!e.isUiEvent) onChange();
  });
  return {
    workspace,
    code: () => javascriptGenerator.workspaceToCode(workspace),
    blockCount: () => workspace.getAllBlocks(false).filter((b) => !b.isShadow() && b.isEnabled()).length,
    save: () => Blockly.serialization.workspaces.save(workspace),
    highlight: (blockId) => workspace.highlightBlock(blockId),
    dispose: () => workspace.dispose(),
  };
}
