import { expect, test as base, type Page } from '@playwright/test';

export type TestAccount = {
  email: string;
  password: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be set for Wave 3A E2E`);
  return value;
}

export const test = base.extend<{ account: TestAccount }>({
  account: async ({}, use) => {
    await use({
      email: requiredEnv('APP_AUTH_EMAIL'),
      password: requiredEnv('APP_AUTH_PASSWORD'),
    });
  },
});

export { expect };

export async function loginThroughUi(page: Page, account: TestAccount) {
  await page.getByLabel('E-mail').fill(account.email);
  await page.getByLabel('Senha').fill(account.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
}

export async function readAuthStorage(page: Page) {
  return page.evaluate(() => ({
    token: window.localStorage.getItem('leitor.auth.token'),
    user: window.localStorage.getItem('leitor.auth.user'),
  }));
}
