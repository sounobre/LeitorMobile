import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, loginThroughUi } from '../fixtures/auth';
import type { ApiBook, ApiCard, ApiLexiconEntry } from '../fixtures/api';
import { createApiClient } from '../fixtures/api';
import { createSyntheticLexicalEpub } from '../fixtures/epub';
import { selectReaderText } from '../fixtures/reader';

const foundTerm = 'dragon';
const missingPhrase = 'silver moonspire';
const chapterText = 'The dragon crossed the silver moonspire.';
const lexicalTitle = 'Wave 3F Lexical Selection Fixture';
const lexicalAuthor = 'Synthetic Lexical Author';

type NetworkEvidence = { method: string; path: string; status: number };

type PreparedBook = {
  epub: { cleanup: () => Promise<void> };
  book: ApiBook;
  foundEntry: ApiLexiconEntry;
};

function readerFrame(page: Page) {
  return page.frameLocator('.reader-viewer iframe');
}

function bookTile(page: Page, title: string) {
  return page.getByRole('heading', { name: title }).locator('xpath=ancestor::article[1]');
}

function observeNetwork(page: Page, bookId: string) {
  const evidence: NetworkEvidence[] = [];
  page.on('response', (response) => {
    const request = response.request();
    const url = new URL(response.url());
    const relevant = url.pathname === '/api/books/' + bookId + '/file'
      || url.pathname === '/api/books/' + bookId + '/lexicon/lookup'
      || url.pathname === '/api/books/' + bookId + '/lexicon/jobs'
      || url.pathname === '/api/cards';
    if (relevant) evidence.push({ method: request.method(), path: url.pathname + url.search, status: response.status() });
  });
  return evidence;
}

async function prepareLexicalBook(api: ReturnType<typeof createApiClient>, token: string, prefix: string): Promise<PreparedBook> {
  const epub = await createSyntheticLexicalEpub(prefix);
  try {
    const created = await api.createBook(token, {
      originalName: path.basename(epub.path),
      fileHash: epub.sha256,
      title: lexicalTitle,
      author: lexicalAuthor,
      language: 'en',
    });
    const book = await api.uploadBookContent(token, created.id, {
      epub: {
        name: path.basename(epub.path),
        mimeType: 'application/epub+zip',
        buffer: await fs.readFile(epub.path),
      },
    });
    expect(book.fileAvailable).toBe(true);
    expect(await api.getBookFileStatus(token, book.id)).toBe(200);
    await api.startLexiconJob(token, book.id);

    let latestJob = null as Awaited<ReturnType<typeof api.getLexiconJob>>;
    await expect.poll(async () => {
      latestJob = await api.getLexiconJob(token, book.id);
      return latestJob?.status ?? 'MISSING';
    }, { timeout: 30_000 }).toMatch(/COMPLETED|FAILED/);
    if (latestJob?.status !== 'COMPLETED') throw new Error('Lexical job failed: ' + (latestJob?.errorMessage ?? 'unknown error'));

    const found = await api.lookupBookLexicon(token, book.id, foundTerm);
    expect(found.status).toBe(200);
    expect(found.body).not.toBeNull();
    expect(found.body?.lemma).toBe(foundTerm);
    expect(found.body?.translationPtBr).toBe('dragão');
    expect(found.body?.definition.trim()).toBeTruthy();

    const missing = await api.lookupBookLexicon(token, book.id, missingPhrase);
    expect(missing.status).toBe(200);
    expect(missing.body).toBeNull();

    return { epub, book, foundEntry: found.body as ApiLexiconEntry };
  } catch (cause) {
    await epub.cleanup();
    throw cause;
  }
}
async function openReader(page: Page, account: { email: string; password: string }, book: ApiBook) {
  await page.goto('/');
  await loginThroughUi(page, account);
  await expect(bookTile(page, book.title)).toBeVisible();
  const fileResponsePromise = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/books/' + book.id + '/file');
  await bookTile(page, book.title).click();
  expect((await fileResponsePromise).status()).toBe(200);
  await expect(readerFrame(page).getByText(chapterText, { exact: true })).toBeVisible({ timeout: 15_000 });
}

async function cleanupFixture(api: ReturnType<typeof createApiClient>, token: string, prefix: string) {
  const fixtureBooks = (await api.listBooks(token)).filter((book) => book.fileHash.startsWith(prefix) || book.originalName.startsWith(prefix));
  const fixtureBookIds = new Set(fixtureBooks.map((book) => book.id));
  await api.deleteBooksWithPrefix(token, prefix);
  expect((await api.listBooks(token)).filter((book) => book.fileHash.startsWith(prefix) || book.originalName.startsWith(prefix))).toHaveLength(0);
  const remainingCards = await api.listCards(token, true);
  expect(remainingCards.some((card) => fixtureBookIds.has(card.bookId))).toBe(false);
}

test.describe('TEST-027 seleção lexical web', () => {
  const fixturePrefix = 'wave-3f-test-027-';

  test.beforeEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await cleanupFixture(api, session.token, fixturePrefix);
  });

  test.afterEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await cleanupFixture(api, session.token, fixturePrefix);
  });

  test('TEST-027 seleciona termos encontrados e ausentes sem inventar conteúdo', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    const prepared = await prepareLexicalBook(api, session.token, fixturePrefix);
    const evidence = observeNetwork(page, prepared.book.id);
    try {
      await openReader(page, account, prepared.book);

      await selectReaderText(page, foundTerm);
      const foundToolbar = page.getByRole('toolbar', { name: 'Ações para o texto selecionado' });
      await expect(foundToolbar).toBeVisible();
      await expect(foundToolbar.getByText(foundTerm, { exact: true })).toBeVisible();
      await expect(foundToolbar.getByRole('button', { name: 'Local dictionary' })).toBeVisible();
      await expect(foundToolbar.getByRole('button', { name: 'Criar card' })).toBeVisible();
      await expect(foundToolbar.getByRole('button', { name: 'Fechar ações' })).toBeVisible();

      const foundLookupPromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'GET'
          && url.pathname === '/api/books/' + prepared.book.id + '/lexicon/lookup'
          && url.searchParams.get('term') === foundTerm;
      });
      await foundToolbar.getByRole('button', { name: 'Local dictionary' }).click();
      expect((await foundLookupPromise).status()).toBe(200);
      await expect(page.getByRole('status')).toContainText(foundTerm + ': ' + prepared.foundEntry.translationPtBr);
      await expect(page.getByRole('status')).toContainText('dragão');

      await foundToolbar.getByRole('button', { name: 'Fechar ações' }).click();
      await expect(foundToolbar).toHaveCount(0);

      await selectReaderText(page, missingPhrase);
      const missingToolbar = page.getByRole('toolbar', { name: 'Ações para o texto selecionado' });
      await expect(missingToolbar).toBeVisible();
      await expect(missingToolbar.getByText(missingPhrase, { exact: true })).toBeVisible();
      const missingLookupPromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'GET'
          && url.pathname === '/api/books/' + prepared.book.id + '/lexicon/lookup'
          && url.searchParams.get('term') === missingPhrase;
      });
      await missingToolbar.getByRole('button', { name: 'Local dictionary' }).click();
      expect((await missingLookupPromise).status()).toBe(200);
      const missingStatus = page.getByRole('status').filter({ hasText: 'No definition is prepared for this selection yet.' });
      await expect(missingStatus).toBeVisible();
      await expect(missingStatus).toHaveText('No definition is prepared for this selection yet.');
      await expect(missingStatus).not.toContainText('dragão');
      await missingToolbar.getByRole('button', { name: 'Fechar ações' }).click();
      await expect(missingToolbar).toHaveCount(0);

    } finally {
      console.log('TEST-027 network evidence ' + JSON.stringify(evidence));
      await prepared.epub.cleanup();
    }
  });
});

test.describe('TEST-028 criação de card lexical web', () => {
  const fixturePrefix = 'wave-3f-test-028-';

  test.beforeEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await cleanupFixture(api, session.token, fixturePrefix);
  });

  test.afterEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    await cleanupFixture(api, session.token, fixturePrefix);
  });

  test('TEST-028 cria, persiste e apresenta card criado pela UI', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    const prepared = await prepareLexicalBook(api, session.token, fixturePrefix);
    const evidence = observeNetwork(page, prepared.book.id);
    try {
      await openReader(page, account, prepared.book);
      await selectReaderText(page, foundTerm);
      const toolbar = page.getByRole('toolbar', { name: 'Ações para o texto selecionado' });
      await expect(toolbar).toBeVisible();
      await expect(toolbar.getByText(foundTerm, { exact: true })).toBeVisible();

      const lookupResponsePromise = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return response.request().method() === 'GET'
          && url.pathname === '/api/books/' + prepared.book.id + '/lexicon/lookup'
          && url.searchParams.get('term') === foundTerm;
      });
      await toolbar.getByRole('button', { name: 'Local dictionary' }).click();
      expect((await lookupResponsePromise).status()).toBe(200);
      await expect(page.getByRole('status')).toContainText(foundTerm + ': ' + prepared.foundEntry.translationPtBr);

      const cardResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/cards');
      await toolbar.getByRole('button', { name: 'Criar card' }).click();
      const cardResponse = await cardResponsePromise;
      expect(cardResponse.status()).toBe(201);
      const payload = cardResponse.request().postDataJSON() as Record<string, unknown>;
      const createdCard = (await cardResponse.json()) as ApiCard;
      expect(payload.bookId).toBe(prepared.book.id);
      expect(payload.selectedText).toBe(foundTerm);
      expect(String(payload.cfiRange).trim()).toBeTruthy();
      expect(String(payload.chapterTitle).trim()).toBeTruthy();
      expect(payload.translation).toBe(prepared.foundEntry.translationPtBr);
      expect(payload.definition).toBe(prepared.foundEntry.definition);
      expect(payload.pronunciation).toBe(prepared.foundEntry.ipa);
      expect(payload.partOfSpeech).toBe(prepared.foundEntry.partOfSpeech ?? '');
      expect(payload.background).toBe('');
      expect(payload.examples).toEqual([]);
      expect(payload.relatedWords).toEqual([]);
      expect(createdCard.id).toBeTruthy();
      expect(createdCard.bookId).toBe(prepared.book.id);
      expect(createdCard.selectedText).toBe(foundTerm);
      expect(createdCard.cfiRange).toBe(payload.cfiRange);
      expect(createdCard.chapterTitle.trim()).toBeTruthy();

      await expect(toolbar).toHaveCount(0);
      await expect(page.getByRole('status')).toContainText('Card criado com os dados do dicionário local.');
      const persisted = await api.listCards(session.token);
      const persistedCard = persisted.find((card) => card.id === createdCard.id);
      expect(persistedCard).toBeDefined();
      expect(persistedCard?.bookId).toBe(prepared.book.id);
      expect(persistedCard?.selectedText).toBe(foundTerm);
      expect(persistedCard?.archived).toBe(false);

      await page.getByRole('button', { name: '← Biblioteca' }).click();
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      await page.getByRole('button', { name: /Cards/ }).click();
      await expect(page.getByRole('heading', { name: 'Cards de estudo' })).toBeVisible();
      const cardView = page.locator('.learning-card');
      await expect(cardView.getByText(foundTerm, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Virar card' }).click();
      await expect(cardView.getByText(prepared.foundEntry.translationPtBr, { exact: true })).toBeVisible();
      await expect(cardView.getByText(prepared.foundEntry.definition, { exact: true })).toBeVisible();

      console.log('TEST-028 network evidence ' + JSON.stringify(evidence));
      console.log('TEST-028 payload evidence bookId=' + payload.bookId + ' selectedText=' + payload.selectedText + ' cfiRange=NONBLANK chapterTitle=NONBLANK translation=' + payload.translation + ' definition=RESPONSE pronunciation=RESPONSE partOfSpeech=RESPONSE background=EMPTY examples=EMPTY relatedWords=EMPTY cardId=' + createdCard.id);
    } finally {
      await prepared.epub.cleanup();
    }
  });
});
