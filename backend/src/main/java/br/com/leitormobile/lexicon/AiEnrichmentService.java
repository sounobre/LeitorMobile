package br.com.leitormobile.lexicon;

import br.com.leitormobile.ai.AiProvider;
import br.com.leitormobile.ai.AiTaskType;
import br.com.leitormobile.ai.AiProperties;
import br.com.leitormobile.ai.CopyrightPrivacyGate;
import br.com.leitormobile.ai.ExternalAiContextPolicy;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class AiEnrichmentService {
    private static final Logger LOGGER = LoggerFactory.getLogger(AiEnrichmentService.class);
    private final AiProperties properties;
    private final OllamaAiProvider ollama;
    private final ExternalAiContextPolicy policy;
    private final CopyrightPrivacyGate gate;
    private final AiRequestAuditRepository audits;
    private final DictionaryEntryRepository dictionaries;
    private final LexicalSenseRepository senses;
    private final LexiconJobProgressWriter progressWriter;

    public AiEnrichmentService(AiProperties properties, OllamaAiProvider ollama, ExternalAiContextPolicy policy,
                               CopyrightPrivacyGate gate, AiRequestAuditRepository audits,
                               DictionaryEntryRepository dictionaries, LexicalSenseRepository senses,
                               LexiconJobProgressWriter progressWriter) {
        this.properties = properties; this.ollama = ollama; this.policy = policy; this.gate = gate;
        this.audits = audits; this.dictionaries = dictionaries; this.senses = senses;
        this.progressWriter = progressWriter;
    }

    public void enrich(LexiconJob job, List<BookLexeme> unresolved) {
        if (!properties.isEnabled() || !"ollama".equalsIgnoreCase(properties.getProvider()) || unresolved.isEmpty()) return;
        List<BookLexeme> candidates = unresolved.stream().limit(properties.getOllama().getMaxCandidates()).toList();
        progressWriter.enriching(job.getId(), candidates.size());
        LOGGER.info("lexicon_ai_enrichment_started jobId={} bookId={} candidates={} batchSize=20 model={}",
                job.getId(), job.getBook().getId(), candidates.size(), properties.getOllama().getModel());
        for (int start = 0; start < candidates.size(); start += 20) {
            List<BookLexeme> batch = candidates.subList(start, Math.min(start + 20, candidates.size()));
            List<AiProvider.MetadataCandidate> metadata = batch.stream()
                    .map(item -> new AiProvider.MetadataCandidate(item.getLexeme().getId(), item.getLexeme().getLemma(), item.getLexeme().getPartOfSpeech(), item.getFrequency()))
                    .toList();
            var decision = policy.decideMetadataOnly(AiTaskType.PEDAGOGICAL_EXPLANATION, metadata.size());
            String requestHash = hash(metadata);
            try {
                gate.check("ollama", decision);
                long requestStartedAt = System.currentTimeMillis();
                LOGGER.info("lexicon_ai_batch_started jobId={} bookId={} batchStart={} batchSize={} requestHash={}",
                        job.getId(), job.getBook().getId(), start, batch.size(), requestHash);
                AiProvider.ProviderResponse response = ollama.enrichMetadata(metadata);
                audits.save(new AiRequestAudit(job.getBook(), job, "ollama", properties.getOllama().getModel(),
                        AiTaskType.PEDAGOGICAL_EXPLANATION.name(), false, 0, 0, decision.justification(),
                        response.inputTokens(), response.outputTokens(), "SUCCEEDED", requestHash));
                apply(batch, response.entries());
                LOGGER.info("lexicon_ai_batch_completed jobId={} bookId={} batchStart={} batchSize={} enrichedEntries={} inputTokens={} outputTokens={} durationMs={}",
                        job.getId(), job.getBook().getId(), start, batch.size(), response.entries().size(), response.inputTokens(), response.outputTokens(),
                        System.currentTimeMillis() - requestStartedAt);
            } catch (RuntimeException exception) {
                LOGGER.warn("lexicon_ai_batch_failed jobId={} bookId={} batchStart={} batchSize={} requestHash={} message={}",
                        job.getId(), job.getBook().getId(), start, batch.size(), requestHash, safeMessage(exception));
                audits.save(new AiRequestAudit(job.getBook(), job, "ollama", properties.getOllama().getModel(),
                        AiTaskType.PEDAGOGICAL_EXPLANATION.name(), false, 0, 0,
                        decision.justification() + " Falha: " + safeMessage(exception), null, null, "ERROR", requestHash));
                // A preparação lexical local continua válida mesmo sem o modelo instalado ou disponível.
            }
        }
        LOGGER.info("lexicon_ai_enrichment_completed jobId={} bookId={} candidates={}", job.getId(), job.getBook().getId(), candidates.size());
    }

    private void apply(List<BookLexeme> batch, List<AiProvider.MetadataEnrichment> enrichments) {
        Map<String, BookLexeme> byKey = new HashMap<>();
        for (BookLexeme item : batch) byKey.put(key(item.getLexeme().getLemma(), item.getLexeme().getPartOfSpeech()), item);
        for (AiProvider.MetadataEnrichment enrichment : enrichments) {
            BookLexeme item = byKey.get(key(enrichment.lemma(), enrichment.partOfSpeech()));
            if (item == null) continue;
            DictionaryEntry dictionary = dictionaries.findByLexemeId(item.getLexeme().getId()).orElseGet(() -> dictionaries.save(new DictionaryEntry(item.getLexeme())));
            dictionary.enrich(enrichment.definition(), enrichment.translationPtBr(), enrichment.ipa(), enrichment.cefr(), "OLLAMA_LOCAL");
            if (!enrichment.senseKey().isBlank()) {
                senses.findByDictionaryEntryIdAndSenseKey(dictionary.getId(), enrichment.senseKey())
                        .orElseGet(() -> senses.save(new LexicalSense(dictionary, enrichment.senseKey(), enrichment.definition(), enrichment.translationPtBr(), enrichment.cefr(), "OLLAMA_LOCAL")));
            }
            item.resolve("RESOLVED_LOCAL", item.getFrequency() >= 3 ? "RECOMMENDED" : "OPTIONAL");
        }
    }

    private static String key(String lemma, String pos) { return lemma + "|" + pos; }
    private static String hash(List<AiProvider.MetadataCandidate> metadata) {
        try {
            String value = metadata.stream().map(item -> item.lemma() + "|" + item.partOfSpeech() + "|" + item.bookFrequency()).reduce("", String::concat);
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) { return null; }
    }
    private static String safeMessage(Throwable exception) { return exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage().substring(0, Math.min(500, exception.getMessage().length())); }
}

