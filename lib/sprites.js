// Sheet contract: four 192px frames per row, in this exact order.
export const FRAME_SIZE = 192;
export const FRAME_COUNT = 4;
export const animations = Object.freeze([
  { id: 'idle', label: 'Idle', duration: 500 },
  { id: 'walk-north', label: 'Walk north', duration: 140 },
  { id: 'walk-east', label: 'Walk east', duration: 140 },
  { id: 'walk-south', label: 'Walk south', duration: 140 },
  { id: 'walk-west', label: 'Walk west', duration: 140 },
  { id: 'groom', label: 'Groom', duration: 400 },
  { id: 'sleep', label: 'Sleep', duration: 1000 },
].map((animation, row) => Object.freeze({ ...animation, row })));

export const spriteSheets = Object.freeze({
  opale: Object.freeze({ name: 'Opale', url: new URL('./assets/opale.webp', import.meta.url).href }),
  masha: Object.freeze({ name: 'Masha ', url: new URL('./assets/masha.webp', import.meta.url).href }),
});

const sheets = new Map();
const byID = new Map(animations.map(animation => [animation.id, animation]));

/** Load once per URL. Custom sheets use the same 4 × 7 layout. */
export function loadSprite(sprite = 'opale') {
  const url = spriteSheets[sprite]?.url ?? new URL(sprite, import.meta.url).href;
  if (!sheets.has(url)) {
    const image = new Image();
    image.src = url;
    const promise = image.decode().then(() => {
      if (image.naturalWidth !== FRAME_SIZE * FRAME_COUNT || image.naturalHeight !== FRAME_SIZE * animations.length) {
        throw new Error(`Sprite sheet must be 768 × 1344 pixels: ${url}`);
      }
      return image;
    }).catch(error => {
      sheets.delete(url); // A failed request must not poison future installations.
      throw error;
    });
    sheets.set(url, promise);
  }
  return sheets.get(url);
}

export function frameAt(animation, elapsed) {
  return Math.floor(Math.max(0, elapsed) / byID.get(animation).duration) % FRAME_COUNT;
}

/** Crop and draw a complete frame from the sprite sheet. */
export function drawFrame(ctx, image, animation, frame, size = ctx.canvas.width) {
  const { row } = byID.get(animation);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(image, frame * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE, 0, 0, size, size);
}
