import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  AnnotationRecord,
  Book,
  BookmarkRecord,
  CardRecord,
  LibrarySnapshot,
  LookupCacheRecord,
  ReaderPreferences,
  LexiconEntry,
} from '@/types/domain';
import { DEFAULT_READER_PREFERENCES } from '@/types/domain';

type BookRow = {
  id: string;
  file_uri: string;
  file_hash: string;
  original_name: string;
  title: string;
  author: string;
  language: string;
  cover_uri: string | null;
  description: string;
  publisher: string;
  imported_at: string;
  last_opened_at: string | null;
  last_cfi: string | null;
  progress: number;
  locations_json: string | null;
};

type AnnotationRow = {
  id: string;
  book_id: string;
  cfi_range: string;
  selected_text: string;
  color: string;
  note: string | null;
  section_index: number;
  created_at: string;
  updated_at: string;
};

type BookmarkRow = {
  id: string;
  book_id: string;
  cfi: string;
  chapter_title: string;
  excerpt: string;
  created_at: string;
};

type CardRow = {
  id: string;
  book_id: string;
  cfi_range: string;
  selected_text: string;
  translation: string;
  pronunciation: string;
  part_of_speech: string;
  definition: string;
  background: string;
  examples_json: string;
  related_words_json: string;
  chapter_title: string;
  queue_order: number;
  archived: number;
  created_at: string;
  updated_at: string;
};

type LexiconRow = {
  id: string;
  book_id: string;
  lemma: string;
  part_of_speech: string;
  word_forms_json: string;
  definition: string;
  translation_pt_br: string;
  ipa: string;
  cefr: string;
  book_frequency: number;
  first_sentence_id: string | null;
  resolution_status: string;
  pedagogical_relevance: string;
  senses_json: string;
  updated_at: string;
};
type PreferencesRow = {
  book_id: string;
  flow: ReaderPreferences['flow'];
  theme: ReaderPreferences['theme'];
  font_family: string;
  font_size: number;
  line_height: number;
  margin: number;
  text_align: ReaderPreferences['textAlign'];
};

const mapBook = (row: BookRow): Book => ({
  id: row.id,
  fileUri: row.file_uri,
  fileHash: row.file_hash,
  originalName: row.original_name,
  title: row.title,
  author: row.author,
  language: row.language,
  coverUri: row.cover_uri,
  description: row.description,
  publisher: row.publisher,
  importedAt: row.imported_at,
  lastOpenedAt: row.last_opened_at,
  lastCfi: row.last_cfi,
  progress: row.progress,
  locationsJson: row.locations_json,
});

const mapAnnotation = (row: AnnotationRow): AnnotationRecord => ({
  id: row.id,
  bookId: row.book_id,
  cfiRange: row.cfi_range,
  selectedText: row.selected_text,
  color: row.color,
  note: row.note,
  sectionIndex: row.section_index,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapBookmark = (row: BookmarkRow): BookmarkRecord => ({
  id: row.id,
  bookId: row.book_id,
  cfi: row.cfi,
  chapterTitle: row.chapter_title,
  excerpt: row.excerpt,
  createdAt: row.created_at,
});

function parseCardList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

const mapCard = (row: CardRow): CardRecord => ({
  id: row.id,
  bookId: row.book_id,
  cfiRange: row.cfi_range,
  selectedText: row.selected_text,
  translation: row.translation,
  pronunciation: row.pronunciation,
  partOfSpeech: row.part_of_speech,
  definition: row.definition,
  background: row.background,
  examples: parseCardList(row.examples_json),
  relatedWords: parseCardList(row.related_words_json),
  chapterTitle: row.chapter_title,
  queueOrder: row.queue_order,
  archived: row.archived === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapLexicon = (row: LexiconRow): LexiconEntry => ({
  id: row.id,
  bookId: row.book_id,
  lemma: row.lemma,
  partOfSpeech: row.part_of_speech,
  wordForms: parseCardList(row.word_forms_json),
  definition: row.definition,
  translationPtBr: row.translation_pt_br,
  ipa: row.ipa,
  cefr: row.cefr,
  bookFrequency: row.book_frequency,
  firstSentenceId: row.first_sentence_id,
  resolutionStatus: row.resolution_status,
  pedagogicalRelevance: row.pedagogical_relevance,
  senses: (() => { try { const parsed = JSON.parse(row.senses_json) as unknown; return Array.isArray(parsed) ? parsed : []; } catch { return []; } })(),
  updatedAt: row.updated_at,
});
const mapPreferences = (row: PreferencesRow): ReaderPreferences => ({
  bookId: row.book_id,
  flow: row.flow,
  theme: row.theme,
  fontFamily: row.font_family,
  fontSize: row.font_size,
  lineHeight: row.line_height,
  margin: row.margin,
  textAlign: row.text_align,
});

export async function listBooks(db: SQLiteDatabase, search = ''): Promise<Book[]> {
  const query = search.trim();
  const rows = query
    ? await db.getAllAsync<BookRow>(
        `SELECT * FROM books
         WHERE title LIKE $term ESCAPE '\\' OR author LIKE $term ESCAPE '\\'
         ORDER BY COALESCE(last_opened_at, imported_at) DESC`,
        { $term: `%${query.replace(/[\\%_]/g, '\\$&')}%` },
      )
    : await db.getAllAsync<BookRow>(
        'SELECT * FROM books ORDER BY COALESCE(last_opened_at, imported_at) DESC',
      );
  return rows.map(mapBook);
}

export async function getBook(db: SQLiteDatabase, id: string): Promise<Book | null> {
  const row = await db.getFirstAsync<BookRow>('SELECT * FROM books WHERE id = ?', id);
  return row ? mapBook(row) : null;
}

export async function findBookByHash(db: SQLiteDatabase, hash: string): Promise<Book | null> {
  const row = await db.getFirstAsync<BookRow>('SELECT * FROM books WHERE file_hash = ?', hash);
  return row ? mapBook(row) : null;
}

export async function insertBook(db: SQLiteDatabase, book: Book): Promise<void> {
  await db.runAsync(
    `INSERT INTO books (
      id, file_uri, file_hash, original_name, title, author, language, cover_uri,
      description, publisher, imported_at, last_opened_at, last_cfi, progress, locations_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    book.id,
    book.fileUri,
    book.fileHash,
    book.originalName,
    book.title,
    book.author,
    book.language,
    book.coverUri,
    book.description,
    book.publisher,
    book.importedAt,
    book.lastOpenedAt,
    book.lastCfi,
    book.progress,
    book.locationsJson,
  );
}

export async function updateReadingPosition(
  db: SQLiteDatabase,
  bookId: string,
  cfi: string,
  progress: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE books SET last_cfi = ?, progress = ?, last_opened_at = ? WHERE id = ?`,
    cfi,
    Math.max(0, Math.min(1, progress)),
    new Date().toISOString(),
    bookId,
  );
}

export async function applyRemoteReadingPosition(
  db: SQLiteDatabase,
  bookId: string,
  cfi: string | null,
  progress: number,
  lastOpenedAt: string | null,
): Promise<void> {
  await db.runAsync(
    'UPDATE books SET last_cfi = ?, progress = ?, last_opened_at = ? WHERE id = ?',
    cfi,
    Math.max(0, Math.min(1, progress)),
    lastOpenedAt,
    bookId,
  );
}

export async function saveLocations(db: SQLiteDatabase, bookId: string, locations: string[]): Promise<void> {
  await db.runAsync('UPDATE books SET locations_json = ? WHERE id = ?', JSON.stringify(locations), bookId);
}

export async function removeBook(db: SQLiteDatabase, bookId: string): Promise<Book | null> {
  const book = await getBook(db, bookId);
  if (book) await db.runAsync('DELETE FROM books WHERE id = ?', bookId);
  return book;
}

export async function listAnnotations(db: SQLiteDatabase, bookId: string): Promise<AnnotationRecord[]> {
  const rows = await db.getAllAsync<AnnotationRow>(
    'SELECT * FROM annotations WHERE book_id = ? ORDER BY created_at DESC',
    bookId,
  );
  return rows.map(mapAnnotation);
}

export async function insertAnnotation(db: SQLiteDatabase, annotation: AnnotationRecord): Promise<void> {
  await db.runAsync(
    `INSERT INTO annotations
      (id, book_id, cfi_range, selected_text, color, note, section_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    annotation.id,
    annotation.bookId,
    annotation.cfiRange,
    annotation.selectedText,
    annotation.color,
    annotation.note,
    annotation.sectionIndex,
    annotation.createdAt,
    annotation.updatedAt,
  );
}

export async function updateAnnotation(db: SQLiteDatabase, annotation: AnnotationRecord): Promise<void> {
  await db.runAsync(
    `UPDATE annotations SET color = ?, note = ?, section_index = ?, updated_at = ? WHERE id = ?`,
    annotation.color,
    annotation.note,
    annotation.sectionIndex,
    annotation.updatedAt,
    annotation.id,
  );
}

export async function updateAnnotationSection(
  db: SQLiteDatabase,
  id: string,
  sectionIndex: number,
): Promise<void> {
  await db.runAsync('UPDATE annotations SET section_index = ? WHERE id = ?', sectionIndex, id);
}

export async function deleteAnnotation(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM annotations WHERE id = ?', id);
}

export async function listBookmarks(db: SQLiteDatabase, bookId: string): Promise<BookmarkRecord[]> {
  const rows = await db.getAllAsync<BookmarkRow>(
    'SELECT * FROM bookmarks WHERE book_id = ? ORDER BY created_at DESC',
    bookId,
  );
  return rows.map(mapBookmark);
}

export async function insertBookmark(db: SQLiteDatabase, bookmark: BookmarkRecord): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO bookmarks (id, book_id, cfi, chapter_title, excerpt, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    bookmark.id,
    bookmark.bookId,
    bookmark.cfi,
    bookmark.chapterTitle,
    bookmark.excerpt,
    bookmark.createdAt,
  );
}

export async function deleteBookmarkByCfi(
  db: SQLiteDatabase,
  bookId: string,
  cfi: string,
): Promise<void> {
  await db.runAsync('DELETE FROM bookmarks WHERE book_id = ? AND cfi = ?', bookId, cfi);
}

export async function listCards(db: SQLiteDatabase, includeArchived = false): Promise<CardRecord[]> {
  const rows = await db.getAllAsync<CardRow>(
    includeArchived
      ? 'SELECT * FROM cards ORDER BY archived ASC, queue_order ASC, created_at ASC'
      : 'SELECT * FROM cards WHERE archived = 0 ORDER BY queue_order ASC, created_at ASC',
  );
  return rows.map(mapCard);
}

export async function insertCard(db: SQLiteDatabase, card: CardRecord): Promise<void> {
  await db.runAsync(
    `INSERT INTO cards
      (id, book_id, cfi_range, selected_text, translation, pronunciation, part_of_speech,
       definition, background, examples_json, related_words_json, chapter_title,
       queue_order, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    card.id,
    card.bookId,
    card.cfiRange,
    card.selectedText,
    card.translation,
    card.pronunciation,
    card.partOfSpeech,
    card.definition,
    card.background,
    JSON.stringify(card.examples),
    JSON.stringify(card.relatedWords),
    card.chapterTitle,
    card.queueOrder,
    card.archived ? 1 : 0,
    card.createdAt,
    card.updatedAt,
  );
}

export async function appendCard(db: SQLiteDatabase, card: CardRecord): Promise<void> {
  const row = await db.getFirstAsync<{ next_order: number }>(
    'SELECT COALESCE(MAX(queue_order), -1) + 1 AS next_order FROM cards',
  );
  await insertCard(db, {
    ...card,
    queueOrder: row?.next_order ?? 0,
    archived: false,
  });
}

export async function moveCardToEnd(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    `UPDATE cards
     SET queue_order = (
       SELECT COALESCE(MAX(queue_order), -1) + 1 FROM cards WHERE archived = 0
     ), updated_at = ?
     WHERE id = ? AND archived = 0`,
    new Date().toISOString(),
    id,
  );
}

export async function archiveCard(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    'UPDATE cards SET archived = 1, updated_at = ? WHERE id = ?',
    new Date().toISOString(),
    id,
  );
}

export async function updateCard(db: SQLiteDatabase, card: CardRecord): Promise<void> {
  await db.runAsync(
    `UPDATE cards
     SET selected_text = ?, translation = ?, pronunciation = ?, part_of_speech = ?,
         definition = ?, background = ?, examples_json = ?, related_words_json = ?, updated_at = ?
     WHERE id = ?`,
    card.selectedText,
    card.translation,
    card.pronunciation,
    card.partOfSpeech,
    card.definition,
    card.background,
    JSON.stringify(card.examples),
    JSON.stringify(card.relatedWords),
    card.updatedAt,
    card.id,
  );
}

export async function replaceCard(db: SQLiteDatabase, card: CardRecord): Promise<void> {
  await db.runAsync(
    `UPDATE cards
     SET selected_text = ?, translation = ?, pronunciation = ?, part_of_speech = ?,
         definition = ?, background = ?, examples_json = ?, related_words_json = ?,
         chapter_title = ?, queue_order = ?, archived = ?, created_at = ?, updated_at = ?
     WHERE id = ?`,
    card.selectedText,
    card.translation,
    card.pronunciation,
    card.partOfSpeech,
    card.definition,
    card.background,
    JSON.stringify(card.examples),
    JSON.stringify(card.relatedWords),
    card.chapterTitle,
    card.queueOrder,
    card.archived ? 1 : 0,
    card.createdAt,
    card.updatedAt,
    card.id,
  );
}

export async function getReaderPreferences(
  db: SQLiteDatabase,
  bookId: string,
): Promise<ReaderPreferences> {
  const row = await db.getFirstAsync<PreferencesRow>(
    'SELECT * FROM reader_preferences WHERE book_id = ?',
    bookId,
  );
  return row ? mapPreferences(row) : { bookId, ...DEFAULT_READER_PREFERENCES };
}

export async function saveReaderPreferences(
  db: SQLiteDatabase,
  preferences: ReaderPreferences,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO reader_preferences
      (book_id, flow, theme, font_family, font_size, line_height, margin, text_align)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(book_id) DO UPDATE SET
       flow = excluded.flow,
       theme = excluded.theme,
       font_family = excluded.font_family,
       font_size = excluded.font_size,
       line_height = excluded.line_height,
       margin = excluded.margin,
       text_align = excluded.text_align`,
    preferences.bookId,
    preferences.flow,
    preferences.theme,
    preferences.fontFamily,
    preferences.fontSize,
    preferences.lineHeight,
    preferences.margin,
    preferences.textAlign,
  );
}

export async function getCachedLookup(
  db: SQLiteDatabase,
  language: string,
  term: string,
): Promise<LookupCacheRecord | null> {
  const row = await db.getFirstAsync<{
    language: string;
    term: string;
    definition: string;
    expires_at: string;
  }>(
    `SELECT * FROM lookup_cache
     WHERE language = ? AND term = ? AND expires_at > ?`,
    language,
    term,
    new Date().toISOString(),
  );
  return row
    ? { language: row.language, term: row.term, definition: row.definition, expiresAt: row.expires_at }
    : null;
}

export async function cacheLookup(db: SQLiteDatabase, record: LookupCacheRecord): Promise<void> {
  await db.runAsync(
    `INSERT INTO lookup_cache (language, term, definition, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(language, term) DO UPDATE SET
       definition = excluded.definition, expires_at = excluded.expires_at`,
    record.language,
    record.term,
    record.definition,
    record.expiresAt,
  );
}

export async function listLexicon(db: SQLiteDatabase, bookId: string, limit = 2000): Promise<LexiconEntry[]> {
  const rows = await db.getAllAsync<LexiconRow>('SELECT * FROM lexicon_entries WHERE book_id = ? ORDER BY book_frequency DESC, lemma ASC LIMIT ?', bookId, Math.max(1, Math.min(limit, 5000)));
  return rows.map(mapLexicon);
}

export async function getLexiconEntry(db: SQLiteDatabase, bookId: string, term: string): Promise<LexiconEntry | null> {
  const normalized = term.trim().toLocaleLowerCase();
  if (!normalized) return null;
  const row = await db.getFirstAsync<LexiconRow>(
    `SELECT le.* FROM lexicon_entries le
     WHERE le.book_id = ? AND (lower(le.lemma) = ? OR EXISTS (
       SELECT 1 FROM json_each(le.word_forms_json) wf WHERE lower(wf.value) = ?
     )) ORDER BY le.book_frequency DESC LIMIT 1`,
    bookId, normalized, normalized,
  );
  return row ? mapLexicon(row) : null;
}

export async function upsertLexiconEntries(db: SQLiteDatabase, bookId: string, entries: LexiconEntry[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('DELETE FROM lexicon_entries WHERE book_id = ?', bookId);
    for (const entry of entries) {
      await transaction.runAsync(
        `INSERT INTO lexicon_entries
          (id, book_id, lemma, part_of_speech, word_forms_json, definition, translation_pt_br, ipa, cefr,
           book_frequency, first_sentence_id, resolution_status, pedagogical_relevance, senses_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.id, bookId, entry.lemma, entry.partOfSpeech, JSON.stringify(entry.wordForms), entry.definition,
        entry.translationPtBr, entry.ipa, entry.cefr, entry.bookFrequency, entry.firstSentenceId,
        entry.resolutionStatus, entry.pedagogicalRelevance, JSON.stringify(entry.senses), entry.updatedAt,
      );
    }
  });
}
export async function exportSnapshot(db: SQLiteDatabase): Promise<LibrarySnapshot> {
  const books = (await db.getAllAsync<BookRow>('SELECT * FROM books')).map(mapBook);
  const annotations = (await db.getAllAsync<AnnotationRow>('SELECT * FROM annotations')).map(mapAnnotation);
  const bookmarks = (await db.getAllAsync<BookmarkRow>('SELECT * FROM bookmarks')).map(mapBookmark);
  const cards = (await db.getAllAsync<CardRow>('SELECT * FROM cards ORDER BY queue_order ASC, created_at ASC')).map(mapCard);
  const preferences = (await db.getAllAsync<PreferencesRow>('SELECT * FROM reader_preferences')).map(mapPreferences);
  const lexicon = (await db.getAllAsync<LexiconRow>('SELECT * FROM lexicon_entries')).map(mapLexicon);
  const lookupRows = await db.getAllAsync<{
    language: string;
    term: string;
    definition: string;
    expires_at: string;
  }>('SELECT * FROM lookup_cache');
  return {
    books,
    annotations,
    bookmarks,
    cards,
    preferences,
    lexicon,
    lookupCache: lookupRows.map((row) => ({
      language: row.language,
      term: row.term,
      definition: row.definition,
      expiresAt: row.expires_at,
    })),
  };
}

export async function replaceSnapshot(db: SQLiteDatabase, snapshot: LibrarySnapshot): Promise<void> {
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM annotations;
      DELETE FROM bookmarks;
      DELETE FROM cards;
      DELETE FROM reader_preferences;
      DELETE FROM lookup_cache;
      DELETE FROM lexicon_entries;
      DELETE FROM books;
    `);
    for (const book of snapshot.books) await insertBook(transaction, book);
    for (const annotation of snapshot.annotations) await insertAnnotation(transaction, annotation);
    for (const bookmark of snapshot.bookmarks) await insertBookmark(transaction, bookmark);
    for (const card of snapshot.cards) await insertCard(transaction, card);
    for (const preferences of snapshot.preferences) await saveReaderPreferences(transaction, preferences);
    for (const record of snapshot.lookupCache) await cacheLookup(transaction, record);
    for (const book of snapshot.books) await upsertLexiconEntries(transaction, book.id, (snapshot.lexicon ?? []).filter((entry) => entry.bookId === book.id));
  });
}

export type SyncSession = {
  token: string;
  email: string;
  apiBaseUrl: string;
  updatedAt: string;
};

export async function getSyncSession(db: SQLiteDatabase): Promise<SyncSession | null> {
  const row = await db.getFirstAsync<{
    token: string;
    email: string;
    api_base_url: string;
    updated_at: string;
  }>('SELECT token, email, api_base_url, updated_at FROM sync_session WHERE id = 1');
  return row
    ? { token: row.token, email: row.email, apiBaseUrl: row.api_base_url, updatedAt: row.updated_at }
    : null;
}

export async function saveSyncSession(db: SQLiteDatabase, session: SyncSession): Promise<void> {
  await db.runAsync(
    "INSERT INTO sync_session (id, token, email, api_base_url, updated_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET token = excluded.token, email = excluded.email, api_base_url = excluded.api_base_url, updated_at = excluded.updated_at",
    session.token,
    session.email,
    session.apiBaseUrl,
    session.updatedAt,
  );
}

export async function clearSyncSession(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM sync_session');
}

export async function getRemoteId(
  db: SQLiteDatabase,
  entityType: 'book' | 'card',
  localId: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ remote_id: string }>(
    'SELECT remote_id FROM sync_entity_map WHERE entity_type = ? AND local_id = ?',
    entityType,
    localId,
  );
  return row?.remote_id ?? null;
}

export async function getLocalId(
  db: SQLiteDatabase,
  entityType: 'book' | 'card',
  remoteId: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ local_id: string }>(
    'SELECT local_id FROM sync_entity_map WHERE entity_type = ? AND remote_id = ?',
    entityType,
    remoteId,
  );
  return row?.local_id ?? null;
}

export async function saveRemoteId(
  db: SQLiteDatabase,
  entityType: 'book' | 'card',
  localId: string,
  remoteId: string,
): Promise<void> {
  await db.runAsync(
    "INSERT INTO sync_entity_map (entity_type, local_id, remote_id) VALUES (?, ?, ?) ON CONFLICT(entity_type, local_id) DO UPDATE SET remote_id = excluded.remote_id",
    entityType,
    localId,
    remoteId,
  );
}