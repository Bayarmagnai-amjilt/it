// Answer tiles: a colour and a letter per option, so identity never rests on
// colour alone. Checked with the dataviz palette validator (light surface).
export const OPTION_COLORS = ['#4458f2', '#ff6b9a', '#e0a30b', '#22c493', '#8b5cf6', '#fb6a1f'];
export const OPTION_LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];

export const optionColor = (i: number) => OPTION_COLORS[i % OPTION_COLORS.length];
export const optionLetter = (i: number) => OPTION_LETTERS[i % OPTION_LETTERS.length];
