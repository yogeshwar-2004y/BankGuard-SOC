import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 90000,
  expect: { timeout: 15000 }, reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: process.env.BASE_URL || 'http://localhost:8080', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
});
