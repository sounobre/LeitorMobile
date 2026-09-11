import type { SQLiteDatabase } from 'expo-sqlite';
import { cacheLookup, getCachedLookup } from '@/db/repository';
import { normalizeLanguage } from '@/native/mlkit';

const CACHE_DAYS = 30;

type WikiPage = { pageid?: number; title?: string; extract?: string; missing?: boolean };

function sanitizeDefinition(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
    .slice(0, 8_000);
}

export async function lookupDictionary(
  db: SQLiteDatabase,
  term: string,
  language: string,
): Promise<{ definition: string; cached: boolean }> {
  const normalizedTerm = term.trim().replace(/\s+/g, ' ').slice(0, 200);
  const normalizedLanguage = normalizeLanguage(language) === 'und' ? 'pt' : normalizeLanguage(language);
  if (!normalizedTerm) throw new Error('Selecione uma palavra ou expressão.');

  const cached = await getCachedLookup(db, normalizedLanguage, normalizedTerm.toLocaleLowerCase());
  if (cached) return { definition: cached.definition, cached: true };

  const endpoint = new URL(`https://${normalizedLanguage}.wiktionary.org/w/api.php`);
  endpoint.searchParams.set('action', 'query');
  endpoint.searchParams.set('prop', 'extracts');
  endpoint.searchParams.set('exintro', '1');
  endpoint.searchParams.set('explaintext', '1');
  endpoint.searchParams.set('redirects', '1');
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('origin', '*');
  endpoint.searchParams.set('titles', normalizedTerm);

  const response = await fetch(endpoint.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('O dicionário está indisponível no momento.');
  const payload = (await response.json()) as { query?: { pages?: Record<string, WikiPage> } };
  const page = Object.values(payload.query?.pages ?? {})[0];
  const definition = sanitizeDefinition(page?.extract ?? '');
  if (!definition || page?.missing) {
    throw new Error(`Nenhuma definição foi encontrada para “${normalizedTerm}”.`);
  }

  const expiresAt = new Date(Date.now() + CACHE_DAYS * 24 * 60 * 60 * 1_000).toISOString();
  await cacheLookup(db, {
    language: normalizedLanguage,
    term: normalizedTerm.toLocaleLowerCase(),
    definition,
    expiresAt,
  });
  return { definition, cached: false };
}

export function dictionaryWebUrl(term: string, _language?: string): string {
  const normalizedTerm = term.trim().replace(/\s+/g, ' ');
  return `https://www.google.com/search?q=${encodeURIComponent(`define:"${normalizedTerm}"`)}`;
}

export function translateWebUrl(text: string, source = 'auto', target = 'pt'): string {
  return `https://translate.google.com/?sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}&text=${encodeURIComponent(text)}&op=translate`;
}

export function searchWebUrl(text: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(text.trim())}`;
}
