package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.transaction.annotation.Transactional;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional
class LexemeRepositoryQueryTest extends PostgresIntegrationTestSupport {
    @Autowired
    private LexemeRepository lexemes;

    @Test
    void ordersBestMatchOnPostgresWithoutDistinctOrderByError() {
        String lemma = "query-regression-" + UUID.randomUUID();
        lexemes.save(new Lexeme("en", lemma, "UNKNOWN"));
        lexemes.save(new Lexeme("en", lemma, "VERB"));

        var matches = lexemes.findBestMatch("en", lemma, lemma, "VERB");

        assertFalse(matches.isEmpty());
        assertEquals(1, matches.size());
        assertEquals("VERB", matches.get(0).getPartOfSpeech());
    }
}
