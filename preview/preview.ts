import {
  animations,
  spriteSheets,
  loadSprite,
  drawFrame,
  frameAt,
  FRAME_COUNT,
  FRAME_SIZE,
  isBuiltinSprite,
} from '../lib/sprites.js';

import type { Animation } from '../lib/sprites.js';
import { requireElement, context2D } from './dom.js';

interface FramePreview {
  context: CanvasRenderingContext2D;
  caption: HTMLElement;
  animation: Animation;
  frame: number;
}

const gallery = requireElement('#gallery', HTMLDivElement);
const catSelect = requireElement('#cat', HTMLSelectElement);
const background = requireElement('#background', HTMLSelectElement);
const status = requireElement('#status', HTMLParagraphElement);
const sheet = requireElement('#sheet', HTMLAnchorElement);
const controls = requireElement('.controls', HTMLFormElement);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let playing = !reduced.matches;
let previews: FramePreview[] = [];
let generation = 0;
let raf = 0;
let elapsed = 0;
let previousTime: number | null = null;
let image: HTMLImageElement | null = null;

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = '',
  className = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function paint(preview: FramePreview, frame: number) {
  if (!image) return;
  drawFrame(preview.context, image, preview.animation.id, frame);
  preview.frame = frame;
  preview.caption.textContent = `Playing · ${frame + 1} / 4`;
}

function tick(time: number) {
  if (previousTime !== null) elapsed += time - previousTime;
  previousTime = time;
  for (const preview of previews) {
    const frame = frameAt(preview.animation.id, elapsed);
    if (frame !== preview.frame) paint(preview, frame);
  }
  raf = requestAnimationFrame(tick);
}

function syncPlayback() {
  cancelAnimationFrame(raf);
  previousTime = null;
  for (const preview of previews)
    preview.caption.textContent = `${playing ? 'Playing' : 'Paused'} · ${preview.frame + 1} / 4`;
  if (playing && !document.hidden && previews.length) raf = requestAnimationFrame(tick);
}

function saveControls() {
  const query = new URLSearchParams({ cat: catSelect.value, background: background.value });
  history.replaceState(null, '', `?${query}`);
  gallery.dataset.background = background.value;
}

async function render() {
  const current = ++generation;
  previews = [];
  elapsed = 0;
  syncPlayback();
  saveControls();
  gallery.replaceChildren();
  const catID = catSelect.value;
  if (!isBuiltinSprite(catID)) return;
  const cat = spriteSheets[catID];
  status.textContent = `Loading ${cat.name}…`;
  sheet.href = cat.url;
  try {
    const loaded = await loadSprite(catID);
    if (current !== generation) return;
    image = loaded;
    for (const animation of animations) {
      const card = element('article');
      card.dataset.animation = animation.id;
      const heading = element('div', '', 'card-heading');
      heading.append(
        element('h3', animation.label),
        element('span', `${String(animation.row + 1).padStart(2, '0')} / 07`),
      );
      card.append(heading);
      const strip = element('div', '', 'frames');
      for (let index = -1; index < FRAME_COUNT; index++) {
        const figure = element('figure', '', index === -1 ? 'animated' : 'still');
        const board = element('div', '', 'artboard');
        const canvas = element('canvas');
        canvas.width = canvas.height = FRAME_SIZE;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute(
          'aria-label',
          `${cat.name}, ${animation.label}, ${index < 0 ? 'animation' : `frame ${index + 1}`}`,
        );
        const context = context2D(canvas);
        drawFrame(context, image, animation.id, Math.max(0, index));
        board.append(canvas);
        const caption = element('figcaption', index < 0 ? 'Playing · 1 / 4' : `Frame ${index + 1}`);
        figure.append(board, caption);
        if (index < 0) {
          previews.push({ context, caption, animation, frame: 0 });
        }
        strip.append(figure);
      }
      card.append(
        strip,
        element(
          'p',
          `${animation.duration} ms per frame · ${((animation.duration * 4) / 1000).toFixed(2)} s loop`,
          'meta',
        ),
      );
      gallery.append(card);
    }
    status.textContent = `${cat.name} · ${animations.length} animations · ${animations.length * FRAME_COUNT} complete frames`;
    syncPlayback();
  } catch (error) {
    if (current === generation)
      status.textContent = `Unable to load the sprite sheet: ${error instanceof Error ? error.message : String(error)}`;
  }
}

for (const [id, cat] of Object.entries(spriteSheets)) catSelect.add(new Option(cat.name, id));
const saved = new URLSearchParams(location.search);
const savedCat = saved.get('cat');
const savedBackground = saved.get('background');
if (savedCat && isBuiltinSprite(savedCat)) catSelect.value = savedCat;
if (savedBackground && ['checker', 'light', 'dark'].includes(savedBackground))
  background.value = savedBackground;

catSelect.addEventListener('change', () => {
  void render();
});
background.addEventListener('change', saveControls);
controls.addEventListener('submit', (event) => event.preventDefault());
document.addEventListener('visibilitychange', syncPlayback);
reduced.addEventListener('change', () => {
  playing = !reduced.matches;
  syncPlayback();
});
await render();
