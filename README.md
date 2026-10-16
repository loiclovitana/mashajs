# MashaJS

Two animated cats for any website. Seven animations, four complete frames each:
**idle, walk north, walk east, walk south, walk west, groom, sleep**.

Plain JavaScript ES modules. No framework, runtime dependencies, npm installation,
or JavaScript build step. The preview and embedded cats use the same sprite sheets.

## Preview

```sh
./bin/start
# Optional: PORT=8080 ./bin/start
```

Requires Python 3. Open <http://localhost:8000/> for the frame studio, or
<http://localhost:8000/demo.html> to watch the cats roam. The studio supports cat
and animation selection, light/dark/transparency backgrounds, pause, and stepping
through frames.
Use HTTP, rather than opening HTML files with `file://`.

The local server disables browser caching to keep the page and its modules in
sync. If you previously ran an older version and see a blank gallery or a
`preview.js` error about a missing element, restart `./bin/start` and hard-refresh
the page once (`Ctrl+Shift+R` in Firefox) to clear the previously cached files.

## Add cats to a website

Copy `cats.js`, `sprites.js`, `our-cats.js`, `auto.js`, and `assets/` into a
`mashajs/` directory on your site, keeping that structure. Then add:

```html
<script type="module" src="/mashajs/auto.js"></script>
```

The calico follows your cursor; the Neva Masquerade wanders, grooms, and sleeps.
The overlay lets clicks through. Cats stop and hide on narrow screens (below
1024px by default), touch-only devices, hidden tabs, or when reduced motion is
requested. The frame studio works on mobile and starts paused for reduced motion.

After publishing this project to GitHub Pages, the same installation works across
websites with this URL:

```html
<script type="module" src="https://loiclovitana.github.io/mashajs/auto.js"></script>
```

Module imports and image URLs resolve relative to the library, so nested pages
and installations on other origins work. The JavaScript host must allow CORS.
`./bin/start` includes CORS headers for testing from another local website.
For a CSP, allow the library's origin in `script-src` and `img-src`; the renderer
also sets inline element styles, which your style policy must permit.
No `blob:` images or artwork fetches are needed.

## Import as a module

Use this instead of `auto.js` when you want your own configuration:

```html
<script type="module">
  import { createCats } from '/mashajs/cats.js';

  const cats = createCats({
    size: 80,
    minWidth: 1024,
    zIndex: 900,
    cats: [
      { name: 'Calico', sprite: 'calico', personality: 'chaser', speed: 150 },
      { name: 'Neva', sprite: 'neva', personality: 'wanderer', speed: 55 },
    ],
  });

  await cats.ready;      // Resolves when both sheets have decoded; rejects on failure.
  // cats.pause();       // Hide and freeze.
  // cats.resume();      // Resume if the device and motion preferences permit.
  // cats.getState();    // Snapshot: active, loaded, error, and each cat's animation/frame/position.
  // cats.destroy();     // Remove the overlay, listeners, and animation loop; safe to repeat.
</script>
```

Calling `createCats()` without options creates both cats. In a framework, call it
after mounting and `destroy()` on unmount. The default parent is `document.body`;
a custom parent must be outside transformed or clipped containers. Call after
the parent exists. `auto.js` handles document readiness automatically.

The `onError(error)` option reports failed image loads (defaults to `console.error`).
A failed installation stays hidden and exposes the message in `getState().error`.
Pause, resume, and destroy are safe while images are still loading.

An automatic installation can also be controlled by importing its module instance:

```js
import { companions } from '/mashajs/auto.js';
companions.pause();
```

## Artwork and storage

WebP (`*.webp`) and PNG (`*.png`) files are stored with Git LFS. Install
[Git LFS](https://git-lfs.com/), then run these commands after cloning, before
starting the preview:

```sh
git lfs install --local
git lfs pull
```

Add and commit images normally; Git LFS uploads their contents when you push.

Each cat has **one lossless WebP sheet** with transparency, 768 × 1344 pixels:
4 columns × 7 rows, with 192 × 192 pixel tiles. Rows are fixed in this order:

| Row (zero-based) | Animation | Milliseconds per frame |
| --- | --- | --- |
| 0 | `idle` | 500 |
| 1 | `walk-north` | 140 |
| 2 | `walk-east` | 140 |
| 3 | `walk-south` | 140 |
| 4 | `walk-west` | 140 |
| 5 | `groom` | 400 |
| 6 | `sleep` | 1000 |

The renderer loads and decodes each sheet once per module instance. Each cat has
a small canvas (at most 2× display density), repainted only when its frame changes.
Movement is time-based and capped at 30 updates per second; animation changes start
at frame one. Diagonal travel uses its dominant cardinal
walking direction. Idle, groom, and sleep each have one fixed view.

North has a rear view, south has a front view, and east/west have side views.

### Edit a sprite sheet

Open `assets/calico.webp` or `assets/neva.webp` in an image editor. Keep the
transparent background, 768 × 1344 dimensions, row order, and four frames per row,
then save as lossless WebP and refresh the preview.

For a custom cat, export a sheet with the same layout and set the cat's
`sprite` option to an absolute URL or a URL object:

```js
createCats({ cats: [{ sprite: new URL('./my-cat.webp', import.meta.url) }] });
```

Relative sprite strings resolve against the library's `sprites.js`; prefer a URL
object when the custom asset belongs to the consuming site.

## Files

```text
assets/              Two packed WebP sheets; used at runtime
sprites.js           Sheet layout, cached loading, frame drawing
cats.js              Movement and lifecycle
our-cats.js          Default names, personalities, and sprite choices
auto.js              One-tag installation
index.html           Frame studio
preview.js / .css     Studio playback and styling
demo.html            Moving cats and pause/resume controls
bin/start            Local preview server
tests/browser.py     Browser regression checks
```

## Browser checks

The optional test tools are development dependencies only:

```sh
python3 -m venv .venv
.venv/bin/pip install playwright
.venv/bin/playwright install chromium
.venv/bin/python tests/browser.py
```

To use an existing Chromium installation, set `CHROMIUM=/path/to/chromium`.
The tests start their own local server and cover frame rendering and timing,
preview controls, mobile layout, movement, lifecycle, preferences, image failures,
and embedding from another origin.

## Publish

Publish from a checkout with the LFS image contents downloaded (`git lfs pull`),
keeping `assets/` alongside the modules. For GitHub Pages, use a custom GitHub
Actions workflow that downloads LFS files before uploading the Pages artifact.
The built-in **Deploy from a branch** flow does not support
[Git LFS files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage).
`.nojekyll` allows serving these files directly. The hosted embed URL follows the
latest deployment; use versioned directories if you need pinned releases.

The public `createCats()`, automatic `companions`, and lifecycle methods remain.
`getState()` now reports the seven explicit `animation` values and a zero-based
`frame` instead of separate `state` and `direction`. The old custom `renderer`
option has been replaced by supplying a sprite sheet.

## License

Source code is MIT. Artwork (WebP sprite sheets) retains its
original all-rights-reserved terms. See [LICENSE](LICENSE).
