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

const gallery = requireElement('#gallery', HTMLElement);
const catSelect = requireElement('#cat', HTMLSelectElement);
const background = requireElement('#background', HTMLSelectElement);
const status = requireElement('#status', HTMLParagraphElement);
const sheet = requireElement('#sheet', HTMLAnchorElement);
const controls = requireElement('.controls', HTMLFormElement);
const playback = requireElement('#playback', HTMLButtonElement);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let playing = !reduced.matches;
let previews: FramePreview[] = [];
let stills: Omit<FramePreview, 'caption'>[] = [];
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

function drawPreview(preview: Omit<FramePreview, 'caption'>, frame: number) {
  if (!image) return;
  drawFrame(preview.context, image, preview.animation.id, frame);
  const context = preview.context;
  const size = context.canvas.width;
  context.save();
  context.globalCompositeOperation = 'destination-over';
  if (background.value === 'checker') {
    const tile = size / 12;
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 12; x++) {
        context.fillStyle = (x + y) % 2 ? '#eaece3' : '#f4f5ef';
        context.fillRect(x * tile, y * tile, tile, tile);
      }
    }
  } else {
    context.fillStyle = background.value === 'dark' ? '#2e3633' : '#fffdf8';
    context.fillRect(0, 0, size, size);
  }
  context.restore();
}

function paint(preview: FramePreview, frame: number) {
  drawPreview(preview, frame);
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
  playback.textContent = playing ? 'Pause animations' : 'Play animations';
  for (const preview of previews)
    preview.caption.textContent = `${playing ? 'Playing' : 'Paused'} · ${preview.frame + 1} / 4`;
  if (playing && !document.hidden && previews.length) raf = requestAnimationFrame(tick);
}

function saveControls() {
  const url = new URL(location.href);
  url.searchParams.set('cat', catSelect.value);
  url.searchParams.set('background', background.value);
  history.replaceState(null, '', url);
  gallery.dataset.background = background.value;
}

async function render() {
  const current = ++generation;
  previews = [];
  stills = [];
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
      const card = element('aside');
      card.dataset.animation = animation.id;
      const heading = element('h3', animation.label);
      heading.id = `animation-${animation.id}`;
      card.setAttribute('aria-labelledby', heading.id);
      card.append(heading, element('small', `${String(animation.row + 1).padStart(2, '0')} / 07`));
      const strip = element('section', '', 'frames');
      for (let index = -1; index < FRAME_COUNT; index++) {
        const figure = element('figure', '', index === -1 ? 'animated' : 'still');
        const canvas = element('canvas');
        canvas.width = canvas.height = index < 0 ? FRAME_SIZE : FRAME_SIZE / 3;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute(
          'aria-label',
          `${cat.name}, ${animation.label}, ${index < 0 ? 'animation' : `frame ${index + 1}`}`,
        );
        const context = context2D(canvas);
        const frame = Math.max(0, index);
        drawPreview({ context, animation, frame }, frame);
        const caption = element('small', index < 0 ? 'Playing · 1 / 4' : `Frame ${index + 1}`);
        const figcaption = element('figcaption');
        figcaption.append(caption);
        figure.append(canvas, figcaption);
        if (index < 0) {
          previews.push({ context, caption, animation, frame: 0 });
          card.append(figure);
        } else {
          stills.push({ context, animation, frame });
          strip.append(figure);
        }
      }
      const meta = element('p');
      meta.append(
        element(
          'small',
          `${animation.duration} ms per frame · ${((animation.duration * 4) / 1000).toFixed(2)} s loop`,
        ),
      );
      const details = element('details');
      details.append(element('summary', 'Show all 4 frames'), strip);
      card.append(meta, details);
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
background.addEventListener('change', () => {
  saveControls();
  for (const preview of [...previews, ...stills]) drawPreview(preview, preview.frame);
});
controls.addEventListener('submit', (event) => event.preventDefault());
playback.addEventListener('click', () => {
  playing = !playing;
  syncPlayback();
});
document.addEventListener('visibilitychange', syncPlayback);
reduced.addEventListener('change', () => {
  playing = !reduced.matches;
  syncPlayback();
});
await render();
