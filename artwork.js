// Shared by the website renderer and the artwork gallery.
export const manifestURL = new URL('./artwork/manifest.json', import.meta.url);
const textCache = new Map();
const frameCache = new Map();
let catalogPromise;

export function loadCatalog() {
  catalogPromise ??= fetch(manifestURL, { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error(`Cannot load artwork manifest (${response.status}).`);
    const catalog = await response.json();
    if (catalog.version !== 1 || !catalog.cats || !(catalog.size > 0)) {
      throw new Error('Unsupported artwork manifest.');
    }
    return catalog;
  });
  return catalogPromise;
}

export function componentURL(component) {
  return new URL(component.file, manifestURL).href;
}

function loadComponent(component) {
  const url = componentURL(component);
  if (!textCache.has(url)) {
    textCache.set(url, fetch(url, { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error(`Cannot load ${component.file} (${response.status}).`);
      const xml = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg') {
        throw new Error(`Invalid SVG: ${component.file}`);
      }
      return xml.documentElement;
    }));
  }
  return textCache.get(url);
}

/** Assemble the same editable SVG components for previews and live cats. */
export function loadFrame(catalog, catID, state, direction, frameIndex) {
  const key = `${catID}/${state}/${direction}/${frameIndex}`;
  if (!frameCache.has(key)) {
    frameCache.set(key, (async () => {
      const cat = catalog.cats[catID];
      const frame = cat?.states[state]?.directions[direction]?.[frameIndex];
      if (!frame) throw new Error(`Missing pose: ${key}`);
      const namespace = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(namespace, 'svg');
      svg.setAttribute('xmlns', namespace);
      svg.setAttribute('width', catalog.size * 2);
      svg.setAttribute('height', catalog.size * 2);
      svg.setAttribute('viewBox', `0 0 ${catalog.size} ${catalog.size}`);
      const layers = await Promise.all(frame.layers.map(async layer => {
        const component = cat.components[layer.component];
        if (!component) throw new Error(`Unknown component: ${catID}/${layer.component}`);
        const source = await loadComponent(component);
        const group = document.createElementNS(namespace, 'g');
        for (const attribute of source.attributes) {
          if (!['xmlns', 'width', 'height', 'viewBox', 'x', 'y'].includes(attribute.name)) {
            group.setAttribute(attribute.name, attribute.value);
          }
        }
        const placement = document.createElementNS(namespace, 'g');
        placement.setAttribute('transform', layer.transform || '');
        for (const child of source.children) {
          if (child.localName !== 'title') group.append(child.cloneNode(true));
        }
        placement.append(group);
        return placement;
      }));
      svg.append(...layers);
      const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
      } finally {
        URL.revokeObjectURL(url);
      }
    })());
  }
  return frameCache.get(key);
}
