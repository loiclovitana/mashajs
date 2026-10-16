import { loadCatalog, loadFrame } from './artwork.js';

// Drawings live in artwork/<cat>/*.svg. This file only plays their poses.
export function createCatRenderer({ sprite = 'calico' } = {}) {
  let catalog;
  let started = false;
  let lastImage;
  const animations = new Map();
  const report = error => console.error(`[Desktop cats: ${sprite}] ${error.message}`);

  return (ctx, cat, time, size) => {
    // Load artwork only when the engine actually draws (never on mobile).
    if (!started) {
      started = true;
      loadCatalog().then(result => {
        if (!result.cats[sprite]) throw new Error(`Unknown sprite set: ${sprite}`);
        catalog = result;
      }).catch(report);
    }
    if (!catalog) return;
    const animation = catalog.cats[sprite].states[cat.state];
    const frames = animation?.directions[cat.direction];
    if (!frames) return;
    const key = `${cat.state}/${cat.direction}`;
    if (!animations.has(key)) {
      const entry = { images: null };
      animations.set(key, entry);
      Promise.all(frames.map((_, index) => loadFrame(catalog, sprite, cat.state, cat.direction, index)))
        .then(images => { entry.images = images; }).catch(report);
    }
    const images = animations.get(key).images;
    if (images) lastImage = images[Math.floor(time / animation.duration) % images.length];
    if (lastImage) ctx.drawImage(lastImage, Math.round(cat.x - size / 2), Math.round(cat.y - size / 2), size, size);
  };
}
