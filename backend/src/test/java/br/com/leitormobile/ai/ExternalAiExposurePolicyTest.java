package br.com.leitormobile.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ExternalAiExposurePolicyTest {
    @Test
    void metadataOnlyDecisionDoesNotConsumeExposure() {
        ExternalAiExposurePolicy exposure = new ExternalAiExposurePolicy();
        ExternalContextDecision decision = new ExternalAiContextPolicy()
                .decideMetadataOnly(AiTaskType.PEDAGOGICAL_EXPLANATION, 2);
        UUID bookId = UUID.randomUUID();

        ExternalAiExposureMetrics before = exposure.metrics(bookId, 1_000);
        ExternalContextDecision reserved = exposure.reserve(
                bookId,
                decision,
                List.of("metadata-only-source"),
                List.of("metadata-only-unit")
        );

        assertTrue(reserved.allowed());
        assertFalse(reserved.copyrightedTextRequired());
        assertEquals(before, exposure.metrics(bookId, 1_000));
    }

    @Test
    void blockedDecisionDoesNotConsumeExposure() {
        ExternalAiExposurePolicy exposure = new ExternalAiExposurePolicy();
        ExternalContextDecision decision = new ExternalAiContextPolicy()
                .decideMetadataOnly(AiTaskType.PEDAGOGICAL_EXPLANATION, 0);
        UUID bookId = UUID.randomUUID();

        ExternalContextDecision reserved = exposure.reserve(
                bookId,
                decision,
                List.of("blocked-source"),
                List.of("blocked-unit")
        );

        assertFalse(reserved.allowed());
        assertEquals(new ExternalAiExposureMetrics(bookId, 0, 0, 0, 0, 0, 0), exposure.metrics(bookId, 1_000));
    }

    @Test
    void allowedShortContextUpdatesExposureMetrics() {
        ExternalAiExposurePolicy exposure = new ExternalAiExposurePolicy();
        ExternalContextDecision decision = new ExternalAiContextPolicy()
                .decideWithContext(AiTaskType.SENSE_RESOLUTION, List.of("A short sentence."));
        UUID bookId = UUID.randomUUID();

        ExternalContextDecision reserved = exposure.reserve(
                bookId,
                decision,
                List.of("sentence-1"),
                List.of("unit-1")
        );
        ExternalAiExposureMetrics metrics = exposure.metrics(bookId, 100);

        assertTrue(reserved.allowed());
        assertTrue(reserved.copyrightedTextRequired());
        assertEquals(1, metrics.excerptRequests());
        assertEquals(decision.totalCharacters(), metrics.excerptCharacters());
        assertEquals(1, metrics.excerptCount());
        assertEquals(1, metrics.uniqueSourceSentences());
        assertEquals(1, metrics.uniqueReadingUnits());
        assertEquals(decision.totalCharacters() / 100.0, metrics.bookCoverageRatio());
    }

    @Test
    void blocksProgressiveSmallRequestsForTheSameBook() {
        ExternalAiExposurePolicy exposure = new ExternalAiExposurePolicy();
        ExternalAiContextPolicy context = new ExternalAiContextPolicy();
        UUID bookId = UUID.randomUUID();
        int allowed = 0;

        for (int index = 0; index < 100; index++) {
            ExternalContextDecision decision = context.decideWithContext(
                    AiTaskType.SENSE_RESOLUTION,
                    List.of("A short sentence for one lexical decision.")
            );
            ExternalContextDecision reserved = exposure.reserve(
                    bookId,
                    decision,
                    List.of("sentence-" + index),
                    List.of("unit-" + (index / 2))
            );
            if (!reserved.allowed()) {
                assertTrue(index <= 20);
                break;
            }
            allowed++;
        }

        assertTrue(allowed == 20);
        assertTrue(allowed < 100);
        assertFalse(exposure.metrics(bookId, 100_000).bookCoverageRatio() < 0);
    }
}
