package br.com.leitormobile.ai;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ExternalAiExposurePolicyTest {
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

