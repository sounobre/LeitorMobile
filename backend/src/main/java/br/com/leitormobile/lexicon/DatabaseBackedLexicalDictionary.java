package br.com.leitormobile.lexicon;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps the old seed dictionary as a fallback while making the database catalog
 * the first source consulted by the book processing job.
 */
@Primary
@Component
public class DatabaseBackedLexicalDictionary extends LocalLexicalDictionary {
    private static final int LOOKUP_BATCH_SIZE = 500;

    private final JdbcTemplate jdbc;

    public DatabaseBackedLexicalDictionary(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Optional<LocalEntry> find(String term) {
        if (term == null || term.isBlank()) return super.find(term);
        String normalized = normalize(term);
        return Optional.ofNullable(findAll(List.of(normalized)).get(normalized));
    }

    @Override
    public Map<String, LocalEntry> findAll(Collection<String> terms) {
        List<String> normalizedTerms = terms.stream()
                .filter(term -> term != null && !term.isBlank())
                .map(DatabaseBackedLexicalDictionary::normalize)
                .distinct()
                .toList();
        if (normalizedTerms.isEmpty()) return Map.of();

        Map<String, LocalEntry> result = new HashMap<>();
        for (int start = 0; start < normalizedTerms.size(); start += LOOKUP_BATCH_SIZE) {
            List<String> batch = normalizedTerms.subList(start, Math.min(start + LOOKUP_BATCH_SIZE, normalizedTerms.size()));
            queryBatch(batch, result);
        }
        Map<String, LocalEntry> fallback = super.findAll(normalizedTerms);
        fallback.forEach(result::putIfAbsent);
        return result;
    }

    private void queryBatch(List<String> terms, Map<String, LocalEntry> result) {
        String placeholders = String.join(",", java.util.Collections.nCopies(terms.size(), "?"));
        String sql = """
                SELECT matches.term, matches.definition, matches.translation_pt_br, matches.ipa, matches.cefr,
                       matches.match_rank, matches.part_of_speech
                FROM (
                    SELECT lower(l.lemma) AS term, de.definition, de.translation_pt_br, de.ipa, de.cefr,
                           0 AS match_rank, l.part_of_speech
                    FROM dictionary_entries de
                    JOIN lexemes l ON l.id = de.lexeme_id
                    WHERE l.language = 'en'
                      AND lower(l.lemma) IN (%s)
                      AND (de.definition <> '' OR de.translation_pt_br <> '' OR de.ipa <> '' OR de.cefr <> '')
                    UNION ALL
                    SELECT DISTINCT lower(wf.form) AS term, de.definition, de.translation_pt_br, de.ipa, de.cefr,
                           1 AS match_rank, l.part_of_speech
                    FROM dictionary_entries de
                    JOIN word_forms wf ON wf.lexeme_id = de.lexeme_id
                    JOIN lexemes l ON l.id = de.lexeme_id
                    WHERE l.language = 'en'
                      AND lower(wf.form) IN (%s)
                      AND (de.definition <> '' OR de.translation_pt_br <> '' OR de.ipa <> '' OR de.cefr <> '')
                ) matches
                ORDER BY matches.term, matches.match_rank, matches.part_of_speech
                """.formatted(placeholders, placeholders);
        List<Object> arguments = new ArrayList<>(terms.size() * 2);
        arguments.addAll(terms);
        arguments.addAll(terms);
        jdbc.query(sql, (rs) -> {
            String term = rs.getString("term");
            result.putIfAbsent(term, new LocalEntry(
                    rs.getString("definition"),
                    rs.getString("translation_pt_br"),
                    rs.getString("ipa"),
                    rs.getString("cefr")
            ));
        }, arguments.toArray());
    }

    private static String normalize(String term) {
        return term.trim().toLowerCase(Locale.ROOT);
    }
}
