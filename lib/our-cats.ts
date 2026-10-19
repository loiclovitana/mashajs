import type { CatConfig } from './types.js';

// Behaviour and sprite-sheet selection.
export const ourCats = [
  {
    name: 'Opale',
    personality: 'chaser',
    sprite: 'opale',
  },
  {
    name: 'Neva Masquerade',
    personality: 'wanderer',
    sprite: 'masha',
  },
] as const satisfies readonly CatConfig[];
