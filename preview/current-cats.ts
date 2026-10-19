import { createCats } from '../lib/cats.js';
import { ourCats } from '../lib/our-cats.js';
import type { CatsController, Personality } from '../lib/cats.js';
import type { BuiltinSprite } from '../lib/sprites.js';
import { requireElement, context2D } from './dom.js';
import { spriteSheets, isBuiltinSprite, loadSprite, drawFrame } from '../lib/sprites.js';

const list = requireElement('#current-cats', HTMLElement);
const studioCat = requireElement('#cat', HTMLSelectElement);
const enabled = requireElement('#preview-enabled', HTMLInputElement);
const status = requireElement('#live-status', HTMLParagraphElement);
const choice = requireElement('#new-cat', HTMLSelectElement);
const previewState = requireElement('#preview-state', HTMLSpanElement);
const embedCode = requireElement('#embed-code', HTMLElement);
const addCatForm = requireElement('#add-cat', HTMLFormElement);
const copyCode = requireElement('#copy-code', HTMLButtonElement);
const copyStatus = requireElement('#copy-status', HTMLSpanElement);
const settingsForm = requireElement('#cat-settings', HTMLFormElement);
const size = requireElement('#cat-size', HTMLInputElement);
const minWidth = requireElement('#min-width', HTMLInputElement);
const zIndex = requireElement('#z-index', HTMLInputElement);
const settings = {
  size: size.valueAsNumber,
  minWidth: minWidth.valueAsNumber,
  zIndex: zIndex.valueAsNumber,
};
const cats: { sprite: BuiltinSprite; personality: Personality; speed?: number }[] = ourCats.map(
  (cat) => ({ ...cat }),
);
let companions: CatsController | null = null;
let screenSize = matchMedia(`(min-width: ${settings.minWidth}px)`);

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
            : !screenSize.matches
              ? `Roaming cats need a screen at least ${settings.minWidth}px wide. Explore their animations in the frame studio.`
              : 'Roaming cats are paused. Turn off reduced motion in your device settings to see them explore.';
}

function updatePreview() {
  companions?.destroy();
  companions = null;
  if (enabled.checked && cats.length) {
    // Failures are reported in the page status below.
    const instance = createCats({ cats, ...settings, onError: () => {} });
    companions = instance;
    const loaded = () => {
      if (companions === instance) describe();
    };
    void instance.ready.then(loaded, loaded);
  }
  describe();
}

function updateEmbed() {
  copyStatus.textContent = '';
  const configuration = cats
    .map(
      (cat) =>
        `      { sprite: ${JSON.stringify(cat.sprite)}, personality: ${JSON.stringify(cat.personality)}${cat.speed === undefined ? '' : `, speed: ${cat.speed}`} }`,
    )
    .join(',\n');
  embedCode.textContent = `<script type="module">
  import { createCats } from 'https://loiclovitana.github.io/mashajs/lib/cats.js';

  createCats({
    size: ${settings.size},
    minWidth: ${settings.minWidth},
    zIndex: ${settings.zIndex},
    cats: [${configuration ? `\n${configuration}\n    ` : ''}],
  });
</script>`;
}

function selectStudioCat(sprite: BuiltinSprite) {
  studioCat.value = sprite;
  studioCat.dispatchEvent(new Event('change'));
}

function renderCats(focusIndex: number | null = null) {
  list.replaceChildren();
  if (!cats.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No cats added.';
    list.append(empty);
  }
  cats.forEach((cat, index) => {
    const catName = spriteSheets[cat.sprite].name.trim();
    const row = document.createElement('aside');
    row.className = 'cat-row';
    const name = document.createElement('h3');
    name.id = `current-cat-${index}`;
    row.setAttribute('aria-labelledby', name.id);
    const preview = document.createElement('a');
    preview.href = '#studio-heading';
    preview.addEventListener('click', () => {
      selectStudioCat(cat.sprite);
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    canvas.setAttribute('aria-hidden', 'true');
    const context = context2D(canvas);
    void loadSprite(cat.sprite).then(
      (image) => drawFrame(context, image, 'idle', 0),
      () => {}, // The live preview reports sprite loading errors.
    );
    preview.append(canvas, catName);
    name.append(preview);
    const label = document.createElement('label');
    label.textContent = 'Behavior';
    const behavior = document.createElement('select');
    behavior.setAttribute('aria-label', `${catName} behavior`);
    behavior.add(new Option('Chaser', 'chaser'));
    behavior.add(new Option('Wanderer', 'wanderer'));
    behavior.value = cat.personality;
    behavior.addEventListener('change', () => {
      cat.personality = behavior.value === 'chaser' ? 'chaser' : 'wanderer';
      speed.placeholder = cat.personality === 'chaser' ? '150' : '55';
      updateEmbed();
      updatePreview();
    });
    label.append(behavior);
    const speedLabel = document.createElement('label');
    speedLabel.textContent = 'Speed (px/s)';
    const speed = document.createElement('input');
    speed.type = 'number';
    speed.min = '0';
    speed.step = 'any';
    speed.setAttribute('aria-label', `${catName} speed (px/s)`);
    speed.placeholder = cat.personality === 'chaser' ? '150' : '55';
    speed.title = 'Leave empty to use the default speed for this behavior.';
    speed.value = cat.speed === undefined ? '' : String(cat.speed);
    speed.addEventListener('change', () => {
      speed.setCustomValidity(
        speed.value !== '' && speed.valueAsNumber <= 0 ? 'Enter a speed greater than zero.' : '',
      );
      if (!speed.reportValidity()) return;
      if (speed.value === '') delete cat.speed;
      else cat.speed = speed.valueAsNumber;
      updateEmbed();
      updatePreview();
    });
    speedLabel.append(speed);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${catName}`);
    remove.addEventListener('click', () => {
      cats.splice(index, 1);
      renderCats(Math.min(index, cats.length - 1));
      updateEmbed();
      updatePreview();
    });
    row.append(name, label, remove, speedLabel);
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
  cats.push({ sprite, personality: 'wanderer' });
  renderCats(cats.length - 1);
  updateEmbed();
  updatePreview();
  selectStudioCat(sprite);
});
enabled.addEventListener('change', updatePreview);
settingsForm.addEventListener('submit', (event) => event.preventDefault());
settingsForm.addEventListener('change', () => {
  if (!settingsForm.reportValidity()) return;
  settings.size = size.valueAsNumber;
  settings.minWidth = minWidth.valueAsNumber;
  settings.zIndex = zIndex.valueAsNumber;
  screenSize.removeEventListener('change', scheduleDescription);
  screenSize = matchMedia(`(min-width: ${settings.minWidth}px)`);
  screenSize.addEventListener('change', scheduleDescription);
  updateEmbed();
  updatePreview();
});
copyCode.addEventListener('click', () => {
  void (async () => {
    try {
      await navigator.clipboard.writeText(embedCode.textContent);
      copyStatus.textContent = 'Copied!';
    } catch {
      const selection = window.getSelection();
      selection?.selectAllChildren(embedCode);
      copyStatus.textContent = 'Select and copy the code below.';
    }
  })();
});
// Read state after the library has handled the same preference/visibility event.
const scheduleDescription = () => setTimeout(describe, 0);
screenSize.addEventListener('change', scheduleDescription);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', scheduleDescription);
document.addEventListener('visibilitychange', scheduleDescription);

renderCats();
updateEmbed();
updatePreview();
