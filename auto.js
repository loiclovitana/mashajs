import { createCats } from './cats.js';
import { ourCats } from './our-cats.js';

// Module scripts normally run after parsing; also support a dynamic import in <head>.
if (!document.body) {
  await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
}

export const companions = createCats({ cats: ourCats });
