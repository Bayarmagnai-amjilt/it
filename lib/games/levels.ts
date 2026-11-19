// Every level of the three block games. Titles and star rules are copied to the
// puzzle_levels table (supabase/migrations/20261116000002_quizzes_games.sql),
// where the server reads the star rules; tests/games.test.ts proves each level
// can be solved within its three-star block count.
import type { BirdLevel, GameId, Level, MazeLevel, TurtleLevel } from './types.ts';

const MOVE = ['maze_forward', 'maze_turn_left', 'maze_turn_right'] as const;
const MOVE_BACK = [...MOVE, 'maze_backward'] as const;

export const MAZE_LEVELS: MazeLevel[] = [
  {
    game: 'maze', level: 1, title: 'Анхны алхам', concept: 'sequence',
    goal: 'Унагыг гэрт нь хүргэ.',
    hint: '«Урагш яв» блокийг хоёр удаа тавь.',
    blocks: [...MOVE], stars: { three: 2, two: 3 },
    grid: ['#####', '#S.G#', '#####'], startDir: 1,
  },
  {
    game: 'maze', level: 2, title: 'Булан тойрох', concept: 'sequence',
    goal: 'Булангаар эргээд гэрт хүр.',
    hint: 'Хананд тулахаасаа өмнө баруун тийш эргэ.',
    blocks: [...MOVE], stars: { three: 5, two: 7 },
    grid: ['#####', '#S..#', '###.#', '###G#', '#####'], startDir: 1,
  },
  {
    game: 'maze', level: 3, title: 'Ухрах', concept: 'sequence',
    goal: 'Гэр унагын ард байна. Эргэлгүйгээр хүрч чадах уу?',
    hint: '«Хойш яв» блок унагыг нүүрээ эргүүлэлгүйгээр ухраана.',
    blocks: [...MOVE_BACK], stars: { three: 3, two: 5 },
    grid: ['######', '#G..S#', '######'], startDir: 1,
  },
  {
    game: 'maze', level: 4, title: 'Тахир зам', concept: 'sequence',
    goal: 'Тахир замаар гэрт хүр.',
    hint: 'Зам бүрийн дараа аль тийш эргэхийг харж бай.',
    blocks: [...MOVE_BACK], stars: { three: 9, two: 12 },
    grid: ['######', '#S.###', '##..##', '###.G#', '######'], startDir: 1,
  },
  {
    game: 'maze', level: 5, title: 'Урт тал', concept: 'loop',
    goal: 'Хоёрхон блокоор гэрт хүр.',
    hint: '«… удаа давт» блок доторх алхмыг олон удаа хийнэ.',
    blocks: [...MOVE_BACK, 'repeat'], stars: { three: 2, two: 4 },
    grid: ['##########', '#S......G#', '##########'], startDir: 1,
  },
  {
    game: 'maze', level: 6, title: 'Шат', concept: 'loop',
    goal: 'Шатаар бууж гэрт хүр.',
    hint: 'Нэг шат = урагш, зүүн, урагш, баруун. Үүнийг давт.',
    blocks: [...MOVE_BACK, 'repeat'], stars: { three: 5, two: 7 },
    grid: ['########', '#S######', '#..#####', '##..####', '###..###', '####..##', '#####G##', '########'],
    startDir: 2,
  },
  {
    game: 'maze', level: 7, title: 'Гэр хүртэл', concept: 'loop',
    goal: 'Хэдэн алхам болохыг тоолохгүйгээр гэрт хүр.',
    hint: '«Гэрт хүрэх хүртэл давт» блок гэрт хүрэхэд өөрөө зогсоно.',
    blocks: [...MOVE, 'maze_until_goal'], stars: { three: 2, two: 3 },
    grid: ['############', '#S........G#', '############'], startDir: 1,
  },
  {
    game: 'maze', level: 8, title: 'Баруун эргэлт', concept: 'condition',
    goal: 'Баруун тийш зам гарвал эргэ.',
    hint: 'Давталт дотор: хэрэв баруун тийш зам байвал баруун эргэ, тэгээд урагш яв.',
    blocks: [...MOVE, 'maze_until_goal', 'maze_if'], stars: { three: 4, two: 5 },
    grid: ['#######', '#S....#', '#####.#', '#..G#.#', '#.###.#', '#.....#', '#######'], startDir: 1,
  },
  {
    game: 'maze', level: 9, title: 'Эсвэл', concept: 'condition',
    goal: 'Урд зам байвал урагш, үгүй бол зүүн тийш эргэ.',
    hint: '«Хэрэв … үгүй бол» блок хоёр замын нэгийг сонгоно.',
    blocks: [...MOVE, 'maze_until_goal', 'maze_if', 'maze_if_else'], stars: { three: 4, two: 6 },
    grid: ['#######', '#....S#', '#.#####', '#.#G..#', '#.###.#', '#.....#', '#######'], startDir: 3,
  },
  {
    game: 'maze', level: 10, title: 'Ороомог зам', concept: 'condition',
    goal: 'Зүүн гараа хананд хүргээд яв: зүүн тийш зам байвал тийшээ эргэ.',
    hint: 'Хэрэв зүүн тийш зам байвал зүүн эргэ. Дараа нь урд зам байвал урагш, үгүй бол баруун эргэ.',
    blocks: [...MOVE, 'maze_until_goal', 'maze_if', 'maze_if_else'], stars: { three: 6, two: 8 },
    grid: ['#########', '#S#...#G#', '#.#.#.#.#', '#...#...#', '##.###.##', '##.###.##', '#########'],
    startDir: 2,
  },
  {
    game: 'maze', level: 11, title: 'Функц', concept: 'function',
    goal: 'Нэг шатыг функц болгоод гурван удаа дууд.',
    hint: 'Функц: урагш, урагш, баруун, урагш, урагш, зүүн. Түүнийг 3 удаа дууд.',
    blocks: [...MOVE, 'functions'], stars: { three: 10, two: 13 },
    grid: [
      '#########', '#S..#####', '###.#####', '###...###', '#####.###', '#####...#', '#######.#', '#######G#', '#########',
    ],
    startDir: 1,
  },
  {
    game: 'maze', level: 12, title: 'Эргэлдэх зам', concept: 'variable',
    goal: 'Алхам бүр нэгээр урт болно: 1, 2, 3, 4 …',
    hint: 'n = 1. Гэрт хүртэл: n удаа урагш яв, баруун эргэ, n-г 1-ээр нэм.',
    blocks: [...MOVE, 'repeat', 'maze_until_goal', 'variables'], stars: { three: 7, two: 9 },
    grid: ['#########', '#......G#', '#.#######', '#.#...###', '#.#S#.###', '#.###.###', '#.....###', '#########'],
    startDir: 0,
  },
];

const BIRD_BASIC = ['bird_heading'] as const;
const BIRD_IF = ['bird_heading', 'bird_has_all', 'if', 'if_else'] as const;
const BIRD_XY = [...BIRD_IF, 'bird_x', 'bird_y', 'compare'] as const;

export const BIRD_LEVELS: BirdLevel[] = [
  {
    game: 'bird', level: 1, title: 'Баруун тийш', concept: 'sequence',
    goal: 'Жимсийг түүгээд үүрэндээ ниск.',
    hint: '0° бол баруун тийш (→). Шувуу одоо дээшээ харж байна.',
    blocks: [...BIRD_BASIC], stars: { three: 1, two: 2 },
    start: { x: 10, y: 50 }, startHeading: 90, berries: [{ x: 50, y: 50 }], nest: { x: 90, y: 50 }, walls: [],
  },
  {
    game: 'bird', level: 2, title: 'Ташуу нислэг', concept: 'sequence',
    goal: 'Ташуу нисээд жимс, үүрээ ол.',
    hint: '0° → баруун, 90° ↑ дээш. Дунд нь 45°.',
    blocks: [...BIRD_BASIC], stars: { three: 1, two: 2 },
    start: { x: 15, y: 15 }, startHeading: 0, berries: [{ x: 50, y: 50 }], nest: { x: 85, y: 85 }, walls: [],
  },
  {
    game: 'bird', level: 3, title: 'Эхлээд жимс', concept: 'condition',
    goal: 'Жимсээ түүсний дараа л үүр лүүгээ эргэ.',
    hint: 'Хэрэв бүх жимсийг түүсэн бол 0°, үгүй бол 90°.',
    blocks: [...BIRD_IF], stars: { three: 4, two: 5 },
    start: { x: 20, y: 20 }, startHeading: 0, berries: [{ x: 20, y: 80 }], nest: { x: 80, y: 76 }, walls: [],
  },
  {
    game: 'bird', level: 4, title: 'Ханын дээгүүр', concept: 'condition',
    goal: 'Хананы дээгүүр нисээд жимс түүж, үүртээ буу.',
    hint: 'y нь 80-аас бага бол дээшээ (90°), үгүй бол баруун тийш (0°). Жимс түүсний дараа 300°.',
    blocks: [...BIRD_XY], stars: { three: 8, two: 10 },
    start: { x: 15, y: 15 }, startHeading: 90, berries: [{ x: 50, y: 80 }], nest: { x: 85, y: 15 },
    walls: [{ x: 40, y: 0, w: 20, h: 50 }],
  },
  {
    game: 'bird', level: 5, title: 'Хоёр жимс', concept: 'condition',
    goal: 'Хоёр жимсийг хоёуланг нь түүгээд үүртээ ниск.',
    hint: 'x нь 88-аас бага бол 0°, үгүй бол 90°. Бүгдийг түүсэн бол 135°.',
    blocks: [...BIRD_XY], stars: { three: 8, two: 10 },
    start: { x: 10, y: 10 }, startHeading: 90, berries: [{ x: 50, y: 10 }, { x: 90, y: 50 }], nest: { x: 48, y: 88 },
    walls: [],
  },
  {
    game: 'bird', level: 6, title: 'Тойрог зам', concept: 'condition',
    goal: 'Дундах хадыг тойроод жимсээ түүж, үүртээ ниск.',
    hint: 'Эхлээд доод талаар баруун тийш, дараа нь дээш, эцэст нь зүүн тийш (180°).',
    blocks: [...BIRD_XY], stars: { three: 8, two: 10 },
    start: { x: 10, y: 10 }, startHeading: 90, berries: [{ x: 90, y: 90 }], nest: { x: 12, y: 86 },
    walls: [{ x: 30, y: 30, w: 40, h: 40 }],
  },
];

const PEN = ['turtle_forward', 'turtle_turn_right', 'turtle_turn_left', 'turtle_colour'] as const;

export const TURTLE_LEVELS: TurtleLevel[] = [
  {
    game: 'turtle', level: 1, title: 'Шулуун', concept: 'sequence',
    goal: 'Саарал зураасыг дагаж зур.',
    hint: '«Урагш 100 алх».',
    blocks: [...PEN], stars: { three: 1, two: 2 },
    start: { x: 100, y: 150, heading: 0 }, target: 'forward(100);',
  },
  {
    game: 'turtle', level: 2, title: 'Булан', concept: 'sequence',
    goal: 'Булан зур.',
    hint: 'Урагш 100, баруун тийш 90°, урагш 100.',
    blocks: [...PEN], stars: { three: 3, two: 4 },
    start: { x: 50, y: 150, heading: 0 }, target: 'forward(100); turnRight(90); forward(100);',
  },
  {
    game: 'turtle', level: 3, title: 'Дөрвөлжин', concept: 'loop',
    goal: 'Дөрвөлжин зур.',
    hint: '4 удаа давт: урагш 100, баруун тийш 90°.',
    blocks: [...PEN, 'repeat'], stars: { three: 3, two: 5 },
    start: { x: 50, y: 150, heading: 0 },
    target: 'for (let i = 0; i < 4; i++) { forward(100); turnRight(90); }',
  },
  {
    game: 'turtle', level: 4, title: 'Тасархай зураас', concept: 'loop',
    goal: 'Тасархай зураас зур.',
    hint: '5 удаа давт: урагш 10, үзгээ өргө, урагш 10, үзгээ буулга.',
    blocks: [...PEN, 'turtle_pen', 'repeat'], stars: { three: 5, two: 7 },
    start: { x: 100, y: 150, heading: 0 },
    target: 'for (let i = 0; i < 5; i++) { forward(10); penUp(); forward(10); penDown(); }',
  },
  {
    game: 'turtle', level: 5, title: 'Гурвалжин', concept: 'loop',
    goal: 'Гурвалжин зур.',
    hint: '3 удаа давт. Нэг удаа эргэхэд 120° эргэнэ.',
    blocks: [...PEN, 'repeat'], stars: { three: 3, two: 5 },
    start: { x: 50, y: 160, heading: 0 },
    target: 'for (let i = 0; i < 3; i++) { forward(100); turnRight(120); }',
  },
  {
    game: 'turtle', level: 6, title: 'Байшин', concept: 'sequence',
    goal: 'Дээвэртэй байшин зур.',
    hint: 'Хана 60, дээвэр 100. Дээврийн эхэнд 30°, оройд 120° эргэнэ.',
    blocks: [...PEN, 'repeat'], stars: { three: 9, two: 11 },
    start: { x: 50, y: 170, heading: 0 },
    target:
      'forward(60); turnRight(30); forward(100); turnRight(120); forward(100); turnRight(30); forward(60); turnRight(90); forward(100);',
  },
  {
    game: 'turtle', level: 7, title: 'Од', concept: 'loop',
    goal: 'Таван хошуут од зур.',
    hint: '5 удаа: урагш 120, баруун тийш 144°.',
    blocks: [...PEN, 'repeat'], stars: { three: 3, two: 5 },
    start: { x: 40, y: 110, heading: 90 },
    target: 'for (let i = 0; i < 5; i++) { forward(120); turnRight(144); }',
  },
  {
    game: 'turtle', level: 8, title: 'Нар', concept: 'loop',
    goal: 'Дугуй нар зур.',
    hint: 'Олон жижиг алхам + бага зэрэг эргэх = тойрог. 36 удаа: урагш 10, баруун 10°.',
    blocks: [...PEN, 'repeat'], stars: { three: 3, two: 5 },
    start: { x: 43, y: 100, heading: 0 },
    target: 'for (let i = 0; i < 36; i++) { forward(10); turnRight(10); }',
  },
  {
    game: 'turtle', level: 9, title: 'Цэцэг', concept: 'loop',
    goal: 'Дөрвөлжингүүдээр цэцэг зур.',
    hint: '8 удаа: (4 удаа: урагш 60, баруун 90°), тэгээд баруун 45°.',
    blocks: [...PEN, 'repeat', 'functions'], stars: { three: 5, two: 7 },
    start: { x: 100, y: 100, heading: 0 },
    target:
      'for (let j = 0; j < 8; j++) { for (let i = 0; i < 4; i++) { forward(60); turnRight(90); } turnRight(45); }',
  },
  {
    game: 'turtle', level: 10, title: 'Ороомог', concept: 'variable',
    goal: 'Зураас бүр өмнөхөөсөө 10-аар урт.',
    hint: 'n = 10. 14 удаа: урагш n, баруун 90°, n-г 10-аар нэм.',
    blocks: [...PEN, 'repeat', 'variables'], stars: { three: 6, two: 8 },
    start: { x: 100, y: 100, heading: 0 },
    target: 'let n = 10; for (let i = 0; i < 14; i++) { forward(n); turnRight(90); n += 10; }',
  },
];

export const LEVELS: Record<GameId, Level[]> = {
  maze: MAZE_LEVELS,
  bird: BIRD_LEVELS,
  turtle: TURTLE_LEVELS,
};

export const GAME_IDS: GameId[] = ['maze', 'bird', 'turtle'];

export function isGameId(value: unknown): value is GameId {
  return value === 'maze' || value === 'bird' || value === 'turtle';
}

export function findLevel(game: GameId, level: number): Level | null {
  return LEVELS[game].find((l) => l.level === level) ?? null;
}
