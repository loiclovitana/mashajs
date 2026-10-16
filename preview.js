import { animations, spriteSheets, loadSprite, drawFrame, frameAt, FRAME_COUNT, FRAME_SIZE } from './sprites.js';

const $ = selector => document.querySelector(selector);
const gallery = $('#gallery');
const catSelect = $('#cat');
const animationSelect = $('#animation');
const play = $('#play');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let playing = !reduced.matches;
let previews = [];
let generation = 0;
let raf = 0;
let elapsed = 0;
let previousTime = null;
let image;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function paint(preview, frame) {
  drawFrame(preview.canvas.getContext('2d'), image, preview.animation.id, frame);
  preview.frame = frame;
  preview.caption.textContent = `Playing · ${frame + 1} / 4`;
}

function tick(time) {
  if (previousTime !== null) elapsed += time - previousTime;
  previousTime = time;
  for (const preview of previews) {
    const frame = frameAt(preview.animation.id, elapsed + (preview.offset || 0));
    if (frame !== preview.frame) paint(preview, frame);
  }
  raf = requestAnimationFrame(tick);
}

function syncPlayback() {
  cancelAnimationFrame(raf);
  previousTime = null;
  play.textContent = playing ? 'Pause animation' : 'Play animation';
  play.setAttribute('aria-pressed', String(!playing));
  for (const preview of previews) preview.caption.textContent = `${playing ? 'Playing' : 'Paused'} · ${preview.frame + 1} / 4`;
  if (playing && !document.hidden && previews.length) raf = requestAnimationFrame(tick);
}

function saveControls() {
  const query = new URLSearchParams({ cat: catSelect.value, animation: animationSelect.value, background: $('#background').value });
  history.replaceState(null, '', `?${query}`);
  gallery.dataset.background = $('#background').value;
}

async function render() {
  const current = ++generation;
  previews = [];
  elapsed = 0;
  syncPlayback();
  saveControls();
  gallery.replaceChildren();
  const catID = catSelect.value;
  const cat = spriteSheets[catID];
  $('#status').textContent = `Loading ${cat.name}…`;
  $('#sheet').href = cat.url;
  try {
    const loaded = await loadSprite(catID);
    if (current !== generation) return;
    image = loaded;
    const selected = animations.filter(animation => animationSelect.value === 'all' || animation.id === animationSelect.value);
    for (const animation of selected) {
      const card = element('article');
      card.dataset.animation = animation.id;
      const heading = element('div', '', 'card-heading');
      heading.append(element('h3', animation.label), element('span', `${String(animation.row + 1).padStart(2, '0')} / 07`));
      card.append(heading);
      const strip = element('div', '', 'frames');
      for (let index = -1; index < FRAME_COUNT; index++) {
        const figure = element('figure', '', index === -1 ? 'animated' : 'still');
        const board = element('div', '', 'artboard');
        const canvas = element('canvas');
        canvas.width = canvas.height = FRAME_SIZE;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${cat.name}, ${animation.label}, ${index < 0 ? 'animation' : `frame ${index + 1}`}`);
        drawFrame(canvas.getContext('2d'), image, animation.id, Math.max(0, index));
        board.append(canvas);
        const caption = element('figcaption', index < 0 ? 'Playing · 1 / 4' : `Frame ${index + 1}`);
        figure.append(board, caption);
        if (index < 0) {
          previews.push({ canvas, caption, animation, frame: 0 });
        }
        strip.append(figure);
      }
      card.append(strip, element('p', `${animation.duration} ms per frame · ${(animation.duration * 4 / 1000).toFixed(2)} s loop`, 'meta'));
      gallery.append(card);
    }
    $('#status').textContent = `${cat.name} · ${selected.length} animations · ${selected.length * FRAME_COUNT} complete frames`;
    syncPlayback();
  } catch (error) {
    if (current === generation) $('#status').textContent = `Unable to load the sprite sheet: ${error.message}`;
  }
}

for (const [id, cat] of Object.entries(spriteSheets)) catSelect.add(new Option(cat.name, id));
for (const animation of animations) animationSelect.add(new Option(animation.label, animation.id));
const saved = new URLSearchParams(location.search);
if (Object.hasOwn(spriteSheets, saved.get('cat'))) catSelect.value = saved.get('cat');
if (animations.some(animation => animation.id === saved.get('animation'))) animationSelect.value = saved.get('animation');
if (['checker', 'light', 'dark'].includes(saved.get('background'))) $('#background').value = saved.get('background');

play.addEventListener('click', () => { playing = !playing; syncPlayback(); });
$('#step').addEventListener('click', () => {
  playing = false;
  for (const preview of previews) paint(preview, (preview.frame + 1) % FRAME_COUNT);
  // Resume smoothly from the selected frame, even when rows have different timings.
  for (const preview of previews) preview.offset = preview.frame * preview.animation.duration - elapsed;
  syncPlayback();
});
catSelect.addEventListener('change', render);
animationSelect.addEventListener('change', render);
$('#background').addEventListener('change', saveControls);
$('.controls').addEventListener('submit', event => event.preventDefault());
document.addEventListener('visibilitychange', syncPlayback);
reduced.addEventListener('change', () => { playing = !reduced.matches; syncPlayback(); });
await render();
