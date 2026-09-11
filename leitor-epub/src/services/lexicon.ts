import type { SQLiteDatabase } from 'expo-sqlite';
import { getLexiconEntry, upsertLexiconEntries } from '@/db/repository';
import type { LexiconEntry } from '@/types/lexicon';

export type CardLexiconFields = {
  translation: string;
  pronunciation: string;
  partOfSpeech: string;
  definition: string;
};

export function lexiconLookupTerm(selectedText: string): string {
  return selectedText.trim();
}

function firstNonBlank(...values: (string | null | undefined)[]): string {
  return values.find((value) => Boolean(value?.trim()))?.trim() ?? '';
}

export function cardFieldsFromLexicon(entry: LexiconEntry | null): CardLexiconFields {
  return {
    translation: firstNonBlank(
      entry?.translationPtBr,
      ...(entry?.senses ?? []).map((sense) => sense.translationPtBr),
    ),
    pronunciation: entry?.ipa?.trim() ?? '',
    partOfSpeech: entry?.partOfSpeech?.trim() ?? '',
    definition: firstNonBlank(
      entry?.definition,
      ...(entry?.senses ?? []).map((sense) => sense.definition),
    ),
  };
}

export async function lookupPreparedLexicon(
  db: SQLiteDatabase,
  bookId: string,
  selectedText: string,
): Promise<LexiconEntry | null> {
  const term = lexiconLookupTerm(selectedText);
  if (!term) return null;
  return getLexiconEntry(db, bookId, term);
}

export async function cacheRemoteLexicon(
  db: SQLiteDatabase,
  bookId: string,
  entries: LexiconEntry[],
): Promise<void> {
  await upsertLexiconEntries(db, bookId, entries);
}
