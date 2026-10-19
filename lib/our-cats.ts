import type { CatConfig } from './types.js';

// Behaviour and sprite-sheet selection.
export const ourCats = [
  {
    personality: 'chaser',
    sprite: 'opale',
  },
  {
    personality: 'wanderer',
    sprite: 'masha',
  },
] as const satisfies readonly CatConfig[];
