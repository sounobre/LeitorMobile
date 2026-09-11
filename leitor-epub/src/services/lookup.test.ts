import { normalizeLanguage } from '@/native/mlkit';
import { dictionaryWebUrl, searchWebUrl, translateWebUrl } from './lookup';

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
