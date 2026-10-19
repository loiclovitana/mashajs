import { createCats } from '../lib/cats.js';
import { ourCats } from '../lib/our-cats.js';
import type { CatsController, Personality } from '../lib/cats.js';
import type { BuiltinSprite } from '../lib/sprites.js';
import { requireElement } from './dom.js';
import { spriteSheets, isBuiltinSprite } from '../lib/sprites.js';

const list = requireElement('#current-cats', HTMLDivElement);
const enabled = requireElement('#preview-enabled', HTMLInputElement);
const status = requireElement('#live-status', HTMLParagraphElement);
const choice = requireElement('#new-cat', HTMLSelectElement);
const previewState = requireElement('#preview-state', HTMLSpanElement);
const embedCode = requireElement('#embed-code', HTMLElement);
const addCatForm = requireElement('#add-cat', HTMLFormElement);
const cats: { name: string; sprite: BuiltinSprite; personality: Personality }[] = ourCats.map(
  (cat) => ({ ...cat, name: spriteSheets[cat.sprite].name.trim() }),
);
let companions: CatsController | null = null;

function describe() {
  previewState.textContent = enabled.checked ? 'On' : 'Off';
  const state = companions?.getState();
  status.textContent = !enabled.checked
    ? 'Preview is off.'
    : !cats.length
      ? 'Add a cat to preview it here.'
      : state?.error
        ? `Unable to load the cats: ${state.error}`
        : !state?.loaded
          ? 'Loading the cats…'
          : state.active
            ? 'Chasers follow your cursor. Wanderers explore on their own.'
            : 'Roaming cats need a mouse or trackpad, a window at least 1024px wide, and reduced motion turned off.';
}

function updatePreview() {
  companions?.destroy();
  companions = null;
  if (enabled.checked && cats.length) {
    // Failures are reported in the page status below.
    const instance = createCats({ cats,size: 120, onError: () => {} });
    companions = instance;
    const loaded = () => {
      if (companions === instance) describe();
    };
    void instance.ready.then(loaded, loaded);
  }
  describe();
}

function updateEmbed() {
  const configuration = cats
    .map(
      (cat) =>
        `    { name: ${JSON.stringify(cat.name)}, sprite: ${JSON.stringify(cat.sprite)}, personality: ${JSON.stringify(cat.personality)} }`,
    )
    .join(',\n');
  embedCode.textContent = `<script type="module">
  import { createCats } from 'https://loiclovitana.github.io/mashajs/lib/cats.js';

  createCats({ cats: [${configuration ? `\n${configuration}\n  ` : ''}] });
</script>`;
}

function renderCats(focusIndex: number | null = null) {
  list.replaceChildren();
  if (!cats.length) {
    const empty = document.createElement('p');
    empty.className = 'note';
    empty.textContent = 'No cats added.';
    list.append(empty);
  }
  cats.forEach((cat, index) => {
    const row = document.createElement('div');
    row.className = 'cat-row';
    const name = document.createElement('strong');
    name.textContent = cat.name;
    const label = document.createElement('label');
    label.textContent = 'Behavior';
    const behavior = document.createElement('select');
    behavior.setAttribute('aria-label', `${cat.name} behavior`);
    behavior.add(new Option('Chaser', 'chaser'));
    behavior.add(new Option('Wanderer', 'wanderer'));
    behavior.value = cat.personality;
    behavior.addEventListener('change', () => {
      cat.personality = behavior.value === 'chaser' ? 'chaser' : 'wanderer';
      updateEmbed();
      updatePreview();
    });
    label.append(behavior);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${cat.name}`);
    remove.addEventListener('click', () => {
      cats.splice(index, 1);
      renderCats(Math.min(index, cats.length - 1));
      updateEmbed();
      updatePreview();
    });
    row.append(name, label, remove);
    list.append(row);
  });
  if (focusIndex !== null) {
    (list.children[focusIndex]?.querySelector('select') ?? choice).focus();
  }
}

for (const [id, cat] of Object.entries(spriteSheets)) choice.add(new Option(cat.name.trim(), id));
addCatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const sprite = choice.value;
  if (!isBuiltinSprite(sprite)) return;
  cats.push({ name: spriteSheets[sprite].name, sprite, personality: 'wanderer' });
  renderCats(cats.length - 1);
  updateEmbed();
  updatePreview();
});
enabled.addEventListener('change', updatePreview);
// Read state after the library has handled the same preference/visibility event.
const scheduleDescription = () => setTimeout(describe, 0);
matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)').addEventListener(
  'change',
  scheduleDescription,
);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', scheduleDescription);
document.addEventListener('visibilitychange', scheduleDescription);

renderCats();
updateEmbed();
updatePreview();
