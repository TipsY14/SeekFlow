import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 30000, fullyParallel: true, workers: 3,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, viewport: { width: 1440, height: 1000 }, colorScheme: 'light', reducedMotion: 'reduce', trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: { command: 'node scripts/dev-server.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: true }
});
