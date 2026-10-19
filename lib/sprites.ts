// Sheet contract: four 192px frames per row, in this exact order.
export const FRAME_SIZE = 192;
export const FRAME_COUNT = 4;

const layout = [
  { id: 'idle', label: 'Idle', duration: 500 },
  { id: 'walk-north', label: 'Walk north', duration: 140 },
  { id: 'walk-east', label: 'Walk east', duration: 140 },
  { id: 'walk-south', label: 'Walk south', duration: 140 },
  { id: 'walk-west', label: 'Walk west', duration: 140 },
  { id: 'groom', label: 'Groom', duration: 400 },
  { id: 'sleep', label: 'Sleep', duration: 1000 },
] as const;

export type AnimationId = (typeof layout)[number]['id'];
export interface Animation {
  readonly id: AnimationId;
  readonly label: string;
  readonly duration: number;
  readonly row: number;
}

export const animations: readonly Animation[] = Object.freeze(
  layout.map((animation, row) => Object.freeze({ ...animation, row })),
);

export const spriteSheets = Object.freeze({
  opale: Object.freeze({
    name: 'Opale',
    url: new URL('./assets/opale.webp', import.meta.url).href,
  }),
  masha: Object.freeze({
    name: 'Masha',
    url: new URL('./assets/masha.webp', import.meta.url).href,
  }),
});

export type BuiltinSprite = keyof typeof spriteSheets;

export function isBuiltinSprite(value: string): value is BuiltinSprite {
  return Object.hasOwn(spriteSheets, value);
}

const sheets = new Map<string, Promise<HTMLImageElement>>();
const byID = new Map(animations.map((animation) => [animation.id, animation]));

function getAnimation(id: AnimationId): Animation {
  const animation = byID.get(id);
  if (!animation) throw new RangeError(`Unknown animation: ${id}`);
  return animation;
}

/** Load once per URL. Custom sheets use the same 4 × 7 layout. */
export function loadSprite(sprite: string | URL = 'opale'): Promise<HTMLImageElement> {
  const url =
    typeof sprite === 'string' && isBuiltinSprite(sprite)
      ? spriteSheets[sprite].url
      : new URL(sprite, import.meta.url).href;
  const cached = sheets.get(url);
  if (cached) return cached;

  const image = new Image();
  image.src = url;
  const promise = image
    .decode()
    .then(() => {
      if (
        image.naturalWidth !== FRAME_SIZE * FRAME_COUNT ||
        image.naturalHeight !== FRAME_SIZE * animations.length
      ) {
        throw new Error(`Sprite sheet must be 768 × 1344 pixels: ${url}`);
      }
      return image;
    })
    .catch((error: unknown) => {
      sheets.delete(url); // A failed request must not poison future installations.
      throw error;
    });
  sheets.set(url, promise);
  return promise;
}

export function frameAt(animation: AnimationId, elapsed: number): number {
  return Math.floor(Math.max(0, elapsed) / getAnimation(animation).duration) % FRAME_COUNT;
}

/** Crop and draw a complete frame from the sprite sheet. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  animation: AnimationId,
  frame: number,
  size = ctx.canvas.width,
): void {
  const { row } = getAnimation(animation);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(
    image,
    frame * FRAME_SIZE,
    row * FRAME_SIZE,
    FRAME_SIZE,
    FRAME_SIZE,
    0,
    0,
    size,
    size,
  );
}
