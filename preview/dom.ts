/** Fail at startup with a useful error if the preview markup is out of sync. */
export function requireElement<T extends Element>(selector: string, constructor: { new (): T }): T {
  const element = document.querySelector(selector);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing or invalid preview element: ${selector}`);
  }
  return element;
}

export function context2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D rendering is unavailable.');
  return context;
}
