import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect, loginThroughUi } from '../fixtures/auth';
import type { ApiBook, ApiCard } from '../fixtures/api';
import { createApiClient } from '../fixtures/api';
import type { CreateCardInput } from '../fixtures/cards-api';
import { createCardsApi } from '../fixtures/cards-api';
import { cleanupOtherOwnerFixturesByEmailPrefix, createOtherOwnerFixture, deleteOtherOwnerFixture, readOtherOwnerCard } from '../fixtures/db';

const fixturePrefix = 'wave-3h-test-039-';
type NetworkEvidence = { method: string; path: string; status: number };

type OwnFixture = {
  book: ApiBook;
  cardA: ApiCard;
  cardB: ApiCard;
  cardC: ApiCard;
  cardD: ApiCard;
};

function cardView(page: Page) {
  return page.locator('.learning-card');
}

function cardsNav(page: Page) {
  return page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: /Cards/ });
}

function observeCardNetwork(page: Page) {
  const evidence: NetworkEvidence[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/cards')) {
      evidence.push({ method: response.request().method(), path: url.pathname + url.search, status: response.status() });
    }
  });
  return evidence;
}

async function createOwnFixture(api: ReturnType<typeof createApiClient>, cardsApi: ReturnType<typeof createCardsApi>, token: string): Promise<OwnFixture> {
  const book = await api.createBook(token, {
    originalName: `${fixturePrefix}book.epub`,
    fileHash: `${fixturePrefix}${randomUUID()}`,
    title: 'Wave 3H Cards Lifecycle',
    author: 'Wave 3H Test',
    language: 'en',
  });
  const create = (input: Omit<CreateCardInput, 'bookId'>) => cardsApi.createCard(token, { ...input, bookId: book.id });
  const cardA = await create({ cfiRange: 'epubcfi(/6/2)', selectedText: 'wave-3h-alpha', translation: 'alpha traduzido', definition: 'alpha definition' });
  const cardB = await create({ cfiRange: 'epubcfi(/6/4)', selectedText: 'wave-3h-beta', translation: 'beta traduzido', definition: 'beta definition' });
  const cardC = await create({ cfiRange: 'epubcfi(/6/6)', selectedText: 'wave-3h-gamma', translation: 'gamma traduzido', definition: 'gamma definition' });
  const cardD = await create({ cfiRange: 'epubcfi(/6/8)', selectedText: 'wave-3h-archived' });
  const archived = await cardsApi.archiveCard(token, cardD.id);
  expect(archived.archived).toBe(true);
  return { book, cardA, cardB, cardC, cardD };
}

async function cleanupOwnFixture(api: ReturnType<typeof createApiClient>, cardsApi: ReturnType<typeof createCardsApi>, token: string) {
  const books = await api.listBooks(token);
  const fixtureBooks = books.filter((book) => book.fileHash.startsWith(fixturePrefix) || book.originalName.startsWith(fixturePrefix));
  const fixtureBookIds = new Set(fixtureBooks.map((book) => book.id));
  await api.deleteBooksWithPrefix(token, fixturePrefix);
  const remainingCards = await cardsApi.listCards(token, true);
  expect(remainingCards.some((card) => fixtureBookIds.has(card.bookId))).toBe(false);
}

const validUpdate = (selectedText: string) => ({
  selectedText,
  translation: 'attempt translation',
  definition: 'attempt definition',
  pronunciation: '',
  partOfSpeech: '',
  background: '',
  examples: [],
  relatedWords: [],
});

function expectNoCardPayload(body: string) {
  expect(body).not.toContain('wave-3h-other-owner-card');
  expect(body).not.toContain('Wave 3H Other Owner Book');
}

test.describe('TEST-039 ciclo web de cards', () => {
  test.beforeEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const cardsApi = createCardsApi(request);
    const session = await api.login(account);
    await cleanupOwnFixture(api, cardsApi, session.token);
    await cleanupOtherOwnerFixturesByEmailPrefix();
  });

  test.afterEach(async ({ request, account }) => {
    const api = createApiClient(request);
    const cardsApi = createCardsApi(request);
    const session = await api.login(account);
    await cleanupOwnFixture(api, cardsApi, session.token);
    await cleanupOtherOwnerFixturesByEmailPrefix();
  });

  test('TEST-039 lista, edita, arquiva e move cards com persistência após recarga', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const cardsApi = createCardsApi(request);
    const session = await api.login(account);
    const fixture = await createOwnFixture(api, cardsApi, session.token);
    const evidence = observeCardNetwork(page);

    const activeBefore = await cardsApi.listCards(session.token, false);
    const allBefore = await cardsApi.listCards(session.token, true);
    expect(activeBefore).toHaveLength(3);
    expect(activeBefore.map((card) => card.id)).toEqual(expect.arrayContaining([fixture.cardA.id, fixture.cardB.id, fixture.cardC.id]));
    expect(activeBefore.some((card) => card.id === fixture.cardD.id)).toBe(false);
    expect(allBefore).toHaveLength(4);
    expect(allBefore.find((card) => card.id === fixture.cardD.id)?.archived).toBe(true);
    expect(activeBefore[0].id).toBe(fixture.cardA.id);

    try {
      await page.goto('/');
      await loginThroughUi(page, account);
      const initialList = page.waitForResponse((response) => response.request().method() === 'GET'
        && new URL(response.url()).pathname === '/api/cards'
        && new URL(response.url()).searchParams.get('includeArchived') === 'false');
      await cardsNav(page).click();
      expect((await initialList).status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Cards de estudo' })).toBeVisible();
      await expect(page.getByRole('heading', { name: '3 na fila' })).toBeVisible();
      const view = cardView(page);
      await expect(view.locator('strong')).toHaveText('wave-3h-alpha');
      await expect(view).not.toContainText('wave-3h-archived');

      await page.getByRole('button', { name: 'Virar card' }).click();
      await expect(view.locator('strong')).toHaveText('alpha traduzido');
      await expect(view.getByText('alpha definition', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Virar card' }).click();

      await page.getByRole('button', { name: 'Editar' }).click();
      const dialog = page.getByRole('dialog', { name: 'Editar card' });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel('Texto selecionado').fill('wave-3h-alpha-edited');
      await dialog.getByLabel('Tradução').fill('alpha editado');
      await dialog.getByLabel('Definição').fill('alpha edited definition');
      const editResponse = page.waitForResponse((response) => response.request().method() === 'PATCH'
        && new URL(response.url()).pathname === `/api/cards/${fixture.cardA.id}`);
      await dialog.getByRole('button', { name: 'Salvar alterações' }).click();
      expect((await editResponse).status()).toBe(200);
      await expect(dialog).toHaveCount(0);
      await expect(view.locator('strong')).toHaveText('wave-3h-alpha-edited');
      await page.getByRole('button', { name: 'Virar card' }).click();
      await expect(view.locator('strong')).toHaveText('alpha editado');
      await expect(view.getByText('alpha edited definition', { exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Virar card' }).click();

      const edited = (await cardsApi.listCards(session.token, true)).find((card) => card.id === fixture.cardA.id);
      expect(edited).toMatchObject({ selectedText: 'wave-3h-alpha-edited', translation: 'alpha editado', definition: 'alpha edited definition', archived: false });

      await page.getByRole('button', { name: /Biblioteca/ }).click();
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      const afterEditReload = page.waitForResponse((response) => response.request().method() === 'GET'
        && new URL(response.url()).pathname === '/api/cards'
        && new URL(response.url()).searchParams.get('includeArchived') === 'false');
      await cardsNav(page).click();
      expect((await afterEditReload).status()).toBe(200);
      await expect(cardView(page).locator('strong')).toHaveText('wave-3h-alpha-edited');

      const archiveResponse = page.waitForResponse((response) => response.request().method() === 'POST'
        && new URL(response.url()).pathname === `/api/cards/${fixture.cardA.id}/archive`);
      await page.getByRole('button', { name: 'Arquivar' }).click();
      expect((await archiveResponse).status()).toBe(200);
      await expect(page.getByRole('heading', { name: '2 na fila' })).toBeVisible();
      await expect(cardView(page).locator('strong')).toHaveText('wave-3h-beta');

      const activeAfterArchive = await cardsApi.listCards(session.token, false);
      const allAfterArchive = await cardsApi.listCards(session.token, true);
      expect(activeAfterArchive.some((card) => card.id === fixture.cardA.id)).toBe(false);
      expect(allAfterArchive.find((card) => card.id === fixture.cardA.id)?.archived).toBe(true);

      await page.getByRole('button', { name: /Biblioteca/ }).click();
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      const afterArchiveReload = page.waitForResponse((response) => response.request().method() === 'GET'
        && new URL(response.url()).pathname === '/api/cards'
        && new URL(response.url()).searchParams.get('includeArchived') === 'false');
      await cardsNav(page).click();
      expect((await afterArchiveReload).status()).toBe(200);
      await expect(page.getByRole('heading', { name: '2 na fila' })).toBeVisible();
      await expect(cardView(page).locator('strong')).toHaveText('wave-3h-beta');

      const moveResponse = page.waitForResponse((response) => response.request().method() === 'POST'
        && new URL(response.url()).pathname === `/api/cards/${fixture.cardB.id}/move-to-end`);
      await page.getByRole('button', { name: 'Rever depois' }).click();
      expect((await moveResponse).status()).toBe(200);
      await expect(cardView(page).locator('strong')).toHaveText('wave-3h-gamma');

      const afterMove = await cardsApi.listCards(session.token, false);
      expect(afterMove.findIndex((card) => card.id === fixture.cardC.id)).toBeLessThan(afterMove.findIndex((card) => card.id === fixture.cardB.id));

      await page.getByRole('button', { name: /Biblioteca/ }).click();
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      const afterMoveReload = page.waitForResponse((response) => response.request().method() === 'GET'
        && new URL(response.url()).pathname === '/api/cards'
        && new URL(response.url()).searchParams.get('includeArchived') === 'false');
      await cardsNav(page).click();
      expect((await afterMoveReload).status()).toBe(200);
      await expect(cardView(page).locator('strong')).toHaveText('wave-3h-gamma');
      const afterReload = await cardsApi.listCards(session.token, false);
      expect(afterReload.findIndex((card) => card.id === fixture.cardC.id)).toBeLessThan(afterReload.findIndex((card) => card.id === fixture.cardB.id));

      console.log('TEST-039 UI evidence ' + JSON.stringify({ initial: 'wave-3h-alpha / 3 na fila', afterEdit: 'wave-3h-alpha-edited', afterArchive: 'wave-3h-beta / 2 na fila', afterMove: 'wave-3h-gamma', afterReload: 'wave-3h-gamma' }));
    } finally {
      console.log('TEST-039 network evidence ' + JSON.stringify(evidence));
    }
  });

  test('TEST-039 rejeita card ausente e isola card de outro owner', async ({ request, account }) => {
    const api = createApiClient(request);
    const cardsApi = createCardsApi(request);
    const session = await api.login(account);
    const otherOwner = await createOtherOwnerFixture();
    const evidence: NetworkEvidence[] = [];
    try {
      const listed = await cardsApi.listCardsRaw(session.token, true);
      evidence.push({ method: 'GET', path: '/api/cards?includeArchived=true', status: listed.status });
      expect(listed.status).toBe(200);
      expect(listed.body?.some((card) => card.id === otherOwner.cardId || card.selectedText === 'wave-3h-other-owner-card')).toBe(false);

      const missingCardId = randomUUID();
      const missing = await cardsApi.patchCardRaw(session.token, missingCardId, validUpdate('wave-3h-missing-attempt'));
      evidence.push({ method: 'PATCH', path: `/api/cards/${missingCardId}`, status: missing.status });
      expect(missing.status).toBe(404);
      expectNoCardPayload(missing.body);

      const crossOwner = await cardsApi.patchCardRaw(session.token, otherOwner.cardId, validUpdate('wave-3h-cross-owner-attempt'));
      evidence.push({ method: 'PATCH', path: `/api/cards/${otherOwner.cardId}`, status: crossOwner.status });
      expect(crossOwner.status).toBe(404);
      expectNoCardPayload(crossOwner.body);

      const unchanged = await readOtherOwnerCard(otherOwner.cardId);
      expect(unchanged).toEqual({ id: otherOwner.cardId, selectedText: 'wave-3h-other-owner-card' });
    } finally {
      await deleteOtherOwnerFixture(otherOwner.ownerId);
      expect(await readOtherOwnerCard(otherOwner.cardId)).toBeNull();
      console.log('TEST-039 negative network evidence ' + JSON.stringify(evidence));
    }
  });
});
