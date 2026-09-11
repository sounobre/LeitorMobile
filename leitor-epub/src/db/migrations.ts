import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 6;

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error('O banco foi criado por uma versão mais recente do aplicativo.');
  }

  if (currentVersion < 1) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        CREATE TABLE books (
          id TEXT PRIMARY KEY NOT NULL,
          file_uri TEXT NOT NULL,
          file_hash TEXT NOT NULL UNIQUE,
          original_name TEXT NOT NULL,
          title TEXT NOT NULL,
          author TEXT NOT NULL DEFAULT '',
          language TEXT NOT NULL DEFAULT 'und',
          cover_uri TEXT,
          description TEXT NOT NULL DEFAULT '',
          publisher TEXT NOT NULL DEFAULT '',
          imported_at TEXT NOT NULL,
          last_opened_at TEXT,
          last_cfi TEXT,
          progress REAL NOT NULL DEFAULT 0 CHECK(progress >= 0 AND progress <= 1),
          locations_json TEXT
        );

        CREATE TABLE annotations (
          id TEXT PRIMARY KEY NOT NULL,
          book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          cfi_range TEXT NOT NULL,
          selected_text TEXT NOT NULL,
          color TEXT NOT NULL,
          note TEXT,
          section_index INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(book_id, cfi_range)
        );

        CREATE TABLE bookmarks (
          id TEXT PRIMARY KEY NOT NULL,
          book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          cfi TEXT NOT NULL,
          chapter_title TEXT NOT NULL DEFAULT '',
          excerpt TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          UNIQUE(book_id, cfi)
        );

        CREATE TABLE reader_preferences (
          book_id TEXT PRIMARY KEY NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          flow TEXT NOT NULL CHECK(flow IN ('paginated', 'scrolled-doc')),
          theme TEXT NOT NULL CHECK(theme IN ('light', 'sepia', 'dark')),
          font_family TEXT NOT NULL,
          font_size INTEGER NOT NULL,
          line_height REAL NOT NULL,
          margin INTEGER NOT NULL,
          text_align TEXT NOT NULL CHECK(text_align IN ('left', 'justify'))
        );

        CREATE TABLE lookup_cache (
          language TEXT NOT NULL,
          term TEXT NOT NULL,
          definition TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          PRIMARY KEY(language, term)
        );

        CREATE INDEX idx_books_recent ON books(last_opened_at DESC, imported_at DESC);
        CREATE INDEX idx_annotations_book ON annotations(book_id, created_at DESC);
        CREATE INDEX idx_bookmarks_book ON bookmarks(book_id, created_at DESC);
      `);
      await transaction.execAsync('PRAGMA user_version = 1;');
    });
  }

  if (currentVersion < 2) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        CREATE TABLE cards (
          id TEXT PRIMARY KEY NOT NULL,
          book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          cfi_range TEXT NOT NULL,
          selected_text TEXT NOT NULL,
          translation TEXT NOT NULL DEFAULT '',
          chapter_title TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX idx_cards_recent ON cards(created_at DESC);
      `);
      await transaction.execAsync('PRAGMA user_version = 2;');
    });
  }

  if (currentVersion < 3) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        ALTER TABLE cards ADD COLUMN queue_order INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE cards ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
        UPDATE cards SET queue_order = rowid - 1;
      `);
      await transaction.execAsync('PRAGMA user_version = 3;');
    });
  }

  if (currentVersion < 4) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        ALTER TABLE cards ADD COLUMN pronunciation TEXT NOT NULL DEFAULT '';
        ALTER TABLE cards ADD COLUMN part_of_speech TEXT NOT NULL DEFAULT '';
        ALTER TABLE cards ADD COLUMN definition TEXT NOT NULL DEFAULT '';
        ALTER TABLE cards ADD COLUMN background TEXT NOT NULL DEFAULT '';
        ALTER TABLE cards ADD COLUMN examples_json TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE cards ADD COLUMN related_words_json TEXT NOT NULL DEFAULT '[]';
      `);
      await transaction.execAsync('PRAGMA user_version = 4;');
    });
  }
  if (currentVersion < 5) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync("CREATE TABLE sync_session (id INTEGER PRIMARY KEY CHECK(id = 1), token TEXT NOT NULL, email TEXT NOT NULL, api_base_url TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE sync_entity_map (entity_type TEXT NOT NULL, local_id TEXT NOT NULL, remote_id TEXT NOT NULL, PRIMARY KEY(entity_type, local_id)); CREATE INDEX idx_sync_entity_remote ON sync_entity_map(entity_type, remote_id);");
      await transaction.execAsync('PRAGMA user_version = 5;');
    });
  }
  if (currentVersion < 6) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`
        CREATE TABLE lexicon_entries (
          id TEXT PRIMARY KEY NOT NULL,
          book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
          lemma TEXT NOT NULL,
          part_of_speech TEXT NOT NULL DEFAULT '',
          word_forms_json TEXT NOT NULL DEFAULT '[]',
          definition TEXT NOT NULL DEFAULT '',
          translation_pt_br TEXT NOT NULL DEFAULT '',
          ipa TEXT NOT NULL DEFAULT '',
          cefr TEXT NOT NULL DEFAULT '',
          book_frequency INTEGER NOT NULL DEFAULT 0,
          first_sentence_id TEXT,
          resolution_status TEXT NOT NULL DEFAULT 'UNRESOLVED',
          pedagogical_relevance TEXT NOT NULL DEFAULT 'OPTIONAL',
          senses_json TEXT NOT NULL DEFAULT '[]',
          updated_at TEXT NOT NULL,
          UNIQUE(book_id, lemma, part_of_speech)
        );
        CREATE INDEX idx_lexicon_entries_lookup ON lexicon_entries(book_id, lemma);
      `);
      await transaction.execAsync('PRAGMA user_version = 6;');
    });
  }
}