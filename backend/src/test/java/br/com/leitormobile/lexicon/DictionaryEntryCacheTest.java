package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DictionaryEntryCacheTest {
    @Test
    void reusesTheDictionaryEntryForRepeatedOccurrencesOfOneLexeme() {
        UUID lexemeId = UUID.randomUUID();
        Lexeme lexeme = mock(Lexeme.class);
        when(lexeme.getId()).thenReturn(lexemeId);
        DictionaryEntry entry = new DictionaryEntry(lexeme);
        DictionaryEntryRepository repository = mock(DictionaryEntryRepository.class);
        when(repository.findByLexemeId(lexemeId)).thenReturn(Optional.of(entry));

        DictionaryEntryCache cache = new DictionaryEntryCache(repository);

        assertSame(entry, cache.findOrCreate(lexeme));
        assertSame(entry, cache.findOrCreate(lexeme));
        verify(repository).findByLexemeId(lexemeId);
    }
}
