import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173/mashajs/',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: [
    {
      command: 'npm run serve',
      env: { PORT: '4173', BASE_PATH: '/mashajs' },
      url: 'http://127.0.0.1:4173/mashajs/',
    },
    {
      command: 'node tests/serve-host.mjs',
      url: 'http://127.0.0.1:4174/nested/page',
    },
  ],
});
