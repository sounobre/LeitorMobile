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

const searchAndCoverFixturePrefix = 'wave-3e-test-009-';

test.describe('TEST-009 pesquisa web e capas na biblioteca', () => {
  test.beforeEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await api.deleteBooksWithPrefix(session.token, searchAndCoverFixturePrefix);
  });

  test.afterEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await api.deleteBooksWithPrefix(session.token, searchAndCoverFixturePrefix);
  });

  test('TEST-009 filtra por título e autor, preserva item sem capa e mostra estado vazio', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    const bookA = await api.createBook(session.token, {
      originalName: searchAndCoverFixturePrefix + 'dragon-atlas.epub',
      fileHash: searchAndCoverFixturePrefix + 'dragon-atlas',
      title: 'Wave 3E Dragon Atlas',
      author: 'Ari Vale',
      language: 'en',
    });
    const bookB = await api.createBook(session.token, {
      originalName: searchAndCoverFixturePrefix + 'quiet-harbor.epub',
      fileHash: searchAndCoverFixturePrefix + 'quiet-harbor',
      title: 'Wave 3E Quiet Harbor',
      author: 'Mira SearchAuthor',
      language: 'en',
    });
    const bookC = await api.createBook(session.token, {
      originalName: searchAndCoverFixturePrefix + 'unrelated-chronicle.epub',
      fileHash: searchAndCoverFixturePrefix + 'unrelated-chronicle',
      title: 'Wave 3E Unrelated Chronicle',
      author: 'Elsewhere Writer',
      language: 'en',
    });

    const withCover = await api.uploadBookContent(session.token, bookA.id, {
      cover: {
        name: searchAndCoverFixturePrefix + 'dragon-atlas.jpg',
        mimeType: 'image/jpeg',
        buffer: syntheticJpeg(),
      },
    });
    expect(withCover.coverAvailable).toBe(true);

    const fixtureBooks = (await api.listBooks(session.token)).filter((book) => book.fileHash.startsWith(searchAndCoverFixturePrefix));
    expect(new Set(fixtureBooks.map((book) => book.id))).toEqual(new Set([bookA.id, bookB.id, bookC.id]));
    expect(fixtureBooks.find((book) => book.id === bookA.id)?.coverAvailable).toBe(true);
    expect(fixtureBooks.find((book) => book.id === bookB.id)?.coverAvailable).toBe(false);
    expect(fixtureBooks.find((book) => book.id === bookC.id)?.coverAvailable).toBe(false);

    const networkEvidence: Array<{ method: string; path: string; status: number }> = [];
    page.on('response', (response) => {
      const requestMethod = response.request().method();
      const url = new URL(response.url());
      const isBookList = url.pathname === '/api/books';
      const isDragonCover = url.pathname === '/api/books/' + bookA.id + '/cover';
      if (requestMethod === 'GET' && (isBookList || isDragonCover)) {
        networkEvidence.push({ method: requestMethod, path: url.pathname + url.search, status: response.status() });
      }
    });

    await page.goto('/');
    await loginThroughUi(page, account);
    await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
    await expect(page.locator('.result-count')).toHaveText('3 resultados');

    const dragonTile = page.getByRole('heading', { name: bookA.title }).locator('xpath=ancestor::article[1]');
    const harborTile = page.getByRole('heading', { name: bookB.title }).locator('xpath=ancestor::article[1]');
    const unrelatedTile = page.getByRole('heading', { name: bookC.title }).locator('xpath=ancestor::article[1]');
    await expect(dragonTile).toBeVisible();
    await expect(dragonTile.getByText('Ari Vale')).toBeVisible();
    await expect(dragonTile.getByRole('img', { name: 'Capa de Wave 3E Dragon Atlas' })).toBeVisible();
    await expect.poll(() => networkEvidence.filter((item) => item.path === '/api/books/' + bookA.id + '/cover').length).toBeGreaterThan(0);
    expect(networkEvidence.find((item) => item.path === '/api/books/' + bookA.id + '/cover')?.status).toBe(200);

    await expect(harborTile).toBeVisible();
    await expect(harborTile.getByText('Mira SearchAuthor')).toBeVisible();
    await expect(harborTile.getByRole('img')).toHaveCount(0);
    await expect(unrelatedTile).toBeVisible();
    await expect(unrelatedTile.getByText('Elsewhere Writer')).toBeVisible();

    const search = page.getByPlaceholder('Buscar por título ou autor');
    const waitForSearch = async (term: string) => {
      const responsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'GET'
          && url.pathname === '/api/books'
          && url.searchParams.get('search') === term;
      });
      await search.fill(term);
      expect((await responsePromise).status()).toBe(200);
    };

    await waitForSearch('Dragon Atlas');
    await expect(dragonTile).toBeVisible();
    await expect(harborTile).toHaveCount(0);
    await expect(unrelatedTile).toHaveCount(0);
    await expect(page.locator('.result-count')).toHaveText('1 resultados');

    await waitForSearch('Mira SearchAuthor');
    await expect(harborTile).toBeVisible();
    await expect(dragonTile).toHaveCount(0);
    await expect(unrelatedTile).toHaveCount(0);
    await expect(page.locator('.result-count')).toHaveText('1 resultados');
    await expect(harborTile.getByRole('img')).toHaveCount(0);

    await waitForSearch('mira searchauthor');
    await expect(harborTile).toBeVisible();
    await expect(page.locator('.result-count')).toHaveText('1 resultados');

    await waitForSearch('wave-3e-no-such-book');
    await expect(page.getByText('Nenhum livro encontrado')).toBeVisible();
    await expect(page.getByText('Tente outro título ou autor.')).toBeVisible();
    await expect(page.locator('.result-count')).toHaveText('0 resultados');
    await expect(page.getByRole('heading', { name: bookA.title })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: bookB.title })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: bookC.title })).toHaveCount(0);

    const clearResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'GET'
        && url.pathname === '/api/books'
        && !url.searchParams.has('search');
    });
    await search.fill('');
    expect((await clearResponsePromise).status()).toBe(200);
    await expect(dragonTile).toBeVisible();
    await expect(harborTile).toBeVisible();
    await expect(unrelatedTile).toBeVisible();
    await expect(page.locator('.result-count')).toHaveText('3 resultados');

    console.log('TEST-009 network evidence ' + JSON.stringify(networkEvidence));
  });
});
