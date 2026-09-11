CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_uri VARCHAR(1000),
    file_hash VARCHAR(128) NOT NULL UNIQUE,
    original_name VARCHAR(500) NOT NULL,
    title VARCHAR(500) NOT NULL,
    author VARCHAR(500) NOT NULL DEFAULT '',
    language VARCHAR(32) NOT NULL DEFAULT 'pt-BR',
    cover_uri VARCHAR(1000),
    description TEXT NOT NULL DEFAULT '',
    publisher VARCHAR(500) NOT NULL DEFAULT '',
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_opened_at TIMESTAMPTZ,
    last_cfi TEXT,
    progress NUMERIC(5, 4) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
    locations_json JSONB
);

CREATE TABLE annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    cfi_range TEXT NOT NULL,
    selected_text TEXT NOT NULL,
    color VARCHAR(16) NOT NULL,
    note TEXT,
    section_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    cfi TEXT NOT NULL,
    chapter_title VARCHAR(500) NOT NULL DEFAULT '',
    excerpt TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (book_id, cfi)
);

CREATE TABLE cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    cfi_range TEXT NOT NULL,
    selected_text TEXT NOT NULL,
    translation TEXT NOT NULL DEFAULT '',
    pronunciation VARCHAR(500) NOT NULL DEFAULT '',
    part_of_speech VARCHAR(200) NOT NULL DEFAULT '',
    definition TEXT NOT NULL DEFAULT '',
    background TEXT NOT NULL DEFAULT '',
    examples_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    related_words_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    chapter_title VARCHAR(500) NOT NULL DEFAULT '',
    queue_order INTEGER NOT NULL DEFAULT 0,
    archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reader_preferences (
    book_id UUID PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
    flow VARCHAR(32) NOT NULL DEFAULT 'paginated',
    theme VARCHAR(32) NOT NULL DEFAULT 'light',
    font_family VARCHAR(100) NOT NULL DEFAULT 'serif',
    font_size INTEGER NOT NULL DEFAULT 100,
    line_height NUMERIC(4, 2) NOT NULL DEFAULT 1.55,
    margin INTEGER NOT NULL DEFAULT 20,
    text_align VARCHAR(16) NOT NULL DEFAULT 'justify'
);

CREATE TABLE lookup_cache (
    language VARCHAR(32) NOT NULL,
    term VARCHAR(500) NOT NULL,
    definition TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (language, term)
);

CREATE INDEX idx_books_last_opened ON books (last_opened_at DESC, imported_at DESC);
CREATE INDEX idx_cards_queue ON cards (archived, queue_order, created_at);
