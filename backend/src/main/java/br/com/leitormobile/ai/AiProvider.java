package br.com.leitormobile.ai;

import java.util.List;
import java.util.UUID;

public interface AiProvider {
    ProviderResponse enrichMetadata(List<MetadataCandidate> candidates);

    record MetadataCandidate(UUID lexemeId, String lemma, String partOfSpeech, int bookFrequency) {}

    record MetadataEnrichment(
            String lemma,
            String partOfSpeech,
            String definition,
            String translationPtBr,
            String ipa,
            String cefr,
            String senseKey,
            double confidence
    ) {}

    record ProviderResponse(List<MetadataEnrichment> entries, Integer inputTokens, Integer outputTokens) {}
}
