CREATE INDEX idx_lexemes_language_lower_lemma
    ON lexemes(language, lower(lemma));

CREATE INDEX idx_word_forms_lexeme_lower_form
    ON word_forms(lexeme_id, lower(form));
