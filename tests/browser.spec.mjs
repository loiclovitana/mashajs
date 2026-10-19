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
  await expect(page.locator('#current-cats canvas')).toHaveCount(2);
  await expect(page.locator('[data-desktop-cats] canvas')).toHaveCount(2);
  await expect(page.locator('#live-status')).toContainText('Chasers follow your cursor');
  await page.locator('#current-cats').getByRole('link', { name: 'Masha', exact: true }).click();
  await expect(page.locator('#cat')).toHaveValue('masha');
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
  await expect(page.locator('#cat')).toHaveValue('masha');
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

test('creation settings update the live cats and installation code', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('preview/');
  const overlay = page.locator('[data-desktop-cats]');
  const canvas = overlay.locator('canvas').first();
  const code = page.locator('#embed-code');
  await expect(canvas).toHaveCSS('width', '120px');
  await expect(code).toContainText('size: 120');

  await page.getByLabel('Cat size (px)', { exact: true }).fill('160');
  await page.getByLabel('Layer order (z-index)', { exact: true }).fill('1200');
  await page.getByLabel('Minimum screen width (px)', { exact: true }).fill('1600');
  await page.getByLabel('Minimum screen width (px)', { exact: true }).press('Tab');
  await expect(canvas).toHaveCSS('width', '160px');
  await expect(canvas).toHaveCSS('height', '160px');
  await expect(overlay).toHaveCSS('z-index', '1200');
  await expect(overlay).toBeHidden();
  await expect(page.locator('#live-status')).toContainText('at least 1600px');
  await expect(code).toContainText('size: 160');
  await expect(code).toContainText('minWidth: 1600');
  await expect(code).toContainText('zIndex: 1200');

  await page.setViewportSize({ width: 1700, height: 1000 });
  await expect(overlay).toBeVisible();
  await expect(page.locator('#live-status')).toContainText('Chasers follow your cursor');

  const speed = page.getByLabel('Opale speed (px/s)', { exact: true });
  await speed.fill('75');
  await speed.press('Tab');
  await expect(code).toContainText('personality: "chaser", speed: 75');
  await expect(overlay.locator('canvas')).toHaveCount(2);
  await speed.fill('0');
  await speed.press('Tab');
  await expect(code).toContainText('speed: 75');
  await speed.fill('');
  await speed.press('Tab');
  await expect(code).not.toContainText('speed:');
  await page.locator('#current-cats select').first().selectOption('wanderer');
  await expect(speed).toHaveAttribute('placeholder', '55');

  await page.getByLabel('Cat size (px)', { exact: true }).fill('8');
  await page.getByLabel('Cat size (px)', { exact: true }).press('Tab');
  await expect(canvas).toHaveCSS('width', '160px');
  await expect(code).toContainText('size: 160');
  expect(errors).toEqual([]);
});

test('the installation code copies the current configuration and offers a manual fallback', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('preview/');
  await page.locator('#current-cats select').first().selectOption('wanderer');
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  await expect(page.locator('#copy-status')).toHaveText('Copied!');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await page.locator('#embed-code').textContent(),
  );

  await context.clearPermissions();
  await context.grantPermissions(['clipboard-read']);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined });
  });
  await page.getByRole('button', { name: 'Copy code', exact: true }).click();
  await expect(page.locator('#copy-status')).toHaveText('Select and copy the code below.');
  expect(await page.evaluate(() => window.getSelection().toString())).toBe(
    await page.locator('#embed-code').textContent(),
  );
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

test('mobile preview remains usable and live cats respect the minimum width', async ({
  browser,
}) => {
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
  await expect(page.getByRole('button', { name: 'Play animations', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play animations', exact: true }).click();
  await expect(page.locator('#gallery .animated figcaption').first()).toContainText('Playing');
  await page.getByRole('button', { name: 'Pause animations', exact: true }).click();
  const pausedCaption = await page.locator('#gallery .animated figcaption').first().textContent();
  await page.waitForTimeout(650);
  await expect(page.locator('#gallery .animated figcaption').first()).toHaveText(pausedCaption);
  const frames = page.locator('#gallery details').first();
  await expect(frames.locator('canvas').first()).toBeHidden();
  await frames.getByText('Show all 4 frames', { exact: true }).click();
  await expect(frames.locator('canvas')).toHaveCount(4);
  await expect(frames.locator('canvas').last()).toBeVisible();
  await expect(page.locator('#cat')).toHaveValue('opale');
  await page.selectOption('#background', 'dark');
  expect(
    await page
      .locator('#gallery canvas')
      .first()
      .evaluate((canvas) => {
        return [...canvas.getContext('2d').getImageData(0, 0, 1, 1).data];
      }),
  ).toEqual([46, 54, 51, 255]);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    for (const control of await page
      .locator('select, input[type="number"], button, summary')
      .all()) {
      const box = await control.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByLabel('Minimum screen width (px)', { exact: true }).fill('768');
  await page.getByLabel('Minimum screen width (px)', { exact: true }).press('Tab');
  await expect(page.locator('[data-desktop-cats]')).toBeVisible();
  await expect(page.locator('#live-status')).toContainText('Chasers follow your cursor');
  await page.setViewportSize({ width: 767, height: 844 });
  await expect(page.locator('[data-desktop-cats]')).toBeHidden();
  await page.setViewportSize({ width: 768, height: 844 });
  await expect(page.locator('[data-desktop-cats]')).toBeVisible();
  await context.close();
});
