package br.com.leitormobile.lexicon;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class LexiconDtos {
    private LexiconDtos() {}

    public record JobResponse(
            UUID id, UUID bookId, String status, BigDecimal progress,
            int processedUnits, int totalUnits, int processedTokens, int totalLexemes,
            String phase, String message, String errorMessage, Instant createdAt, Instant startedAt, Instant finishedAt
    ) {
        static JobResponse from(LexiconJob job) {
            return new JobResponse(job.getId(), job.getBook().getId(), job.getStatus(), job.getProgress(),
                    job.getProcessedUnits(), job.getTotalUnits(), job.getProcessedTokens(), job.getTotalLexemes(),
                    job.getPhase(), job.getLastMessage(), job.getErrorMessage(), job.getCreatedAt(), job.getStartedAt(), job.getFinishedAt());
        }
    }

    public record SenseResponse(UUID id, String senseKey, String definition, String translationPtBr) {}

    public record EntryResponse(
            UUID id, UUID bookId, String lemma, String partOfSpeech, List<String> wordForms,
            String definition, String translationPtBr, String ipa, String cefr, int bookFrequency,
            UUID firstSentenceId, String resolutionStatus, String pedagogicalRelevance,
            List<SenseResponse> senses, Instant updatedAt
    ) {}
}
