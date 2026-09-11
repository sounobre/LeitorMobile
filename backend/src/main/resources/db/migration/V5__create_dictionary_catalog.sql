CREATE TABLE dictionary_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    homepage_url TEXT NOT NULL,
    license_name VARCHAR(200) NOT NULL,
    license_url TEXT NOT NULL,
    attribution_text TEXT NOT NULL,
    source_version VARCHAR(200) NOT NULL,
    snapshot_date DATE NOT NULL,
    source_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE dictionary_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dictionary_source_id UUID NOT NULL REFERENCES dictionary_sources(id) ON DELETE RESTRICT,
    source_file TEXT NOT NULL,
    source_hash VARCHAR(128) NOT NULL,
    source_size_bytes BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL,
    records_read BIGINT NOT NULL DEFAULT 0,
    records_accepted BIGINT NOT NULL DEFAULT 0,
    lexemes_imported BIGINT NOT NULL DEFAULT 0,
    forms_imported BIGINT NOT NULL DEFAULT 0,
    senses_imported BIGINT NOT NULL DEFAULT 0,
    translations_imported BIGINT NOT NULL DEFAULT 0,
    pronunciations_imported BIGINT NOT NULL DEFAULT 0,
    examples_imported BIGINT NOT NULL DEFAULT 0,
    relations_imported BIGINT NOT NULL DEFAULT 0,
    error_count BIGINT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    error_message TEXT,
    UNIQUE(dictionary_source_id, source_hash)
);

CREATE INDEX idx_dictionary_import_batches_status ON dictionary_import_batches(status, started_at DESC);

CREATE TABLE dictionary_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lexical_sense_id UUID NOT NULL REFERENCES lexical_senses(id) ON DELETE CASCADE,
    language VARCHAR(16) NOT NULL,
    translation TEXT NOT NULL,
    qualifier TEXT NOT NULL DEFAULT '',
    source VARCHAR(64) NOT NULL,
    UNIQUE(lexical_sense_id, language, translation)
);

CREATE INDEX idx_dictionary_translations_lookup ON dictionary_translations(language, lower(translation));

CREATE TABLE dictionary_pronunciations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dictionary_entry_id UUID NOT NULL REFERENCES dictionary_entries(id) ON DELETE CASCADE,
    ipa VARCHAR(500) NOT NULL DEFAULT '',
    audio_url TEXT NOT NULL DEFAULT '',
    dialect VARCHAR(200) NOT NULL DEFAULT '',
    source VARCHAR(64) NOT NULL,
    UNIQUE(dictionary_entry_id, ipa, audio_url)
);

CREATE TABLE lexical_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lexical_sense_id UUID NOT NULL REFERENCES lexical_senses(id) ON DELETE CASCADE,
    example_text TEXT NOT NULL,
    translation_text TEXT NOT NULL DEFAULT '',
    source VARCHAR(64) NOT NULL
);

CREATE INDEX idx_lexical_examples_sense ON lexical_examples(lexical_sense_id);

CREATE TABLE lexical_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_lexeme_id UUID NOT NULL REFERENCES lexemes(id) ON DELETE CASCADE,
    relation_type VARCHAR(64) NOT NULL,
    target_language VARCHAR(16) NOT NULL,
    target_lemma VARCHAR(500) NOT NULL,
    target_lexeme_id UUID REFERENCES lexemes(id) ON DELETE SET NULL,
    source VARCHAR(64) NOT NULL,
    UNIQUE(source_lexeme_id, relation_type, target_language, target_lemma)
);

CREATE INDEX idx_lexical_relations_source ON lexical_relations(source_lexeme_id, relation_type);
