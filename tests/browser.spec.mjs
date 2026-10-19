import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const libraryURL = 'http://127.0.0.1:4173/mashajs/lib/cats.js';
const opale = await readFile(new URL('../dist/lib/assets/opale.webp', import.meta.url));

async function openHost(page) {
  await page.goto('http://127.0.0.1:4174/nested/page');
}

test('the Pages root redirects to a working preview under the repository prefix', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page).toHaveURL(/\/mashajs\/preview\//);
  await expect(page.locator('#status')).toContainText('28 complete frames');
  await expect(page.locator('#gallery canvas')).toHaveCount(35);
  await expect(page.locator('[data-desktop-cats] canvas')).toHaveCount(2);
  await expect(page.locator('#live-status')).toContainText('Chasers follow your cursor');
  await page.selectOption('#cat', 'masha');
  await expect(page.locator('#status')).toContainText('Masha · 7 animations');
  await expect(page.locator('#sheet')).toHaveAttribute(
    'href',
    /\/mashajs\/lib\/assets\/masha.webp$/,
  );
  await page.selectOption('#background', 'dark');
  await expect(page.locator('#gallery')).toHaveAttribute('data-background', 'dark');
  await page.reload();
  await expect(page.locator('#cat')).toHaveValue('masha');
  await expect(page.locator('#gallery')).toHaveAttribute('data-background', 'dark');
  expect(errors).toEqual([]);
});

test('live controls add, remove, change behavior, and update the installation snippet', async ({
  page,
}) => {
  await page.goto('preview/');
  await expect(page.locator('#live-status')).toContainText('Chasers follow your cursor');
  await page.locator('#current-cats select').first().selectOption('wanderer');
  await expect(page.locator('#embed-code')).toContainText('personality: "wanderer"');
  await page.selectOption('#new-cat', 'masha');
  await page.getByRole('button', { name: 'Add cat', exact: true }).click();
  await expect(page.locator('[data-desktop-cats] canvas')).toHaveCount(3);
  await page.uncheck('#preview-enabled');
  await expect(page.locator('[data-desktop-cats]')).toHaveCount(0);
  await expect(page.locator('#live-status')).toHaveText('Preview is off.');
  await page.check('#preview-enabled');
  await expect(page.locator('[data-desktop-cats] canvas')).toHaveCount(3);
  for (let count = 3; count > 0; count--) {
    await page.locator('#current-cats button').first().click();
    await expect(page.locator('#current-cats .cat-row')).toHaveCount(count - 1);
  }
  await expect(page.locator('#live-status')).toHaveText('Add a cat to preview it here.');
  await expect(page.locator('#embed-code')).toContainText('cats: []');
});

test('one-tag installation works from another origin and preserves pointer interaction', async ({
  page,
}) => {
  await openHost(page);
  await page.addScriptTag({ type: 'module', url: libraryURL.replace('cats.js', 'auto.js') });
  const state = await page.evaluate(async (url) => {
    const { companions } = await import(url.replace('cats.js', 'auto.js'));
    await companions.ready;
    window.companions = companions;
    return companions.getState();
  }, libraryURL);
  expect(state).toMatchObject({ loaded: true, active: true, error: null });
  expect(state.cats).toHaveLength(2);
  await page.getByRole('button', { name: 'Host button' }).click();
  await page.mouse.move(700, 300);
  await expect
    .poll(() => page.evaluate(() => window.companions.getState().cats[0].x))
    .toBeGreaterThan(90);
});

test('default sprite, snapshots, pause, resume, and repeated destruction work', async ({
  page,
}) => {
  await openHost(page);
  const result = await page.evaluate(async (url) => {
    const { createCats } = await import(url);
    const cats = createCats({ cats: [{}] });
    await cats.ready;
    const before = cats.getState();
    const snapshot = cats.getState();
    snapshot.cats[0].name = 'mutated';
    cats.pause();
    const paused = cats.getState();
    cats.resume();
    const resumed = cats.getState();
    cats.destroy();
    cats.destroy();
    cats.resume();
    return {
      before,
      paused,
      resumed,
      destroyed: cats.getState(),
      overlays: document.querySelectorAll('[data-desktop-cats]').length,
    };
  }, libraryURL);
  expect(result.before).toMatchObject({ loaded: true, active: true, error: null });
  expect(result.paused.active).toBe(false);
  expect(result.resumed.active).toBe(true);
  expect(result.resumed.cats[0].name).toBe('Cat 1');
  expect(result.destroyed.active).toBe(false);
  expect(result.overlays).toBe(0);
});

for (const action of ['pause', 'destroy']) {
  test(`${action} while loading prevents activation when the image finishes`, async ({ page }) => {
    await openHost(page);
    let release;
    let requested;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const received = new Promise((resolve) => {
      requested = resolve;
    });
    await page.route('**/delayed.webp', async (route) => {
      requested();
      await gate;
      await route.fulfill({ contentType: 'image/webp', body: opale });
    });
    await page.evaluate(
      async ({ url, action }) => {
        const { createCats } = await import(url);
        window.companions = createCats({
          cats: [{ sprite: new URL('./assets/delayed.webp', url) }],
        });
        window.companions[action]();
      },
      { url: libraryURL, action },
    );
    await received;
    release();
    const result = await page.evaluate(async () => {
      await window.companions.ready;
      const loaded = window.companions.getState();
      window.companions.resume();
      const resumed = window.companions.getState();
      window.companions.destroy();
      return { loaded, resumed };
    });
    expect(result.loaded).toMatchObject({ loaded: true, active: false });
    expect(result.resumed.active).toBe(action === 'pause');
    await expect(page.locator('[data-desktop-cats]')).toHaveCount(0);
  });
}

test('failed loads reject ready, report errors, and can be retried', async ({ page }) => {
  await openHost(page);
  let attempts = 0;
  await page.route('**/retry.webp', (route) => {
    attempts++;
    return attempts === 1
      ? route.abort()
      : route.fulfill({ contentType: 'image/webp', body: opale });
  });
  const result = await page.evaluate(async (url) => {
    const { createCats } = await import(url);
    const sprite = new URL('./assets/retry.webp', url);
    const failures = [];
    const broken = createCats({
      cats: [{ sprite }],
      onError: (error) => failures.push(error.message),
    });
    let rejected = false;
    try {
      await broken.ready;
    } catch {
      rejected = true;
    }
    const failedState = broken.getState();
    broken.destroy();
    const retry = createCats({ cats: [{ sprite }] });
    await retry.ready;
    const retryState = retry.getState();
    retry.destroy();
    return { rejected, failures, failedState, retryState };
  }, libraryURL);
  expect(result.rejected).toBe(true);
  expect(result.failures).toHaveLength(1);
  expect(result.failedState).toMatchObject({
    active: false,
    loaded: false,
    error: result.failures[0],
  });
  expect(result.retryState).toMatchObject({ active: true, loaded: true, error: null });
  expect(attempts).toBe(2);
});

test('loading is shared and incorrect sprite dimensions are rejected', async ({ page }) => {
  await openHost(page);
  const result = await page.evaluate(async (url) => {
    const { loadSprite } = await import(url.replace('cats.js', 'sprites.js'));
    const first = loadSprite('opale');
    const shared = first === loadSprite('opale');
    await first;
    const tiny = document.createElement('canvas');
    tiny.width = tiny.height = 1;
    let message;
    try {
      await loadSprite(tiny.toDataURL());
    } catch (error) {
      message = error.message;
    }
    return { shared, message };
  }, libraryURL);
  expect(result.shared).toBe(true);
  expect(result.message).toContain('Sprite sheet must be 768 × 1344 pixels');
});

test('motion preferences and narrow viewports stop and restart cats', async ({ page }) => {
  await openHost(page);
  await page.evaluate(async (url) => {
    const { createCats } = await import(url);
    window.companions = createCats();
    await window.companions.ready;
  }, libraryURL);
  const active = () => page.evaluate(() => window.companions.getState().active);
  await expect.poll(active).toBe(true);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(active).toBe(false);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(active).toBe(true);
  await page.setViewportSize({ width: 800, height: 800 });
  await expect.poll(active).toBe(false);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(active).toBe(true);
});

test('mobile preview remains usable with live cats disabled', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/mashajs/preview/?cat=constructor&background=invalid');
  await expect(page.locator('#status')).toContainText('28 complete frames');
  await expect(page.locator('#gallery canvas')).toHaveCount(35);
  await expect(page.locator('[data-desktop-cats]')).toBeHidden();
  await expect(page.locator('#gallery .animated figcaption').first()).toContainText('Paused');
  await expect(page.locator('#cat')).toHaveValue('opale');
  await context.close();
});
