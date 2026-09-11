package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class LexicalDictionaryCacheTest {

    @Test
    void reusesTheSameDictionaryLookupWithinOneJob() {
        CountingDictionary dictionary = new CountingDictionary();
        LexicalDictionaryCache cache = new LexicalDictionaryCache(dictionary);

        assertTrue(cache.find("repeated-term").isPresent());
        assertTrue(cache.find("repeated-term").isPresent());

        assertEquals(1, dictionary.calls);
    }

    private static final class CountingDictionary extends LocalLexicalDictionary {
        private int calls;

        @Override
        public Optional<LocalEntry> find(String term) {
            calls++;
            return Optional.of(new LocalEntry("definition", "tradução", "", "A1"));
        }
    }
}
