CREATE TABLE lexicon_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    progress NUMERIC(5, 4) NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
    processed_units INTEGER NOT NULL DEFAULT 0,
    total_units INTEGER NOT NULL DEFAULT 0,
    processed_tokens INTEGER NOT NULL DEFAULT 0,
    total_lexemes INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

CREATE INDEX idx_lexicon_jobs_book ON lexicon_jobs(book_id, created_at DESC);

CREATE TABLE reading_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    unit_index INTEGER NOT NULL,
    href VARCHAR(1000) NOT NULL,
    title VARCHAR(500) NOT NULL DEFAULT '',
    text_hash VARCHAR(128) NOT NULL,
    character_count INTEGER NOT NULL DEFAULT 0,
    sentence_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(book_id, unit_index)
);

CREATE TABLE sentences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reading_unit_id UUID NOT NULL REFERENCES reading_units(id) ON DELETE CASCADE,
    sequence_index INTEGER NOT NULL,
    text_hash VARCHAR(128) NOT NULL,
    character_count INTEGER NOT NULL DEFAULT 0,
    start_offset INTEGER NOT NULL DEFAULT 0,
    end_offset INTEGER NOT NULL DEFAULT 0,
    UNIQUE(reading_unit_id, sequence_index)
);

CREATE TABLE lexemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language VARCHAR(32) NOT NULL,
    lemma VARCHAR(500) NOT NULL,
    part_of_speech VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(language, lemma, part_of_speech)
);

CREATE TABLE word_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lexeme_id UUID NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
    form VARCHAR(500) NOT NULL,
    UNIQUE(lexeme_id, form)
);

CREATE INDEX idx_word_forms_form ON word_forms(lower(form));

CREATE TABLE dictionary_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lexeme_id UUID NOT NULL UNIQUE REFERENCES lexemes(id) ON DELETE CASCADE,
    definition TEXT NOT NULL DEFAULT '',
    translation_pt_br TEXT NOT NULL DEFAULT '',
    ipa VARCHAR(500) NOT NULL DEFAULT '',
    cefr VARCHAR(16) NOT NULL DEFAULT '',
    source VARCHAR(64) NOT NULL DEFAULT 'LOCAL',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lexical_senses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dictionary_entry_id UUID NOT NULL REFERENCES dictionary_entries(id) ON DELETE CASCADE,
    sense_key VARCHAR(200) NOT NULL,
    definition TEXT NOT NULL DEFAULT '',
    translation_pt_br TEXT NOT NULL DEFAULT '',
    cefr VARCHAR(16) NOT NULL DEFAULT '',
    source VARCHAR(64) NOT NULL DEFAULT 'LOCAL',
    UNIQUE(dictionary_entry_id, sense_key)
);

CREATE TABLE book_lexemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    lexeme_id UUID NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
    frequency INTEGER NOT NULL DEFAULT 0,
    first_sentence_id UUID REFERENCES sentences(id) ON DELETE SET NULL,
    resolution_status VARCHAR(32) NOT NULL DEFAULT 'UNRESOLVED',
    pedagogical_relevance VARCHAR(32) NOT NULL DEFAULT 'OPTIONAL',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(book_id, lexeme_id)
);

CREATE TABLE book_senses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_lexeme_id UUID NOT NULL REFERENCES book_lexemes(id) ON DELETE CASCADE,
    lexical_sense_id UUID NOT NULL REFERENCES lexical_senses(id) ON DELETE CASCADE,
    occurrence_count INTEGER NOT NULL DEFAULT 0,
    confidence NUMERIC(5, 4),
    resolution_status VARCHAR(32) NOT NULL DEFAULT 'UNRESOLVED',
    UNIQUE(book_lexeme_id, lexical_sense_id)
);

CREATE TABLE token_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    sentence_id UUID NOT NULL REFERENCES sentences(id) ON DELETE CASCADE,
    lexeme_id UUID NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
    surface VARCHAR(500) NOT NULL,
    start_offset INTEGER NOT NULL DEFAULT 0,
    end_offset INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_token_occurrences_book ON token_occurrences(book_id, lexeme_id);
CREATE INDEX idx_token_occurrences_surface ON token_occurrences(book_id, lower(surface));

CREATE TABLE ai_request_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE SET NULL,
    job_id UUID REFERENCES lexicon_jobs(id) ON DELETE SET NULL,
    lexeme_id UUID REFERENCES lexemes(id) ON DELETE SET NULL,
    provider VARCHAR(64) NOT NULL,
    model VARCHAR(200) NOT NULL,
    task_type VARCHAR(64) NOT NULL,
    used_copyrighted_excerpt BOOLEAN NOT NULL DEFAULT false,
    excerpt_character_count INTEGER NOT NULL DEFAULT 0,
    excerpt_count INTEGER NOT NULL DEFAULT 0,
    reason VARCHAR(1000) NOT NULL,
    input_token_count INTEGER,
    output_token_count INTEGER,
    result_status VARCHAR(32) NOT NULL,
    request_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_audit_book ON ai_request_audit(book_id, created_at DESC);

ALTER TABLE cards ADD COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE cards ADD COLUMN lexeme_id UUID REFERENCES lexemes(id) ON DELETE SET NULL;
ALTER TABLE cards ADD COLUMN book_lexeme_id UUID REFERENCES book_lexemes(id) ON DELETE SET NULL;
