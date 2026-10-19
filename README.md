# MashaJS

Two animated cats for any website. Seven animations, four complete frames each:
**idle, walk north, walk east, walk south, walk west, groom, sleep**.

Written in strict TypeScript and compiled to native JavaScript ES modules, with
no framework, bundler, or runtime dependencies. The preview and embedded cats use
the same sprite sheets. Consumers only need the built files or a hosted script URL.

`lib/` contains the standalone TypeScript library and its runtime artwork.
`preview/` is a separate site that imports the module to show the frame studio
and live cat controls. The library has no dependency on the preview site.

## Development and preview

Requires Node.js 24 or later and Git LFS.

If you use Nix, run `nix develop` first to get Node.js 24, npm, Git, and Git LFS.
The environment is pinned by `flake.lock` and supports Linux and macOS on x86_64
and ARM64. Nix's `nix-command` and `flakes` features must be enabled.

After cloning:

```sh
git lfs install --local
git lfs pull
npm ci
npm start
# Optional: PORT=8080 npm start
# ./bin/start is an alias for npm start.
```

Open <http://localhost:8000/preview/>. `npm start` builds and serves `dist/`, the
same artifact published to GitHub Pages. The root URL redirects to the preview.
Use HTTP rather than opening HTML files with `file://`.

For TypeScript development, keep `npm run watch` running in another terminal;
it recompiles library and preview modules into `dist/`. Refresh the browser to
see changes. After editing HTML, CSS, or artwork, restart `npm start` to copy the
updated static files. The server disables browser caching and allows cross-origin
module imports for testing embeds from another local website.

Toggle live cats on or off, add or remove cats, and choose Chaser or Wanderer.
Adjust cat size, minimum screen width, layer order, and each cat's movement speed.
Leave speed empty to use the behavior's default. The live preview and installation
snippet update to match your configuration. The frame studio
shows all seven animations with cat selection and light/dark/transparency
backgrounds. It works on mobile and starts paused for reduced motion.

```sh
./bin/lint           # Autoformat the project and apply ESLint fixes
npm run lint         # ESLint, including rules that use TypeScript type information
npm run lint:fix     # Apply safe automatic lint fixes
npm run format       # Autoformat with Prettier
npm run format:check # Check formatting without changing files
npm run typecheck    # Strict TypeScript checks without emitting files
npm run build        # Clean build into dist/, including declaration files
npx playwright install chromium  # One-time browser installation for tests
npm test             # Build, sprite tests, and browser integration tests
npm run check        # Check formatting, lint, typecheck, build, and all tests
```

`./bin/lint` requires npm dependencies (`npm ci`) and works from any working
directory. It exits with an error if formatting fails or any lint errors remain.

On Linux, `npx playwright install --with-deps chromium` also installs required
system libraries. To use an existing Chromium installation, set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable path.
Browser tests serve the artifact under `/mashajs/`, exercise imports from a
separate origin, and cover preview controls, loading failures, and lifecycle behavior.

## Add cats to a website

Run `npm run build`, then copy the contents of `dist/lib/` into a `mashajs/`
directory on your site, keeping `assets/` alongside the JavaScript files. Include
`dist/LICENSE` when distributing the module. Then add:

```html
<script type="module" src="/mashajs/auto.js"></script>
```

The calico follows your cursor; the Neva Masquerade wanders, grooms, and sleeps.
The overlay lets clicks through. Cats stop and hide on narrow screens (below
1024px by default), hidden tabs, or when reduced motion is
requested. The frame studio works on mobile and starts paused for reduced motion.

After publishing this project to GitHub Pages, the same installation works across
websites with this URL:

```html
<script type="module" src="https://loiclovitana.github.io/mashajs/lib/auto.js"></script>
```

Module imports and image URLs resolve relative to the library, so nested pages
and installations on other origins work. The JavaScript host must allow CORS.
The development server includes CORS headers for testing from another local website.
For that local server, the module entry point is
`http://localhost:8000/lib/auto.js`.
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
      { sprite: 'opale', personality: 'chaser', speed: 150 },
      { sprite: 'masha', personality: 'wanderer', speed: 55 },
    ],
  });

  await cats.ready; // Resolves when both sheets have decoded; rejects on failure.
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

### TypeScript consumers

The build emits `.d.ts` declarations alongside the JavaScript. Copy the whole
`dist/lib/` directory to retain editor completion and type checking. The public
entry point exports `CatConfig`, `CatsOptions`, `CatsController`, `CatState`,
`CatsState`, `Personality`, and `AnimationId` types:

```ts
import { createCats, type CatsOptions } from './mashajs/cats.js';

const options = {
  cats: [{ sprite: 'opale', personality: 'chaser' }],
} satisfies CatsOptions;

const cats = createCats(options);
await cats.ready;
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

| Row (zero-based) | Animation    | Milliseconds per frame |
| ---------------- | ------------ | ---------------------- |
| 0                | `idle`       | 500                    |
| 1                | `walk-north` | 140                    |
| 2                | `walk-east`  | 140                    |
| 3                | `walk-south` | 140                    |
| 4                | `walk-west`  | 140                    |
| 5                | `groom`      | 400                    |
| 6                | `sleep`      | 1000                   |

The renderer loads and decodes each sheet once per module instance. Each cat has
a small canvas (at most 2× display density), repainted only when its frame changes.
Movement is time-based and capped at 30 updates per second; animation changes start
at frame one. Diagonal travel uses its dominant cardinal
walking direction. Idle, groom, and sleep each have one fixed view.

North has a rear view, south has a front view, and east/west have side views.

### Edit a sprite sheet

Open `lib/assets/opale.webp` or `lib/assets/masha.webp` in an image editor. Keep the
transparent background, 768 × 1344 dimensions, row order, and four frames per row,
then save as lossless WebP, rebuild, and refresh the preview.

For a custom cat, export a sheet with the same layout and set the cat's
`sprite` option to an absolute URL or a URL object:

```js
createCats({ cats: [{ sprite: new URL('./my-cat.webp', import.meta.url) }] });
```

Relative sprite strings resolve against the library's `sprites.js`; prefer a URL
object when the custom asset belongs to the consuming site.

## Files

```text
lib/                 TypeScript library source; independent of the preview
  assets/            Runtime WebP sheets, stored with Git LFS
  types.ts           Public configuration, state, and lifecycle interfaces
  sprites.ts         Sheet layout, cached loading, frame drawing
  cats.ts            Movement and lifecycle; exports createCats()
  our-cats.ts        Default names, personalities, and sprite choices
  auto.ts            One-tag installation; exports companions
preview/             TypeScript preview, HTML, and CSS
scripts/             Build and local static server
tests/              Sprite and browser integration tests
.github/workflows/   Checks and GitHub Pages deployment
dist/               Generated output; ignored by Git
  lib/               Browser ES modules, declarations, and artwork
  preview/           Compiled preview site
  index.html         Redirect to preview/
  LICENSE            Source and artwork licensing
```

## Publish to GitHub Pages

In the repository's **Settings → Pages → Build and deployment**, select
**GitHub Actions** as the source. Push to `main`, or manually run **Check and
deploy GitHub Pages** from the Actions tab.

The workflow checks out the LFS artwork, installs locked development dependencies,
runs linting, strict type checking, and tests, then uploads **only `dist/`** and
deploys it to Pages. Pull requests run the same checks without deploying.
The build fails with an actionable error if the artwork is still an LFS pointer.

The published paths remain:

- Preview: <https://loiclovitana.github.io/mashajs/preview/>
- Automatic embed: <https://loiclovitana.github.io/mashajs/lib/auto.js>
- Configurable module: <https://loiclovitana.github.io/mashajs/lib/cats.js>

All module, stylesheet, and artwork paths are relative, so the output also works
at a domain root, another repository prefix, or a custom domain. The preview's
copyable installation snippet intentionally points at the public MashaJS host.
Existing embeds using `/mashajs/lib/auto.js` or `/mashajs/lib/cats.js` keep working.
The hosted embed follows the latest deployment; use versioned directories for
pinned releases.

For another static host, publish the contents of `dist/`. To distribute only the
library, copy `dist/lib/` and `dist/LICENSE`. Never publish the TypeScript source
directly or use Pages' **Deploy from a branch** mode for this project: the site
requires compilation and the artwork requires LFS checkout.

## License

Source code is MIT. Artwork (WebP sprite sheets) retains its
original all-rights-reserved terms. See [LICENSE](LICENSE).
