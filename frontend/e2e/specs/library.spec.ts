import { promises as fs } from 'node:fs';
import path from 'node:path';
import { test, expect, loginThroughUi, readAuthStorage } from '../fixtures/auth';
import { createApiClient } from '../fixtures/api';
import { createSyntheticEpub } from '../fixtures/epub';
import { e2eStorageDirectory, ensureStorageParent, fileExists, managedBookPath, managedCoverPath, removeIfPresent, syntheticJpeg, syntheticPng } from '../fixtures/storage';

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

const deletionFixturePrefix = 'wave-3c-test-020-';

test.describe('TEST-020 exclusão web remove livro e conteúdo gerenciado', () => {
  test.beforeEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await api.deleteBooksWithPrefix(session.token, deletionFixturePrefix);
  });

  test.afterEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await api.deleteBooksWithPrefix(session.token, deletionFixturePrefix);
  });

  test('TEST-020 exclui pela UI, remove o registro e limpa o storage gerenciado', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    const epub = await createSyntheticEpub(deletionFixturePrefix);
    const title = 'Wave 3C Deletion Fixture';
    const author = 'Synthetic Deletion Author';
    const storageDirectory = e2eStorageDirectory();
    const sentinelPath = path.join(storageDirectory, 'covers', 'wave-3c-unrelated-sentinel.png');
    let bookId = '';
    let deleteStatus = 0;

    try {
      const created = await api.createBook(session.token, {
        originalName: path.basename(epub.path),
        fileHash: epub.sha256,
        title,
        author,
        language: 'en',
      });
      bookId = created.id;

      await api.uploadBookContent(session.token, bookId, {
        epub: {
          name: path.basename(epub.path),
          mimeType: 'application/epub+zip',
          buffer: await fs.readFile(epub.path),
        },
        cover: {
          name: deletionFixturePrefix + 'cover.jpg',
          mimeType: 'image/jpeg',
          buffer: syntheticJpeg(),
        },
      });

      const epubPath = managedBookPath(bookId);
      const jpgPath = managedCoverPath(bookId, '.jpg');
      const stalePngPath = managedCoverPath(bookId, '.png');
      await ensureStorageParent(stalePngPath);
      await fs.writeFile(stalePngPath, syntheticPng());
      await ensureStorageParent(sentinelPath);
      await fs.writeFile(sentinelPath, syntheticPng());

      expect(await fileExists(epubPath)).toBe(true);
      expect(await fileExists(jpgPath)).toBe(true);
      expect(await fileExists(stalePngPath)).toBe(true);
      expect(await fileExists(sentinelPath)).toBe(true);
      expect((await api.listBooks(session.token)).some((book) => book.id === bookId)).toBe(true);

      await page.goto('/');
      await loginThroughUi(page, account);
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await expect(page.getByText(author)).toBeVisible();
      const bookTile = page.getByRole('heading', { name: title }).locator('xpath=ancestor::article[1]');
      await expect(bookTile.getByRole('img', { name: 'Capa de ' + title })).toBeVisible();

      const deleteResponsePromise = page.waitForResponse((response) => {
        const request = response.request();
        return request.method() === 'DELETE' && new URL(response.url()).pathname === '/api/books/' + bookId;
      });
      const dialogPromise = page.waitForEvent('dialog');
      await bookTile.getByRole('button', { name: 'Opcoes do livro' }).click();
      const menuItemClickPromise = bookTile.getByRole('menuitem', { name: 'Excluir livro' }).click();
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
      await menuItemClickPromise;

      const deleteResponse = await deleteResponsePromise;
      deleteStatus = deleteResponse.status();
      expect(deleteStatus).toBe(204);
      await expect(page.getByRole('heading', { name: title })).toHaveCount(0);
      await expect(page.getByText('Sua biblioteca está vazia')).toBeVisible();

      const remainingBooks = await api.listBooks(session.token);
      expect(remainingBooks.some((book) => book.id === bookId)).toBe(false);
      expect(await fileExists(epubPath)).toBe(false);
      expect(await fileExists(jpgPath)).toBe(false);
      expect(await fileExists(stalePngPath)).toBe(false);
      expect(await fileExists(sentinelPath)).toBe(true);

      console.log('TEST-020 evidence bookId=' + bookId + ' storage=' + storageDirectory + ' delete=DELETE /api/books/' + bookId + ' status=' + deleteStatus + ' filesBefore=epub,jpg,stale-png,sentinel filesAfter=none,none,none,sentinel');
    } finally {
      await removeIfPresent(managedBookPath(bookId));
      await removeIfPresent(managedCoverPath(bookId, '.jpg'));
      await removeIfPresent(managedCoverPath(bookId, '.png'));
      await removeIfPresent(sentinelPath);
      await epub.cleanup();
    }
  });
});
