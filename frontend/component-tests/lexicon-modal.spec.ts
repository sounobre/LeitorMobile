import { expect, test } from '@playwright/test';

const dialogName = 'Detalhes do processamento de TEST-029 Lexical Modal';

function recordApiRequests(page: import('@playwright/test').Page) {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) apiRequests.push(`${request.method()} ${url.pathname}`);
  });
  return apiRequests;
}

test('TEST-029 — renders sense-backed lexical fields through real component interaction', async ({ page }) => {
  const apiRequests = recordApiRequests(page);
  await page.goto('/component-tests/lexicon-modal.html?fixture=sense');

  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Termo para consultar' }).fill('dragon');
  await dialog.getByRole('button', { name: 'Consultar' }).click();

  await expect(page.getByTestId('lookup-calls')).toHaveText('dragon');
  await expect(dialog.getByText('dragon', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('noun · 7 ocorrências');
  await expect(dialog).toContainText('definition from sense');
  await expect(dialog).toContainText('tradução por sentido');
  await expect(dialog).toContainText('/ˈdræɡən/');
  await expect(dialog).toContainText('A2');
  await expect(dialog).toContainText('RESOLVED_LOCAL');
  await expect(dialog).toContainText('1 sentido(s) catalogado(s)');
  expect(apiRequests).toEqual([]);
});

test('TEST-029 — characterizes optional lexical fields when runtime payload omits them', async ({ page }) => {
  const apiRequests = recordApiRequests(page);
  await page.goto('/component-tests/lexicon-modal.html?fixture=optional');

  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Termo para consultar' }).fill('mystery');
  await dialog.getByRole('button', { name: 'Consultar' }).click();

  await expect(page.getByTestId('lookup-calls')).toHaveText('mystery');
  await expect(dialog.getByText('mystery', { exact: true })).toBeVisible();
  await expect(dialog).toContainText('Classe não informada · 0 ocorrências');
  await expect(dialog).toContainText('Sem definição disponível.');
  await expect(dialog).toContainText('Sem tradução disponível.');
  await expect(dialog).toContainText('IPA');
  await expect(dialog).toContainText('CEFR');
  await expect(dialog).toContainText('UNRESOLVED');
  await expect(dialog).toContainText('0 sentido(s) catalogado(s)');
  expect(apiRequests).toEqual([]);
});
