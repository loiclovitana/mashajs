import { createCatRenderer } from './sprites.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const random = (min, max) => min + Math.random() * (max - min);

/** Mount independent desktop cats. Returns pause(), resume(), destroy(), getState(). */
export function createCats({
  parent = document.body,
  minWidth = 1024,
  size = 80,
  zIndex = 900,
  cats = [{ name: 'Curious', personality: 'chaser' }, { name: 'Dreamer', personality: 'wanderer' }],
  renderer = createCatRenderer,
} = {}) {
  if (!parent || !Number.isFinite(size) || size < 16 || !Number.isFinite(minWidth) || minWidth < 0) {
    throw new TypeError('Cats need a parent, a size of at least 16, and a nonnegative minWidth.');
  }
  const canvas = document.createElement('canvas');
  canvas.dataset.desktopCats = '';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', pointerEvents: 'none',
    zIndex: String(zIndex), display: 'none',
  });
  const ctx = canvas.getContext('2d');
  const desktop = matchMedia(`(min-width: ${minWidth}px) and (hover: hover) and (pointer: fine)`);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const listeners = new AbortController();
  let width = innerWidth;
  let height = innerHeight;
  let paused = false;
  let destroyed = false;
  let active = false;
  let raf = 0;
  let lastTime = 0;
  let animationTime = 0;
  let pointer = null;
  let pointerChangedAt = 0;
  let drawTime = 0;
  const pets = cats.map((config, index) => ({
    name: config.name || `Cat ${index + 1}`,
    personality: config.personality === 'wanderer' ? 'wanderer' : 'chaser',
    speed: Number.isFinite(config.speed) && config.speed > 0 ? config.speed : config.personality === 'wanderer' ? 55 : 150,
    x: 80 + index * 110, y: height - size,
    direction: 's', state: 'idle', target: null,
    nextDecision: random(1500, 3500), idleSince: 0,
    draw: renderer(config),
  }));
  parent.append(canvas);

  function bound(point) {
    const margin = size / 2 + 8;
    return {
      x: clamp(point.x, Math.min(margin, width / 2), Math.max(width / 2, width - margin)),
      y: clamp(point.y, Math.min(margin, height / 2), Math.max(height / 2, height - margin)),
    };
  }

  function resize() {
    width = innerWidth;
    height = innerHeight;
    // Cap backing resolution to avoid a huge canvas on high-density screens.
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    pets.forEach(pet => {
      Object.assign(pet, bound(pet));
      if (pet.target) pet.target = bound(pet.target);
    });
  }

  function face(pet, target) {
    const angle = Math.atan2(target.y - pet.y, target.x - pet.x);
    pet.direction = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'][(Math.round(angle / (Math.PI / 4)) + 8) % 8];
  }

  function update(pet, dt, now, index) {
    const interested = pointer && now - pointerChangedAt < 14000;
    let pursuing = false;
    if (pet.personality === 'chaser' && interested) {
      // Stop beside the cursor, leaving the exact click target clear.
      pet.target = bound({ x: pointer.x - size * 0.8, y: pointer.y + size * 0.6 });
      pursuing = true;
    } else if (now >= pet.nextDecision) {
      pet.nextDecision = now + random(3500, 7500);
      const choice = Math.random();
      if (choice < 0.55) {
        pet.target = bound({ x: pet.x + random(-180, 180), y: pet.y + random(-110, 110) });
      } else if (choice < 0.75 && interested) {
        pet.target = bound({ x: pointer.x + random(90, 160), y: pointer.y + 90 });
      } else {
        pet.target = null;
        pet.state = choice > 0.9 ? 'sleep' : 'groom';
      }
    }

    if (pet.target && distance(pet, pet.target) > 5) {
      face(pet, pet.target);
      const remaining = distance(pet, pet.target);
      // Ease into a stop, with a brisker pace for the eager cat.
      const speed = pet.speed * (pursuing ? Math.min(1.5, Math.max(0.3, remaining / 140)) : 1);
      const step = Math.min(remaining, speed * dt);
      pet.x += (pet.target.x - pet.x) / remaining * step;
      pet.y += (pet.target.y - pet.y) / remaining * step;
      pet.state = 'walk';
      pet.idleSince = now;
    } else {
      pet.target = null;
      if (pet.state === 'walk') pet.state = 'idle';
      if (interested) face(pet, pointer);
      if (pursuing) {
        const resting = now - pet.idleSince;
        pet.state = resting > 10000 ? 'sleep' : resting > 4500 ? 'groom' : 'idle';
        pet.nextDecision = now + 3500;
      }
    }

    // A little personal space prevents both cats from sitting on the same pixel.
    pets.slice(0, index).forEach(other => {
      const gap = distance(pet, other);
      if (gap < size * 0.7) {
        const push = Math.min(size * 0.7 - gap, 35 * dt);
        pet.x += (gap ? (pet.x - other.x) / gap : 1) * push;
        pet.y += (gap ? (pet.y - other.y) / gap : 0) * push;
      }
    });
    Object.assign(pet, bound(pet));
  }

  function tick(time) {
    if (!active) return;
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    animationTime += dt * 1000;
    pets.forEach((pet, index) => update(pet, dt, animationTime, index));
    // Movement is time-based; 30fps is sufficient for these small illustrations.
    if (time - drawTime >= 1000 / 30) {
      ctx.clearRect(0, 0, width, height);
      pets.forEach(pet => pet.draw(ctx, pet, animationTime, size));
      drawTime = time;
    }
    raf = requestAnimationFrame(tick);
  }

  function sync() {
    const shouldRun = !destroyed && !paused && desktop.matches && !reduced.matches && !document.hidden;
    if (active === shouldRun) return;
    active = shouldRun;
    canvas.style.display = active ? 'block' : 'none';
    cancelAnimationFrame(raf);
    lastTime = 0;
    pointer = null;
    if (active) {
      resize();
      raf = requestAnimationFrame(tick);
    }
  }

  const eventOptions = { signal: listeners.signal };
  window.addEventListener('pointermove', event => {
    if (!active || event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    pointerChangedAt = animationTime;
  }, { ...eventOptions, passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer = null; }, eventOptions);
  window.addEventListener('blur', () => { pointer = null; }, eventOptions);
  window.addEventListener('resize', () => { if (active) resize(); }, eventOptions);
  document.addEventListener('visibilitychange', sync, eventOptions);
  desktop.addEventListener('change', sync, eventOptions);
  reduced.addEventListener('change', sync, eventOptions);
  sync();

  return {
    pause() { paused = true; sync(); },
    resume() { paused = false; sync(); },
    destroy() {
      destroyed = true;
      sync();
      listeners.abort();
      canvas.remove();
    },
    // Snapshot, useful for integrations and browser checks; no mutable internals.
    getState() {
      return { active, cats: pets.map(({ name, personality, x, y, state, direction }) =>
        ({ name, personality, x, y, state, direction })) };
    },
  };
}
