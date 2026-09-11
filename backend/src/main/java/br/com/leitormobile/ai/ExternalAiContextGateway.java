package br.com.leitormobile.ai;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Single authorization seam for future context-bearing provider calls.
 * Callers must send only the excerpts from the returned decision.
 */
@Service
public class ExternalAiContextGateway {
    private final ExternalAiContextPolicy contextPolicy;
    private final ExternalAiExposurePolicy exposurePolicy;
    private final CopyrightPrivacyGate privacyGate;

    public ExternalAiContextGateway(
            ExternalAiContextPolicy contextPolicy,
            ExternalAiExposurePolicy exposurePolicy,
            CopyrightPrivacyGate privacyGate
    ) {
        this.contextPolicy = contextPolicy;
        this.exposurePolicy = exposurePolicy;
        this.privacyGate = privacyGate;
    }

    public ExternalContextDecision authorize(
            UUID bookId,
            String provider,
            AiTaskType task,
            List<String> excerpts,
            Collection<String> sourceSentenceIds,
            Collection<String> readingUnitIds
    ) {
        ExternalContextDecision decision = contextPolicy.decideWithContext(task, excerpts);
        decision = exposurePolicy.reserve(bookId, decision, sourceSentenceIds, readingUnitIds);
        privacyGate.check(provider, decision);
        return decision;
    }
}
