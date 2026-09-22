import { defineConfig } from '@playwright/test';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const componentDirectory = dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(componentDirectory, '..');
const componentUrl = 'http://127.0.0.1:4174';

export default defineConfig({
  testDir: componentDirectory,
  testMatch: 'lexicon-modal.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: componentUrl,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    cwd: frontendDirectory,
    url: `${componentUrl}/component-tests/lexicon-modal.html`,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
