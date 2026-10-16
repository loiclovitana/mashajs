import { loadCatalog, componentURL, loadFrame } from './artwork.js';

const $ = selector => document.querySelector(selector);
const catSelect = $('#cat');
const stateSelect = $('#state');
const viewSelect = $('#view');
const gallery = $('#gallery');
const status = $('#status');
const play = $('#play');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let playing = !reduced.matches;
let previews = [];
let generation = 0;
let raf = 0;
let clock = 0;
let previousTime = 0;
let catalog;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function sourceLink(cat, id) {
  const link = element('a', `${id}.svg`, 'source');
  link.href = componentURL(cat.components[id]);
  link.target = '_blank';
  link.rel = 'noopener';
  return link;
}
function paint(canvas, image) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
}
function tick(time) {
  if (previousTime) clock += time - previousTime;
  previousTime = time;
  for (const preview of previews) {
    const frame = Math.floor(clock / preview.duration) % preview.images.length;
    if (frame !== preview.frame) {
      paint(preview.canvas, preview.images[frame]);
      preview.frame = frame;
    }
  }
  raf = requestAnimationFrame(tick);
}
function syncPlayback() {
  cancelAnimationFrame(raf);
  previousTime = 0;
  play.textContent = playing ? 'Pause animation' : 'Play animation';
  play.setAttribute('aria-pressed', String(!playing));
  if (playing && !document.hidden && previews.length) raf = requestAnimationFrame(tick);
}

async function render() {
  const current = ++generation;
  previews = [];
  clock = 0;
  syncPlayback();
  gallery.replaceChildren();
  const catID = catSelect.value;
  const cat = catalog.cats[catID];
  const parts = viewSelect.value === 'parts';
  const query = new URLSearchParams({ cat: catID, view: viewSelect.value, state: stateSelect.value, background: $('#background').value });
  history.replaceState(null, '', `?${query}`);
  gallery.className = parts ? 'parts' : 'poses';
  $('#state-control').hidden = parts;
  play.hidden = parts;
  $('#hint').textContent = parts
    ? 'Edit the linked SVG file in a vector or text editor, preserving its artboard and coordinates. Shared parts update every pose that uses them.'
    : 'Each row shows an animated pose and all its still frames. Expand “Parts used” to find the SVG files that make up that pose. Direction names describe screen coordinates.';
  status.textContent = 'Loading artwork…';
  let failed = 0;
  let count = 0;
  const tasks = [];

  if (parts) {
    for (const id of Object.keys(cat.components).sort()) {
      count++;
      const card = element('article');
      card.append(element('h2', id.replaceAll('-', ' ')));
      const board = element('div', '', 'artboard');
      const image = new Image();
      image.alt = `${cat.name}: ${id}`;
      // A refresh must show saved changes even with an aggressively caching server.
      const url = new URL(componentURL(cat.components[id]));
      url.searchParams.set('preview', Date.now());
      image.src = url.href;
      board.append(image);
      card.append(board, sourceLink(cat, id), element('code', `artwork/${cat.components[id].file}`));
      const uses = Object.values(cat.states).flatMap(state => Object.values(state.directions).flat())
        .filter(frame => frame.layers.some(layer => layer.component === id)).length;
      card.append(element('p', `Used in ${uses} frames`, 'meta'));
      gallery.append(card);
      tasks.push(image.decode().catch(() => {
        failed++;
        card.append(element('p', `Cannot load ${cat.components[id].file}`, 'error'));
      }));
    }
  } else {
    for (const [state, animation] of Object.entries(cat.states)) {
      if (stateSelect.value !== 'all' && stateSelect.value !== state) continue;
      for (const [direction, frames] of Object.entries(animation.directions)) {
        count++;
        const card = element('article');
        card.append(element('h2', `${state[0].toUpperCase() + state.slice(1)} · ${catalog.directions[direction]}`));
        const strip = element('div', '', 'frames');
        const canvases = Array.from({ length: frames.length + 1 }, (_, index) => {
          const figure = element('figure');
          const board = element('div', '', 'artboard');
          const canvas = element('canvas');
          canvas.width = canvas.height = 192;
          canvas.setAttribute('role', 'img');
          canvas.setAttribute('aria-label', `${cat.name}, ${state}, ${direction}, ${index ? `frame ${index}` : 'animated preview'}`);
          board.append(canvas);
          figure.append(board, element('figcaption', index ? `Frame ${index}` : `${animation.duration} ms/frame`));
          strip.append(figure);
          return canvas;
        });
        card.append(strip);
        const details = element('details');
        details.append(element('summary', 'Parts used'));
        const list = element('ul');
        for (const id of new Set(frames.flatMap(frame => frame.layers.map(layer => layer.component)))) {
          const item = element('li');
          item.append(sourceLink(cat, id));
          list.append(item);
        }
        details.append(list);
        card.append(details);
        gallery.append(card);
        tasks.push(Promise.all(frames.map((_, index) => loadFrame(catalog, catID, state, direction, index)))
          .then(images => {
            if (current !== generation) return;
            images.forEach((image, index) => paint(canvases[index + 1], image));
            paint(canvases[0], images[0]);
            previews.push({ canvas: canvases[0], images, duration: animation.duration, frame: 0 });
          }).catch(error => {
            failed++;
            card.append(element('p', error.message, 'error'));
          }));
      }
    }
  }
  await Promise.all(tasks);
  if (current !== generation) return;
  status.textContent = `${cat.name} · ${count} ${parts ? 'editable parts' : 'poses'}${failed ? ` · ${failed} could not be loaded (see cards below)` : ' · All loaded'}`;
  syncPlayback();
}
function populateStates() {
  stateSelect.replaceChildren(new Option('Every animation', 'all'));
  for (const state of Object.keys(catalog.cats[catSelect.value].states)) {
    stateSelect.add(new Option(state[0].toUpperCase() + state.slice(1), state));
  }
}

$('#reload').addEventListener('click', () => location.reload());
$('#background').addEventListener('change', event => {
  gallery.dataset.background = event.target.value;
  const url = new URL(location.href);
  url.searchParams.set('background', event.target.value);
  history.replaceState(null, '', url);
});
play.addEventListener('click', () => { playing = !playing; syncPlayback(); });
catSelect.addEventListener('change', () => { populateStates(); render(); });
stateSelect.addEventListener('change', render);
viewSelect.addEventListener('change', render);
$('.controls').addEventListener('submit', event => event.preventDefault());
document.addEventListener('visibilitychange', syncPlayback);
reduced.addEventListener('change', () => { playing = !reduced.matches; syncPlayback(); });

try {
  catalog = await loadCatalog();
  for (const [id, cat] of Object.entries(catalog.cats)) catSelect.add(new Option(cat.name, id));
  const saved = new URLSearchParams(location.search);
  if (catalog.cats[saved.get('cat')]) catSelect.value = saved.get('cat');
  if (['parts', 'poses'].includes(saved.get('view'))) viewSelect.value = saved.get('view');
  populateStates();
  if (catalog.cats[catSelect.value].states[saved.get('state')]) stateSelect.value = saved.get('state');
  if (['checker', 'light', 'dark'].includes(saved.get('background'))) $('#background').value = saved.get('background');
  gallery.dataset.background = $('#background').value;
  await render();
} catch (error) {
  status.textContent = `Cannot open the artwork gallery: ${error.message}`;
  status.classList.add('error');
}
