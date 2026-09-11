package br.com.leitormobile.lexicon;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Reuses dictionary entities while a book's occurrences are processed. */
final class DictionaryEntryCache {
    private final DictionaryEntryRepository repository;
    private final Map<UUID, DictionaryEntry> values = new HashMap<>();

    DictionaryEntryCache(DictionaryEntryRepository repository) {
        this.repository = repository;
    }

    DictionaryEntry findOrCreate(Lexeme lexeme) {
        return values.computeIfAbsent(lexeme.getId(), ignored -> repository.findByLexemeId(lexeme.getId())
                .orElseGet(() -> repository.save(new DictionaryEntry(lexeme))));
    }
}
