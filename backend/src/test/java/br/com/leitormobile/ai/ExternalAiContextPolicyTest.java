package br.com.leitormobile.ai;

import static org.junit.jupiter.api.Assertions.*;
import java.util.List;
import org.junit.jupiter.api.Test;

class ExternalAiContextPolicyTest {
    private final ExternalAiContextPolicy policy = new ExternalAiContextPolicy();

    @Test
    void metadataTasksNeverCarryBookText() {
        ExternalContextDecision decision = policy.decideMetadataOnly(AiTaskType.PEDAGOGICAL_EXPLANATION, 3);
        assertTrue(decision.allowed());
        assertFalse(decision.copyrightedTextRequired());
        assertTrue(decision.excerpts().isEmpty());
        assertEquals(0, decision.totalCharacters());
    }

    @Test
    void contextMustBeOneShortOccurrence() {
        ExternalContextDecision decision = policy.decideWithContext(AiTaskType.SENSE_RESOLUTION, List.of("A short sentence."));
        assertTrue(decision.allowed());
        assertTrue(decision.copyrightedTextRequired());
        assertEquals(1, decision.excerpts().size());
    }

    @Test
    void longOrMultipleExcerptsAreBlocked() {
        assertFalse(policy.decideWithContext(AiTaskType.SENSE_RESOLUTION, List.of("one", "two")).allowed());
        assertFalse(policy.decideWithContext(AiTaskType.SENSE_RESOLUTION, List.of("x".repeat(601))).allowed());
    }
}
