package br.com.leitormobile.ai;

import java.util.UUID;

public record ExternalAiExposureMetrics(
        UUID bookId,
        int excerptRequests,
        int excerptCharacters,
        int excerptCount,
        int uniqueSourceSentences,
        int uniqueReadingUnits,
        double bookCoverageRatio
) {}
