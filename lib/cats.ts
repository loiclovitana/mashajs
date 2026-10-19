import { loadSprite, frameAt, drawFrame } from './sprites.js';
import { ourCats } from './our-cats.js';
import type { AnimationId } from './sprites.js';
import type { CatConfig, CatsController, CatsOptions, Personality } from './types.js';

export type {
  CatConfig,
  CatsOptions,
  CatsController,
  CatState,
  CatsState,
  Personality,
} from './types.js';
export type { AnimationId } from './sprites.js';

interface Point {
  x: number;
  y: number;
}

interface Pet extends Point {
  name: string;
  personality: Personality;
  speed: number;
  sprite: string | URL;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement | null;
  target: Point | null;
  animation: AnimationId;
  since: number;
  idleSince: number;
  nextDecision: number;
  painted: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const random = (min: number, max: number) => min + Math.random() * (max - min);

/** Mount cats on any page. No framework, stylesheets, or global styles required. */
export function createCats({
  parent = document.body,
  cats = ourCats,
  size = 80,
  minWidth = 1024,
  zIndex = 900,
  onError = (error) => console.error('[MashaJS]', error),
}: CatsOptions = {}): CatsController {
  if (
    !parent?.append ||
    !Number.isFinite(size) ||
    size < 16 ||
    !Number.isFinite(minWidth) ||
    minWidth < 0 ||
    !Number.isFinite(zIndex) ||
    !Array.isArray(cats)
  ) {
    throw new TypeError(
      'Provide a parent element, cats array, size ≥ 16, minWidth ≥ 0, and a finite zIndex.',
    );
  }
  const overlay = document.createElement('div');
  overlay.dataset.desktopCats = '';
  overlay.setAttribute('aria-hidden', 'true');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    overflow: 'hidden',
    zIndex: String(zIndex),
    display: 'none',
    contain: 'strict',
  });
  const desktop = matchMedia(`(min-width: ${minWidth}px) and (hover: hover) and (pointer: fine)`);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  let width = innerWidth,
    height = innerHeight;
  let paused = false,
    destroyed = false,
    active = false,
    loaded = false;
  let error: string | null = null;
  let raf = 0,
    elapsed = 0,
    pointerAt = 0;
  let lastTime: number | null = null;
  let pointer: Point | null = null;

  const pets = cats.map((config: CatConfig, index): Pet => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D rendering is unavailable.');
    Object.assign(canvas.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: `${size}px`,
      height: `${size}px`,
    });
    overlay.append(canvas);
    return {
      name: `Cat ${index + 1}`,
      personality: config.personality === 'wanderer' ? 'wanderer' : 'chaser',
      speed:
        typeof config.speed === 'number' && Number.isFinite(config.speed) && config.speed > 0
          ? config.speed
          : config.personality === 'wanderer'
            ? 55
            : 150,
      sprite: config.sprite || 'opale',
      canvas,
      ctx,
      image: null,
      x: 80 + index * 110,
      y: height - size,
      target: null,
      animation: 'idle',
      since: 0,
      idleSince: 0,
      nextDecision: random(1500, 3500),
      painted: '',
    };
  });
  parent.append(overlay);

  function bound<T extends Point>(point: T): T {
    const margin = size / 2 + 8;
    point.x = clamp(point.x, Math.min(margin, width / 2), Math.max(width / 2, width - margin));
    point.y = clamp(point.y, Math.min(margin, height / 2), Math.max(height / 2, height - margin));
    return point;
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    const pixels = Math.round(size * Math.min(devicePixelRatio || 1, 2));
    for (const pet of pets) {
      pet.canvas.width = pet.canvas.height = pixels;
      pet.ctx.imageSmoothingEnabled = true;
      pet.ctx.imageSmoothingQuality = 'high';
      pet.painted = '';
      bound(pet);
      if (pet.target) bound(pet.target);
    }
  }

  function animate(pet: Pet, animation: AnimationId) {
    if (pet.animation === animation) return;
    pet.animation = animation;
    pet.since = elapsed;
  }

  function update(pet: Pet, dt: number) {
    const interested = pointer && elapsed - pointerAt < 14000;
    const chasing = pet.personality === 'chaser' && interested;
    if (chasing && pointer) {
      pet.target = bound({ x: pointer.x - size * 0.8, y: pointer.y + size * 0.6 });
    } else if (elapsed >= pet.nextDecision) {
      pet.nextDecision = elapsed + random(3500, 7500);
      const choice = Math.random();
      pet.target =
        choice < 0.6 ? bound({ x: pet.x + random(-180, 180), y: pet.y + random(-110, 110) }) : null;
      if (!pet.target) animate(pet, choice > 0.85 ? 'sleep' : 'groom');
    }

    const dx = pet.target ? pet.target.x - pet.x : 0;
    const dy = pet.target ? pet.target.y - pet.y : 0;
    const distance = Math.hypot(dx, dy);
    if (distance > 5) {
      const direction =
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : dy > 0 ? 'south' : 'north';
      animate(pet, `walk-${direction}`);
      const speed = pet.speed * (chasing ? clamp(distance / 140, 0.3, 1.5) : 1);
      const step = Math.min(distance, speed * dt);
      pet.x += (dx / distance) * step;
      pet.y += (dy / distance) * step;
      pet.idleSince = elapsed;
    } else {
      pet.target = null;
      if (pet.animation.startsWith('walk-')) animate(pet, 'idle');
      if (chasing) {
        const resting = elapsed - pet.idleSince;
        animate(pet, resting > 10000 ? 'sleep' : resting > 4500 ? 'groom' : 'idle');
        pet.nextDecision = elapsed + 3500;
      }
    }
    bound(pet);
  }

  function tick(time: number) {
    if (!active) return;
    raf = requestAnimationFrame(tick);
    if (lastTime !== null && time - lastTime < 1000 / 30) return;
    const dt = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;
    elapsed += dt * 1000;
    for (const pet of pets) {
      update(pet, dt);
      pet.canvas.style.transform = `translate(${Math.round(pet.x - size / 2)}px, ${Math.round(pet.y - size / 2)}px)`;
      const frame = frameAt(pet.animation, elapsed - pet.since);
      const key = `${pet.animation}/${frame}`;
      if (key !== pet.painted && pet.image) {
        drawFrame(pet.ctx, pet.image, pet.animation, frame);
        pet.painted = key;
      }
    }
  }

  function sync() {
    const shouldRun =
      loaded && !destroyed && !paused && desktop.matches && !reduced.matches && !document.hidden;
    if (active === shouldRun) return;
    active = shouldRun;
    overlay.style.display = active ? 'block' : 'none';
    cancelAnimationFrame(raf);
    lastTime = null;
    pointer = null;
    if (active) {
      resize();
      raf = requestAnimationFrame(tick);
    }
  }

  const options = { signal: listeners.signal };
  window.addEventListener(
    'pointermove',
    (event) => {
      if (!active || event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY };
      pointerAt = elapsed;
    },
    { ...options, passive: true },
  );
  document.documentElement.addEventListener(
    'pointerleave',
    () => {
      pointer = null;
    },
    options,
  );
  window.addEventListener(
    'blur',
    () => {
      pointer = null;
    },
    options,
  );
  window.addEventListener(
    'resize',
    () => {
      if (active) resize();
    },
    options,
  );
  document.addEventListener('visibilitychange', sync, options);
  desktop.addEventListener('change', sync, options);
  reduced.addEventListener('change', sync, options);

  const ready = Promise.all(
    pets.map(async (pet) => {
      pet.image = await loadSprite(pet.sprite);
    }),
  ).then(() => {
    loaded = true;
    sync();
  });
  // Keep ready rejectable for consumers while also reporting failures automatically.
  void ready
    .catch((cause: unknown) => {
      const failure = cause instanceof Error ? cause : new Error(String(cause));
      error = failure.message;
      if (!destroyed) onError(failure);
    })
    .catch((cause: unknown) => console.error('[MashaJS] onError callback failed', cause));

  return {
    ready,
    pause() {
      paused = true;
      sync();
    },
    resume() {
      paused = false;
      sync();
    },
    destroy() {
      destroyed = true;
      sync();
      listeners.abort();
      overlay.remove();
    },
    getState() {
      return {
        active,
        loaded,
        error,
        cats: pets.map(({ name, personality, x, y, animation, since }) => ({
          name,
          personality,
          x,
          y,
          animation,
          frame: frameAt(animation, elapsed - since),
        })),
      };
    },
  };
}
