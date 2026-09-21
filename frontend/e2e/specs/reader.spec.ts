import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, loginThroughUi } from '../fixtures/auth';
import type { ApiBook } from '../fixtures/api';
import { createApiClient } from '../fixtures/api';
import { createSyntheticReaderEpub } from '../fixtures/epub';

const fixturePrefix = 'wave-3d-test-023-';
const readerTitle = 'Wave 3D Reader Fixture';
const readerAuthor = 'Synthetic Reader Author';
const missingTitle = 'Wave 3D Missing File Fixture';
const chapterOne = 'WAVE3D_CHAPTER_ONE_SENTINEL';
const chapterTwo = 'WAVE3D_CHAPTER_TWO_SENTINEL';

type ProgressPatch = {
  status: number;
  lastCfi: string | null;
  progress: number | null;
};

function bookTile(page: Page, title: string) {
  return page.getByRole('heading', { name: title }).locator('xpath=ancestor::article[1]');
}

function observeProgress(page: Page, bookId: string): ProgressPatch[] {
  const patches: ProgressPatch[] = [];
  page.on('response', (response) => {
    const request = response.request();
    const pathname = new URL(response.url()).pathname;
    if (request.method() !== 'PATCH' || pathname !== '/api/books/' + bookId + '/progress') return;
    try {
      const body = JSON.parse(request.postData() ?? '{}') as { lastCfi?: string | null; progress?: number | null };
      patches.push({ status: response.status(), lastCfi: body.lastCfi ?? null, progress: body.progress ?? null });
    } catch {
      patches.push({ status: response.status(), lastCfi: null, progress: null });
    }
  });
  return patches;
}

function readerFrame(page: Page) {
  return page.frameLocator('.reader-viewer iframe');
}

async function seedUploadedReaderBook(api: ReturnType<typeof createApiClient>, token: string) {
  const epub = await createSyntheticReaderEpub(fixturePrefix);
  const book = await api.createBook(token, {
    originalName: path.basename(epub.path),
    fileHash: epub.sha256,
    title: readerTitle,
    author: readerAuthor,
    language: 'en',
  });
  const uploaded = await api.uploadBookContent(token, book.id, {
    epub: {
      name: path.basename(epub.path),
      mimeType: 'application/epub+zip',
      buffer: await fs.readFile(epub.path),
    },
  });
  return { epub, book: uploaded };
}

test.describe('TEST-023 EPUB reader, progress e restauração', () => {
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

  test('TEST-023 renderiza, persiste navegação e restaura na reabertura da mesma sessão', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    const { epub, book } = await seedUploadedReaderBook(api, session.token);
    const progressPatches = observeProgress(page, book.id);
    const directFileStatus = await api.getBookFileStatus(session.token, book.id);
    console.log('TEST-023 uploaded-file direct status=' + directFileStatus);

    try {
      expect(book.fileAvailable).toBe(true);
      await page.goto('/');
      await loginThroughUi(page, account);
      await expect(page.getByRole('heading', { name: readerTitle })).toBeVisible();

      const fileResponsePromise = page.waitForResponse((response) => {
        const request = response.request();
        return request.method() === 'GET' && new URL(response.url()).pathname === '/api/books/' + book.id + '/file';
      });
      await bookTile(page, readerTitle).click();
      const fileResponse = await fileResponsePromise;
      expect(fileResponse.status()).toBe(200);

      await expect(page.getByRole('button', { name: '← Biblioteca' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Anterior' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Próxima' })).toBeVisible();
      await expect(readerFrame(page).getByText(chapterOne, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect.poll(() => progressPatches.length, { timeout: 15_000 }).toBeGreaterThan(0);

      const initialPatch = progressPatches.find((patch) => Boolean(patch.lastCfi?.trim())) ?? progressPatches[progressPatches.length - 1];
      expect(initialPatch.status).toBe(200);
      expect(initialPatch.lastCfi?.trim()).toBeTruthy();
      expect(initialPatch.progress).toEqual(expect.any(Number));
      expect(initialPatch.progress as number).toBeGreaterThanOrEqual(0);
      expect(initialPatch.progress as number).toBeLessThanOrEqual(1);
      const cfi1 = initialPatch.lastCfi as string;

      await page.getByRole('button', { name: 'Próxima' }).click();
      await expect(readerFrame(page).getByText(chapterTwo, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect.poll(() => progressPatches.some((patch) => Boolean(patch.lastCfi?.trim()) && patch.lastCfi !== cfi1), { timeout: 15_000 }).toBe(true);

      const navigationPatch = [...progressPatches].reverse().find((patch) => Boolean(patch.lastCfi?.trim()) && patch.lastCfi !== cfi1);
      expect(navigationPatch).toBeDefined();
      expect(navigationPatch?.status).toBe(200);
      expect(navigationPatch?.lastCfi).not.toBe(cfi1);
      expect(navigationPatch?.progress).toEqual(expect.any(Number));
      expect(navigationPatch?.progress as number).toBeGreaterThanOrEqual(0);
      expect(navigationPatch?.progress as number).toBeLessThanOrEqual(1);
      const cfi2 = navigationPatch?.lastCfi as string;

      const persistedAfterNavigation = (await api.listBooks(session.token)).find((item) => item.id === book.id) as ApiBook | undefined;
      expect(persistedAfterNavigation?.lastCfi).toBe(cfi2);
      expect(persistedAfterNavigation?.progress).toEqual(expect.any(Number));
      expect(persistedAfterNavigation?.progress as number).toBeGreaterThanOrEqual(0);
      expect(persistedAfterNavigation?.progress as number).toBeLessThanOrEqual(1);

      await page.getByRole('button', { name: '← Biblioteca' }).click();
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      await expect(page.getByRole('button', { name: '← Biblioteca' })).toHaveCount(0);

      await bookTile(page, readerTitle).click();
      await expect(page.getByRole('button', { name: '← Biblioteca' })).toBeVisible();
      await expect(readerFrame(page).getByText(chapterTwo, { exact: true })).toBeVisible({ timeout: 15_000 });

      const persistedAfterReopen = (await api.listBooks(session.token)).find((item) => item.id === book.id) as ApiBook | undefined;
      expect(persistedAfterReopen?.lastCfi).toBe(cfi2);
      expect(persistedAfterReopen?.progress).toEqual(expect.any(Number));
      expect(persistedAfterReopen?.progress as number).toBeGreaterThanOrEqual(0);
      expect(persistedAfterReopen?.progress as number).toBeLessThanOrEqual(1);

      console.log('TEST-023 evidence bookId=' + book.id + ' file=200 rendered=chapter-1->chapter-2 CFI_1=nonblank CFI_2=changed persisted=changed sameSessionRestore=YES patches=' + progressPatches.length);
    } finally {
      await epub.cleanup();
    }
  });

  test('TEST-023 diagnostic reload restaura o CFI salvo do backend', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    const { epub, book } = await seedUploadedReaderBook(api, session.token);
    const progressPatches = observeProgress(page, book.id);

    try {
      await page.goto('/');
      await loginThroughUi(page, account);
      const fileResponsePromise = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/books/' + book.id + '/file');
      await bookTile(page, readerTitle).click();
      expect((await fileResponsePromise).status()).toBe(200);
      await expect(readerFrame(page).getByText(chapterOne, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect.poll(() => progressPatches.some((patch) => Boolean(patch.lastCfi?.trim())), { timeout: 15_000 }).toBe(true);
      const cfi1 = [...progressPatches].reverse().find((patch) => Boolean(patch.lastCfi?.trim()))?.lastCfi as string;

      await page.getByRole('button', { name: 'Próxima' }).click();
      await expect(readerFrame(page).getByText(chapterTwo, { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect.poll(() => progressPatches.some((patch) => Boolean(patch.lastCfi?.trim()) && patch.lastCfi !== cfi1), { timeout: 15_000 }).toBe(true);
      const cfi2 = [...progressPatches].reverse().find((patch) => Boolean(patch.lastCfi?.trim()) && patch.lastCfi !== cfi1)?.lastCfi as string;
      expect(cfi2).not.toBe(cfi1);

      await page.getByRole('button', { name: '← Biblioteca' }).click();
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      await bookTile(page, readerTitle).click();
      await expect(readerFrame(page).getByText(chapterTwo, { exact: true })).toBeVisible({ timeout: 15_000 });
      console.log('TEST-023 diagnostic reload bookId=' + book.id + ' CFI_1=nonblank CFI_2=changed reloadRestore=YES');
    } finally {
      await epub.cleanup();
    }
  });
  test('TEST-023 mostra tratamento quando o arquivo EPUB está ausente', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    const missing = await api.createBook(session.token, {
      originalName: fixturePrefix + 'missing.epub',
      fileHash: fixturePrefix + 'missing-file',
      title: missingTitle,
      author: readerAuthor,
      language: 'en',
    });

    const directFileStatus = await api.getBookFileStatus(session.token, missing.id);
    console.log('TEST-023 missing-file direct status=' + directFileStatus);

    await page.goto('/');
    await loginThroughUi(page, account);
    await expect(page.getByRole('heading', { name: missingTitle })).toBeVisible();

    const fileResponsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return request.method() === 'GET' && new URL(response.url()).pathname === '/api/books/' + missing.id + '/file';
    });
    await bookTile(page, missingTitle).click();
    const fileResponse = await fileResponsePromise;
    console.log('TEST-023 missing-file boundary direct=' + directFileStatus + ' browser=' + fileResponse.status() + ' authHeaderPresent=' + Boolean(fileResponse.request().headers().authorization));
    expect(fileResponse.status()).toBe(directFileStatus);
    expect(fileResponse.status()).toBeGreaterThanOrEqual(400);
    expect(fileResponse.status()).toBeLessThan(500);
    await expect(page.getByText('Não foi possível abrir o livro.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Voltar à biblioteca' })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar à biblioteca' }).click();
    await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
    await expect(page.getByRole('heading', { name: missingTitle })).toBeVisible();

    console.log('TEST-023 missing-file evidence bookId=' + missing.id + ' file=' + fileResponse.status() + ' uiError=YES returnToLibrary=YES');
  });
});
