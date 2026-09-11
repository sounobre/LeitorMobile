package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional
class LexicalDictionaryIndexTest {
    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void hasIndexesForCaseInsensitiveCatalogLookup() {
        assertEquals(1, indexCount("idx_lexemes_language_lower_lemma"));
        assertEquals(1, indexCount("idx_word_forms_lexeme_lower_form"));
    }

    private int indexCount(String indexName) {
        return jdbc.queryForObject(
                "select count(*) from pg_indexes where schemaname = current_schema() and indexname = ?",
                Integer.class,
                indexName
        );
    }
}
