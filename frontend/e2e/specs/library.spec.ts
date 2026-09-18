import { test, expect, loginThroughUi, readAuthStorage } from '../fixtures/auth';
import { createApiClient } from '../fixtures/api';

const fixturePrefix = 'wave-3a-test-001-';

test.describe('TEST-001 login, sessão web e biblioteca', () => {
  test.beforeEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await api.deleteBooksWithPrefix(session.token, fixturePrefix);
  });

  test.afterEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await api.deleteBooksWithPrefix(session.token, fixturePrefix);
  });

  test('TEST-001 login persists the session, loads an empty library, and logout clears it', async ({ page, account }) => {
    const observedRequests = new Set<string>();
    page.on('request', (request) => {
      const url = new URL(request.url());
      const relevantPaths = ['/api/auth/login', '/api/auth/me', '/api/books'];
      if (relevantPaths.includes(url.pathname)) observedRequests.add(`${request.method()} ${url.pathname}`);
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Continue sua leitura.' })).toBeVisible();
    await loginThroughUi(page, account);

    const storedAfterLogin = await readAuthStorage(page);
    expect(storedAfterLogin.token).toBeTruthy();
    expect(storedAfterLogin.user).toBeTruthy();
    expect(JSON.parse(storedAfterLogin.user ?? '{}').email).toBe(account.email);
    await expect(page.getByText('Sua biblioteca está vazia')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Continue sua leitura.' })).toHaveCount(0);
    await expect(page.getByText('Sua biblioteca está vazia')).toBeVisible();

    expect([...observedRequests]).toEqual(expect.arrayContaining([
      'POST /api/auth/login',
      'GET /api/auth/me',
      'GET /api/books',
    ]));

    await page.getByRole('button', { name: `Sair · ${account.email}` }).click();
    await expect(page.getByRole('heading', { name: 'Continue sua leitura.' })).toBeVisible();
    const storedAfterLogout = await readAuthStorage(page);
    expect(storedAfterLogout.token).toBeNull();
    expect(storedAfterLogout.user).toBeNull();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Continue sua leitura.' })).toBeVisible();
  });

  test('TEST-001 displays a book seeded for the authenticated owner', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await api.createBook(session.token, {
      originalName: 'wave-3a-library.epub',
      fileHash: `${fixturePrefix}library`,
      title: 'Wave 3A Library Book',
      author: 'Synthetic E2E Author',
      language: 'pt-BR',
    });

    await page.goto('/');
    await loginThroughUi(page, account);
    await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wave 3A Library Book' })).toBeVisible();
    await expect(page.getByText('Synthetic E2E Author')).toBeVisible();
    await expect(page.getByText('1 livro')).toBeVisible();
  });

  test('TEST-001 keeps an invalid login on the login view without storing a session', async ({ page, account }) => {
    await page.goto('/');
    await page.getByLabel('E-mail').fill(account.email);
    await page.getByLabel('Senha').fill(`${account.password}-invalid`);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Continue sua leitura.' })).toBeVisible();
    const storedAfterInvalidLogin = await readAuthStorage(page);
    expect(storedAfterInvalidLogin.token).toBeNull();
    expect(storedAfterInvalidLogin.user).toBeNull();
  });
});
