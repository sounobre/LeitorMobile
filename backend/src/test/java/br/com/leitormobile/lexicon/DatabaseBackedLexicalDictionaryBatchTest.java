package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTimeout;

import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(DatabaseBackedLexicalDictionary.class)
@Transactional
class DatabaseBackedLexicalDictionaryBatchTest extends PostgresIntegrationTestSupport {
    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DatabaseBackedLexicalDictionary dictionary;

    @Test
    void resolvesManyTermsInOneBatchWithoutPerTermLookups() {
        UUID lexemeId = UUID.randomUUID();
        UUID dictionaryId = UUID.randomUUID();
        jdbc.update(
                "insert into lexemes(id, language, lemma, part_of_speech) values (?, 'en', ?, 'VERB')",
                lexemeId,
                "batch-lemma"
        );
        jdbc.update(
                "insert into word_forms(lexeme_id, form) values (?, ?)",
                lexemeId,
                "batch-form"
        );
        jdbc.update(
                "insert into dictionary_entries(id, lexeme_id, definition, translation_pt_br, ipa, cefr, source) values (?, ?, 'batch definition', 'lote', '', 'B1', 'TEST')",
                dictionaryId,
                lexemeId
        );

        List<String> missingTerms = java.util.stream.IntStream.range(0, 250)
                .mapToObj(index -> "batch-missing-" + index)
                .toList();
        final List<String> terms = java.util.stream.Stream.concat(
                missingTerms.stream(), java.util.stream.Stream.of("BATCH-LEMMA", "BATCH-FORM")
        ).toList();

        Map<String, LocalLexicalDictionary.LocalEntry> entries = assertTimeout(
                Duration.ofSeconds(2),
                () -> dictionary.findAll(terms)
        );

        assertEquals("batch definition", entries.get("batch-lemma").definition());
        assertEquals("batch definition", entries.get("batch-form").definition());
        assertEquals(2, entries.size());
    }
}
