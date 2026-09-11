package br.com.leitormobile.lexicon;

import java.util.Collection;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Caches local dictionary lookups for the lifetime of one lexicon job. */
final class LexicalDictionaryCache {
    private final LocalLexicalDictionary delegate;
    private final Map<String, Optional<LocalLexicalDictionary.LocalEntry>> values = new HashMap<>();

    LexicalDictionaryCache(LocalLexicalDictionary delegate) {
        this.delegate = delegate;
    }

    void prime(Collection<String> terms) {
        Map<String, LocalLexicalDictionary.LocalEntry> found = delegate.findAll(terms);
        for (String term : terms) {
            if (term == null || term.isBlank()) continue;
            String normalized = term.trim().toLowerCase(Locale.ROOT);
            values.put(normalized, Optional.ofNullable(found.get(normalized)));
        }
    }

    Optional<LocalLexicalDictionary.LocalEntry> find(String term) {
        if (term == null || term.isBlank()) return delegate.find(term);
        String key = term.trim().toLowerCase(Locale.ROOT);
        return values.computeIfAbsent(key, ignored -> delegate.find(key));
    }
}
