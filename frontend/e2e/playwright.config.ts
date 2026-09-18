import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set for Wave 3A E2E`);
  return value;
}

const databasePassword = requiredEnv('TEST_DATABASE_PASSWORD');
const authEmail = requiredEnv('APP_AUTH_EMAIL');
const authPassword = requiredEnv('APP_AUTH_PASSWORD');
const backendUrl = 'http://127.0.0.1:8080';
const frontendUrl = 'http://127.0.0.1:5173';
const apiUrl = `${backendUrl}/api`;
const storageDirectory = path.resolve(process.env.E2E_STORAGE_DIRECTORY?.trim() || path.join(os.tmpdir(), 'LeitorMobile-wave-3c', String(process.pid)));
process.env.E2E_STORAGE_DIRECTORY = storageDirectory;
const configDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'artifacts/report', open: 'never' }]],
  use: {
    baseURL: frontendUrl,
    browserName: 'chromium',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    navigationTimeout: 15_000,
    actionTimeout: 10_000,
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'mvn -q spring-boot:run -Dspring-boot.run.profiles=test',
      cwd: path.resolve(configDirectory, '../../backend'),
      url: `${backendUrl}/actuator/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        SPRING_PROFILES_ACTIVE: 'test',
        TEST_DATABASE_PASSWORD: databasePassword,
        DATABASE_URL: 'jdbc:postgresql://127.0.0.1:5432/leitor_test',
        DATABASE_USERNAME: 'leitor_test_user',
        DATABASE_PASSWORD: databasePassword,
        APP_AUTH_EMAIL: authEmail,
        APP_AUTH_PASSWORD: authPassword,
        APP_AI_ENABLED: 'false',
        APP_STORAGE_DIRECTORY: storageDirectory,
        CORS_ALLOWED_ORIGINS: frontendUrl,
        PORT: '8080',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      cwd: path.resolve(configDirectory, '..'),
      url: frontendUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_API_URL: apiUrl,
      },
    },
  ],
});
