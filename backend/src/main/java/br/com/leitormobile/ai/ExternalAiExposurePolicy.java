package br.com.leitormobile.ai;

import java.util.Collection;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Technical aggregate guard. Its limits are conservative engineering controls,
 * not a legal safe-harbor or a percentage authorization for copyrighted works.
 */
@Component
public class ExternalAiExposurePolicy {
    static final int MAX_EXCERPT_REQUESTS = 20;
    static final int MAX_EXCERPT_CHARACTERS = 12_000;
    static final int MAX_UNIQUE_SOURCE_SENTENCES = 20;
    static final int MAX_UNIQUE_READING_UNITS = 10;

    private final Map<UUID, ExposureBucket> buckets = new ConcurrentHashMap<>();

    public ExternalContextDecision reserve(
            UUID bookId,
            ExternalContextDecision decision,
            Collection<String> sourceSentenceIds,
            Collection<String> readingUnitIds
    ) {
        if (!decision.allowed() || !decision.copyrightedTextRequired()) return decision;
        if (bookId == null) return ExternalContextDecision.blocked("A exposição externa exige um livro identificado.");

        ExposureBucket bucket = buckets.computeIfAbsent(bookId, ignored -> new ExposureBucket());
        synchronized (bucket) {
            Set<String> sentences = normalizedIds(sourceSentenceIds);
            Set<String> units = normalizedIds(readingUnitIds);
            int nextRequests = bucket.excerptRequests + 1;
            int nextCharacters = bucket.excerptCharacters + decision.totalCharacters();
            int nextSentences = bucket.sourceSentences.size() + sentences.stream().filter(id -> !bucket.sourceSentences.contains(id)).toList().size();
            int nextUnits = bucket.readingUnits.size() + units.stream().filter(id -> !bucket.readingUnits.contains(id)).toList().size();
            if (nextRequests > MAX_EXCERPT_REQUESTS
                    || nextCharacters > MAX_EXCERPT_CHARACTERS
                    || nextSentences > MAX_UNIQUE_SOURCE_SENTENCES
                    || nextUnits > MAX_UNIQUE_READING_UNITS) {
                return ExternalContextDecision.blocked(
                        "A proteção de exposição acumulada bloqueou a chamada; reduza o contexto ou resolva localmente."
                );
            }
            bucket.excerptRequests = nextRequests;
            bucket.excerptCharacters = nextCharacters;
            bucket.excerptCount += decision.excerpts().size();
            bucket.sourceSentences.addAll(sentences);
            bucket.readingUnits.addAll(units);
            return decision;
        }
    }

    public ExternalAiExposureMetrics metrics(UUID bookId, int bookCharacterCount) {
        ExposureBucket bucket = buckets.get(bookId);
        if (bucket == null) return new ExternalAiExposureMetrics(bookId, 0, 0, 0, 0, 0, 0);
        synchronized (bucket) {
            double ratio = bookCharacterCount <= 0
                    ? 0
                    : Math.min(1, (double) bucket.excerptCharacters / bookCharacterCount);
            return new ExternalAiExposureMetrics(
                    bookId,
                    bucket.excerptRequests,
                    bucket.excerptCharacters,
                    bucket.excerptCount,
                    bucket.sourceSentences.size(),
                    bucket.readingUnits.size(),
                    ratio
            );
        }
    }

    public void reset(UUID bookId) {
        if (bookId != null) buckets.remove(bookId);
    }

    private static Set<String> normalizedIds(Collection<String> values) {
        if (values == null || values.isEmpty()) return Set.of();
        Set<String> normalized = new HashSet<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) normalized.add(value.trim());
        }
        return normalized;
    }

    private static final class ExposureBucket {
        private int excerptRequests;
        private int excerptCharacters;
        private int excerptCount;
        private final Set<String> sourceSentences = new HashSet<>();
        private final Set<String> readingUnits = new HashSet<>();
    }
}
