package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTimeout;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
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
class DatabaseBackedLexicalDictionaryTest {
    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DatabaseBackedLexicalDictionary dictionary;

    @Test
    void findsDictionaryEntryByCaseInsensitiveWordForm() {
        UUID lexemeId = UUID.randomUUID();
        UUID dictionaryId = UUID.randomUUID();
        jdbc.update(
                "insert into lexemes(id, language, lemma, part_of_speech) values (?, 'en', ?, 'VERB')",
                lexemeId,
                "lookup-regression"
        );
        jdbc.update(
                "insert into word_forms(lexeme_id, form) values (?, ?)",
                lexemeId,
                "looked-up"
        );
        jdbc.update(
                "insert into dictionary_entries(id, lexeme_id, definition, translation_pt_br, ipa, cefr, source) values (?, ?, 'definition', 'tradu��o', '', 'B1', 'TEST')",
                dictionaryId,
                lexemeId
        );

        LocalLexicalDictionary.LocalEntry entry = dictionary.find("LOOKED-UP").orElseThrow();

        assertEquals("definition", entry.definition());
        assertEquals("tradu��o", entry.translationPtBr());
    }

    @Test
    void missesTermsOutsideTheCatalogWithoutScanningEveryLexeme() {
        String missingTerm = "missing-lookup-" + UUID.randomUUID();

        assertTimeout(Duration.ofSeconds(1), () ->
                assertTrue(dictionary.find(missingTerm).isEmpty())
        );
    }
}
