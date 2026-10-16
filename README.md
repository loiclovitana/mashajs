# MashaJS

Two animated desktop cats for any website, with an editable SVG artwork workshop.
Vanilla JavaScript modules, no runtime dependencies, no build step.

## Add cats to a website

Once GitHub Pages is enabled, add this tag in the page's head or body:

```html
<script type="module" src="https://loiclovitana.github.io/mashajs/auto.js"></script>
```

The default calico follows the pointer; the Neva Masquerade wanders. The tag
loads the JavaScript modules, manifest, and SVG parts from the library's host.
Keep `type="module"`; this is a module distribution, not a bundled classic script.
The cats appear on desktop with a mouse/trackpad and a viewport at least 1024px
wide. Reduced motion hides and stops them. The overlay leaves clicks untouched.

To migrate the wedding site after publishing, replace its existing
`<script type="module" src="cats/wedding.js"></script>` with the tag above.
Confirm the cats load before removing the wedding repository's local `cats/` folder.

## Preview locally

```sh
./bin/start
# Optional: PORT=8080 ./bin/start
```

Requires Python 3. Open <http://localhost:8000/> for the workshop or
<http://localhost:8000/demo.html> for moving cats and pause/resume controls.
The local server allows cross-origin loading, so you can also test the script
from another local website using `http://localhost:8000/auto.js`.
Use HTTP rather than opening the HTML files via `file://`.

## Publish on GitHub Pages

1. Commit these files and push the `main` branch to
   <https://github.com/loiclovitana/mashajs>.
2. In the repository's **Settings → Pages**, select **Deploy from a branch**,
   branch **main**, folder **/ (root)**, then save.
3. After deployment, open <https://loiclovitana.github.io/mashajs/>.
   The movement demo is at <https://loiclovitana.github.io/mashajs/demo.html>.
4. Test the external script from the consuming website. Modules, JSON, and SVG
   fetches require CORS headers allowing that website's origin.

`.nojekyll` lets Pages serve the files directly. The preview and embedded cats
use the same artwork. Pushing changes to `main` updates both after deployment.
The URL above follows the latest deployment; it is not a pinned release.
If stable releases are needed later, publish complete versioned directories
(including modules and artwork) and embed a versioned `auto.js` URL.

For a website with a Content Security Policy, allow the library origin in
`script-src` and `connect-src`, and `blob:` in `img-src` for assembled SVG frames.

## Control an automatic installation

Importing the same `auto.js` URL returns the existing module instance:

```html
<script type="module">
  import { companions } from 'https://loiclovitana.github.io/mashajs/auto.js';
  // companions.pause();
  // companions.resume();
  // companions.destroy();
  // console.log(companions.getState());
</script>
```

## Configure your own cats

For a custom setup, import the engine directly (omit `auto.js` to avoid starting a second set of cats):

```js
import { createCats } from "https://loiclovitana.github.io/mashajs/cats.js";
```

```js
const companions = createCats({
  size: 80,
  minWidth: 1024,
  zIndex: 900,
  cats: [
    { name: 'Calico', personality: 'chaser', sprite: 'calico', speed: 150 },
    { name: 'Neva Masquerade', personality: 'wanderer', sprite: 'neva', speed: 55 },
  ],
});

companions.pause();   // Hide and freeze.
companions.resume();  // Resume when device/preferences permit.
companions.destroy();// Remove the overlay and its listeners; safe to repeat.
companions.getState();// Read a snapshot of behaviour and position.
```

In a framework, mount with `createCats()` and call `destroy()` on unmount.
The default parent is `document.body`; custom parents must be outside transformed
or clipped containers. Artwork colours now belong in the SVG files, not in the
old `colors`/`pattern` JavaScript settings.

The moving cats require a window at least `minWidth` wide, a primary fine pointer,
and hover support. Reduced motion or a hidden tab stops and hides them. The
canvas ignores pointer events and assistive technology. No third-party services,
global styles, or dependencies are used.

## Edit the cats

1. Start the preview server from the project root: `./bin/start` (requires Python 3).
   To use another port, run `PORT=8080 ./bin/start`.
2. Open <http://localhost:8000/>.
3. Choose a cat and **Individual parts**. Every card gives the exact SVG filename
   and a link to the file. Open that file in a vector editor or text editor.
4. Edit and save. Preserve its existing artboard/viewBox and coordinates; the
   pose layout positions the part. In a vector editor, use plain/self-contained
   SVG and keep any images embedded, not linked to files on your computer.
5. Refresh the gallery. Choose **Assembled poses** to see all eight directions
   of walking, sitting, grooming, and sleeping, including every still frame
   and an animated preview. “Parts used” links each pose to its source parts.
6. Check <http://localhost:8000/demo.html> for the moving cats, or a website embedding the library. Refresh those pages after saving artwork, too.

For example, changing `artwork/calico/ears.svg` updates the calico's ears across
all poses. Changing `artwork/neva/eyes-closed.svg` updates blinking, grooming,
and sleeping eyes. Editing one cat's files does not change the other cat.

The preview works on mobile as well as desktop. The moving cats remain desktop
only. Light, dark, and checkerboard backgrounds help inspect transparent edges.
The gallery starts paused when reduced motion is enabled, and provides an
explicit Play/Pause control.

## Folder layout

```
mashajs/
  artwork/
    calico/
      head.svg
      ears.svg
      head-markings.svg
      eyes-front.svg
      eyes-side.svg
      eyes-closed.svg
      body-front.svg
      body-side.svg
      tail.svg
      tail-raised.svg
      ...                    # Separate paws, coat markings, sleeping parts, etc.
    neva/
      ...                    # Independent parts for the Siberian
    manifest.json            # Parts index, pose layers, frame timing/placement
  index.html                 # Artwork workshop (GitHub Pages homepage)
  preview.css
  preview.js
  artwork.js                 # Shared loading and assembly; no drawings here
  sprites.js                 # Plays the assembled frames; no drawings here
  cats.js                    # Mouse following, wandering, lifecycle
  our-cats.js                # Names, personalities, selected artwork sets
  auto.js                    # Automatic one-tag integration
  demo.html                  # Independent movement demo
```

Optional validation after editing: `python3 check_artwork.py` checks SVG
syntax and pose references. The gallery additionally checks browser rendering.

The component SVG files are the source artwork. They are not regenerated or
overwritten by the website. Shared components deliberately avoid having to edit
the same head in hundreds of separate full-cat frames.

## Change poses or add a part

Ordinary drawing edits require **only editing an SVG**, not the manifest.

For a different pose, edit `artwork/manifest.json`. Each cat has:

- `components`: names mapped to SVG file paths relative to the manifest.
- `states`: `idle`, `walk`, `groom`, and `sleep`.
- Each state has a positive `duration` (milliseconds per frame) and `directions`:
  `n`, `ne`, `e`, `se`, `s`, `sw`, `w`, `nw` (north is up the screen).
- Each direction contains an ordered list of frames. Each frame has `layers`,
  painted in array order. Each layer names a `component` and its SVG `transform`.

Example layer: `{ "component": "head", "transform": "translate(48 40)" }`.
Moving that transform moves the head for that frame. To make a unique head for
one pose, copy `head.svg`, register the copy in `components`, and change only
that frame's component reference. To add an animation frame, append another
frame object to the direction's list; the gallery and player use its new length.

A static website cannot enumerate arbitrary files in a folder. The manifest is
the explicit index used by both the gallery and player. Replacing an existing
file needs no index change; a **new** file must be registered in `components`.
All registered parts appear in the gallery, including unused parts.

Component artboards use `0 0 96 96` for body parts and `-48 -48 96 96` for facial
parts centred around the head's origin. The assembled cat uses `0 0 96 96`.
Keep those coordinate systems when editing so parts stay aligned. All eight
facing directions can be previewed; some currently reuse front or side artwork or a mirrored version. North-facing
poses keep the same visible face and eyes as their south-facing counterparts.
They are not eight distinct anatomical views.

Malformed or missing SVGs are reported on the gallery card; fix the file and
refresh to retry. Artwork and the manifest are fetched fresh on page reload.
The live renderer loads only the poses it needs and caches them during the visit.


## License

The source code retains its MIT license. SVG artwork retains the original
all-rights-reserved terms; it is not covered by the code license. See [LICENSE](LICENSE).
