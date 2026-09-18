import { test, expect, loginThroughUi, type Page } from '../fixtures/auth';
import { createApiClient, type ApiLexiconJob } from '../fixtures/api';
import { createSyntheticEpub } from '../fixtures/epub';

const fixturePrefix = 'wave-3b-test-013-';

type ObservedResponse = { method: string; path: string; status: number };

function attachNetworkEvidence(page: Page, records: ObservedResponse[]) {
  page.on('response', (response) => {
    const url = new URL(response.url());
    const method = response.request().method();
    const path = url.pathname;
    const relevant = (method === 'POST' && (
      path === '/api/books' ||
      /^\/api\/books\/[^/]+\/content$/.test(path) ||
      /^\/api\/books\/[^/]+\/lexicon\/jobs$/.test(path)
    )) || (method === 'GET' && /^\/api\/books\/[^/]+\/lexicon\/jobs\/latest$/.test(path));
    if (relevant) records.push({ method, path, status: response.status() });
  });
}

function findResponse(records: ObservedResponse[], method: string, path: RegExp | string) {
  return records.find((record) => record.method === method && (typeof path === 'string' ? record.path === path : path.test(record.path)));
}

test.describe('TEST-013 upload web e iniciação lexical', () => {
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

  test('TEST-013 cria, envia, inicia automaticamente, conclui e disponibiliza lookup', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const session = await api.login(account);
    const fixture = await createSyntheticEpub();
    const records: ObservedResponse[] = [];

    try {
      attachNetworkEvidence(page, records);
      await page.goto('/');
      await loginThroughUi(page, account);
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      await page.getByRole('button', { name: /Adicionar livro/ }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Adicionar livro' });
      await dialog.getByLabel('Arquivo EPUB').setInputFiles(fixture.path);
      await dialog.getByLabel('Título').fill('Wave 3B Synthetic Dragon');
      await dialog.getByLabel('Autor').fill('Synthetic E2E Author');
      await dialog.getByRole('button', { name: 'Adicionar livro', exact: true }).click();

      await expect(page.getByRole('heading', { name: 'Wave 3B Synthetic Dragon' })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('status').filter({ hasText: 'Livro adicionado e processamento do léxico iniciado.' })).toBeVisible();

      const seeded = (await api.listBooks(session.token)).find((book) => book.fileHash === fixture.sha256);
      expect(seeded).toBeDefined();
      const bookId = seeded!.id;
      const createResponse = findResponse(records, 'POST', '/api/books');
      const uploadResponse = findResponse(records, 'POST', new RegExp('^/api/books/' + bookId + '/content$'));
      const startResponse = findResponse(records, 'POST', new RegExp('^/api/books/' + bookId + '/lexicon/jobs$'));
      expect(createResponse).toMatchObject({ method: 'POST', path: '/api/books', status: 201 });
      expect(uploadResponse).toMatchObject({ method: 'POST', status: 200 });
      expect(startResponse).toMatchObject({ method: 'POST', status: 202 });
      expect(records.indexOf(createResponse!)).toBeLessThan(records.indexOf(uploadResponse!));
      expect(records.indexOf(uploadResponse!)).toBeLessThan(records.indexOf(startResponse!));

      await expect.poll(
        () => records.filter((record) => record.method === 'GET' && record.path === '/api/books/' + bookId + '/lexicon/jobs/latest').length,
        { timeout: 10_000, intervals: [100, 250, 500, 1_000] },
      ).toBeGreaterThan(0);

      let terminalJob: ApiLexiconJob | null = null;
      await expect.poll(async () => {
        const latest = await api.getLexiconJob(session.token, bookId);
        if (latest && (latest.status === 'COMPLETED' || latest.status === 'FAILED')) terminalJob = latest;
        return latest?.status ?? 'MISSING';
      }, {
        timeout: 90_000,
        intervals: [250, 500, 1_000, 2_000],
        message: 'O job lexical deve chegar a COMPLETED ou FAILED sem reprocessamento manual',
      }).toMatch(/COMPLETED|FAILED/);
      expect(terminalJob?.status).toBe('COMPLETED');

      const lookup = await api.lookupBookLexicon(session.token, bookId, 'dragon');
      records.push({ method: 'GET', path: '/api/books/' + bookId + '/lexicon/lookup?term=dragon', status: lookup.status });
      expect(lookup.status).toBe(200);
      expect(lookup.body).not.toBeNull();
      expect(lookup.body).toMatchObject({
        lemma: 'dragon',
        definition: 'a mythical creature often shown as a large winged reptile',
        translationPtBr: 'dragão',
        cefr: 'A2',
      });
      console.log('TEST-013 evidence bookId=' + bookId + ' size=' + fixture.size + ' sha256=' + fixture.sha256 + ' terminal=' + terminalJob?.status + ' requests=' + JSON.stringify(records));
    } finally {
      await fixture.cleanup();
    }
  });

  test('TEST-013 caracteriza falha de início automático separada do upload', async ({ page, request, account }) => {
    const api = createApiClient(request);
    const fixture = await createSyntheticEpub();
    const records: ObservedResponse[] = [];
    const startFailureBody = 'synthetic lexicon start failure';

    try {
      attachNetworkEvidence(page, records);
      await page.route('**/api/books/*/lexicon/jobs', async (route) => {
        if (route.request().method() !== 'POST') {
          await route.continue();
          return;
        }
        await route.fulfill({ status: 503, contentType: 'text/plain', body: startFailureBody });
      });
      await page.goto('/');
      await loginThroughUi(page, account);
      await expect(page.getByRole('heading', { name: 'Livros' })).toBeVisible();
      await page.getByRole('button', { name: /Adicionar livro/ }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Adicionar livro' });
      await dialog.getByLabel('Arquivo EPUB').setInputFiles(fixture.path);
      await dialog.getByLabel('Título').fill('Wave 3B Start Failure Characterization');
      await dialog.getByLabel('Autor').fill('Synthetic E2E Author');
      await dialog.getByRole('button', { name: 'Adicionar livro', exact: true }).click();

      await expect(page.getByRole('heading', { name: 'Wave 3B Start Failure Characterization' })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole('status').filter({ hasText: 'Livro adicionado, mas o processamento não foi iniciado:' })).toContainText(startFailureBody);
      expect(findResponse(records, 'POST', '/api/books')).toMatchObject({ method: 'POST', status: 201 });
      expect(findResponse(records, 'POST', /\/api\/books\/[^/]+\/content$/)).toMatchObject({ method: 'POST', status: 200 });
      expect(findResponse(records, 'POST', /\/api\/books\/[^/]+\/lexicon\/jobs$/)).toMatchObject({ method: 'POST', status: 503 });
      console.log('TEST-013 start-failure characterization requests=' + JSON.stringify(records));
    } finally {
      await fixture.cleanup();
    }
  });
});
