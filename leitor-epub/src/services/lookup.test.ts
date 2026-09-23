import { cacheLookup, getCachedLookup } from '@/db/repository';
import { normalizeLanguage } from '@/native/mlkit';
import { dictionaryWebUrl, lookupDictionary, searchWebUrl, translateWebUrl } from './lookup';

jest.mock('@/db/repository', () => ({
  cacheLookup: jest.fn(),
  getCachedLookup: jest.fn(),
}));

const mockedCacheLookup = jest.mocked(cacheLookup);
const mockedGetCachedLookup = jest.mocked(getCachedLookup);

describe('consultas de texto', () => {
  it('normaliza tags BCP-47 para o idioma base', () => {
    expect(normalizeLanguage('pt-BR')).toBe('pt');
    expect(normalizeLanguage('EN_us')).toBe('en');
    expect(normalizeLanguage(undefined)).toBe('und');
  });

  it('codifica o texto em URLs externas', () => {
    expect(searchWebUrl('ação & reação')).toContain('a%C3%A7%C3%A3o%20%26%20rea%C3%A7%C3%A3o');
    expect(translateWebUrl('hello world')).toContain('text=hello%20world');
    expect(dictionaryWebUrl('coração', 'pt-BR')).toContain('google.com/search?q=define%3A%22cora%C3%A7%C3%A3o%22');
  });
});

describe('contrato OUT-001 da consulta local', () => {
  const db = {} as never;
  const fetchMock = jest.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetCachedLookup.mockReset();
    mockedCacheLookup.mockReset();
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('retorna cache hit sem consultar rede ou gravar novamente', async () => {
    mockedGetCachedLookup.mockResolvedValue({ language: 'pt', term: 'hello', definition: 'definição local', expiresAt: '2099-01-01T00:00:00.000Z' });

    await expect(lookupDictionary(db, ' hello ', 'pt-BR')).resolves.toEqual({ definition: 'definição local', cached: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockedCacheLookup).not.toHaveBeenCalled();
  });

  it('consulta o endpoint OUT-001, sanitiza e grava a definição', async () => {
    mockedGetCachedLookup.mockResolvedValue(null);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ query: { pages: { '1': { extract: '<b>Hello</b>   world\n\n\nnext\u0001' } } } }),
    });

    await expect(lookupDictionary(db, '  Hello   World  ', 'pt-BR')).resolves.toEqual({ definition: 'Hello world\n\nnext', cached: false });
    expect(mockedCacheLookup).toHaveBeenCalledWith(db, expect.objectContaining({
      language: 'pt',
      term: 'hello world',
      definition: 'Hello world\n\nnext',
      expiresAt: expect.any(String),
    }));
    const request = new URL(fetchMock.mock.calls[0][0] as string);
    expect(request.hostname).toBe('pt.wiktionary.org');
    expect(request.pathname).toBe('/w/api.php');
    expect(request.searchParams.get('action')).toBe('query');
    expect(request.searchParams.get('prop')).toBe('extracts');
    expect(request.searchParams.get('exintro')).toBe('1');
    expect(request.searchParams.get('explaintext')).toBe('1');
    expect(request.searchParams.get('redirects')).toBe('1');
    expect(request.searchParams.get('format')).toBe('json');
    expect(request.searchParams.get('origin')).toBe('*');
    expect(request.searchParams.get('titles')).toBe('Hello World');
  });

  it('usa idioma normalizado e fallback pt na consulta', async () => {
    mockedGetCachedLookup.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ query: { pages: { '1': { extract: 'definition' } } } }) });

    await lookupDictionary(db, 'term', 'en-US');
    expect(new URL(fetchMock.mock.calls[0][0] as string).hostname).toBe('en.wiktionary.org');

    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ query: { pages: { '1': { extract: 'definition' } } } }) });
    await lookupDictionary(db, 'term', undefined as unknown as string);
    expect(mockedGetCachedLookup).toHaveBeenLastCalledWith(db, 'pt', 'term');
  });

  it('rejeita termo vazio antes de chamar fetch', async () => {
    await expect(lookupDictionary(db, '   \t  ', 'pt-BR')).rejects.toThrow('Selecione uma palavra ou expressão.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trata resposta HTTP não-2xx sem gravar cache', async () => {
    mockedGetCachedLookup.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: false });

    await expect(lookupDictionary(db, 'term', 'pt')).rejects.toThrow('O dicionário está indisponível no momento.');
    expect(mockedCacheLookup).not.toHaveBeenCalled();
  });

  it.each([
    { query: { pages: { '1': { missing: true } } } },
    { query: { pages: { '1': { extract: '' } } } },
  ])('trata página ausente ou extract vazio como ausência', async (payload) => {
    mockedGetCachedLookup.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });

    await expect(lookupDictionary(db, 'term', 'pt')).rejects.toThrow('Nenhuma definição foi encontrada');
    expect(mockedCacheLookup).not.toHaveBeenCalled();
  });

  it('grava expiração de 30 dias a partir do relógio atual', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    mockedGetCachedLookup.mockResolvedValue(null);
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ query: { pages: { '1': { extract: 'definition' } } } }) });

    await lookupDictionary(db, 'term', 'pt');

    expect(mockedCacheLookup).toHaveBeenCalledWith(db, expect.objectContaining({ expiresAt: '2026-01-31T00:00:00.000Z' }));
  });
});
