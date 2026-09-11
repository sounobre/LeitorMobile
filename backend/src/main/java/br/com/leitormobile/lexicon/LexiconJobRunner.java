package br.com.leitormobile.lexicon;

import br.com.leitormobile.book.Book;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.scheduling.annotation.Async;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class LexiconJobRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(LexiconJobRunner.class);
    private final LexiconJobRepository jobs;
    private final ReadingUnitRepository units;
    private final SentenceRepository sentences;
    private final LexemeRepository lexemes;
    private final WordFormRepository wordForms;
    private final DictionaryEntryRepository dictionaries;
    private final BookLexemeRepository bookLexemes;
    private final TokenOccurrenceRepository occurrences;
    private final EpubTextExtractor extractor;
    private final LexicalAnalyzer analyzer;
    private final LocalLexicalDictionary localDictionary;
    private final AiEnrichmentService aiEnrichment;
    private final LexiconJobProgressWriter progressWriter;

    public LexiconJobRunner(LexiconJobRepository jobs, ReadingUnitRepository units, SentenceRepository sentences,
                            LexemeRepository lexemes, WordFormRepository wordForms, DictionaryEntryRepository dictionaries,
                            BookLexemeRepository bookLexemes, TokenOccurrenceRepository occurrences,
                            EpubTextExtractor extractor, LexicalAnalyzer analyzer, LocalLexicalDictionary localDictionary,
                            AiEnrichmentService aiEnrichment, LexiconJobProgressWriter progressWriter) {
        this.jobs = jobs; this.units = units; this.sentences = sentences; this.lexemes = lexemes; this.wordForms = wordForms;
        this.dictionaries = dictionaries; this.bookLexemes = bookLexemes; this.occurrences = occurrences;
        this.extractor = extractor; this.analyzer = analyzer; this.localDictionary = localDictionary; this.aiEnrichment = aiEnrichment;
        this.progressWriter = progressWriter;
    }

    @Async
    @Transactional
    public void runAsync(java.util.UUID jobId, java.util.UUID bookId) {
        LexiconJob job = jobs.findById(jobId).orElse(null);
        if (job == null) {
            LOGGER.warn("lexicon_job_missing jobId={} bookId={}", jobId, bookId);
            return;
        }
        Instant startedAt = Instant.now();
        try {
            Book book = job.getBook();
            LOGGER.info("lexicon_job_started jobId={} bookId={}", jobId, bookId);
            var extracted = extractor.extract(book);
            progressWriter.started(jobId, extracted.units().size());
            LOGGER.info("lexicon_units_extracted jobId={} bookId={} totalUnits={}", jobId, bookId, extracted.units().size());
            occurrences.deleteByBookId(bookId);
            bookLexemes.deleteByBookId(bookId);
            units.deleteByBookId(bookId);

            Map<String, BookLexeme> bookLexemeCache = new HashMap<>();
            Set<String> formCache = new HashSet<>();
            LexicalDictionaryCache dictionaryCache = new LexicalDictionaryCache(localDictionary);
            int tokenCount = 0;
            for (var extractedUnit : extracted.units()) {
                ReadingUnit unit = units.save(new ReadingUnit(book, extractedUnit.index(), extractedUnit.href(), extractedUnit.title(), extractedUnit.textHash(), extractedUnit.text().length(), extractedUnit.sentences().size()));
                for (var extractedSentence : extractedUnit.sentences()) {
                    Sentence sentence = sentences.save(new Sentence(unit, extractedSentence.index(), extractedSentence.textHash(), extractedSentence.text().length(), extractedSentence.startOffset(), extractedSentence.endOffset()));
                    for (var token : extractedSentence.tokens()) {
                        LexicalAnalyzer.AnalyzedToken analyzed = analyzer.analyze(token);
                        if (analyzed.lemma().length() < 2) continue;
                        String language = normalizedLanguage(book.getLanguage());
                        Lexeme lexeme = lexemes.findByLanguageAndLemmaAndPartOfSpeech(language, analyzed.lemma(), analyzed.partOfSpeech())
                                .orElseGet(() -> lexemes.findBestMatch(language, analyzed.lemma(), analyzed.surface(), analyzed.partOfSpeech())
                                        .stream().findFirst().orElseGet(() -> lexemes.save(new Lexeme(language, analyzed.lemma(), analyzed.partOfSpeech()))));
                        String formKey = lexeme.getId() + "|" + analyzed.surface().toLowerCase();
                        if (formCache.add(formKey) && !wordForms.existsByLexemeIdAndForm(lexeme.getId(), analyzed.surface().toLowerCase())) {
                            wordForms.save(new WordForm(lexeme, analyzed.surface().toLowerCase()));
                        }
                        String bookKey = book.getId() + "|" + lexeme.getId();
                        BookLexeme bookLexeme = bookLexemeCache.computeIfAbsent(bookKey, ignored -> bookLexemes.findByBookIdAndLexemeId(book.getId(), lexeme.getId()).orElseGet(() -> new BookLexeme(book, lexeme, sentence)));
                        bookLexeme.increment(sentence);
                        dictionaryCache.find(lexeme.getLemma()).ifPresent(value -> {
                            DictionaryEntry dictionary = dictionaries.findByLexemeId(lexeme.getId()).orElseGet(() -> dictionaries.save(new DictionaryEntry(lexeme)));
                            dictionary.enrich(value.definition(), value.translationPtBr(), value.ipa(), value.cefr(), "LOCAL");
                            bookLexeme.resolve("RESOLVED_LOCAL", bookLexeme.getFrequency() >= 3 ? "RECOMMENDED" : "OPTIONAL");
                        });
                        occurrences.save(new TokenOccurrence(book, sentence, lexeme, analyzed.surface(), analyzed.startOffset(), analyzed.endOffset()));
                        tokenCount++;
                    }
                }
                progressWriter.progress(jobId, extractedUnit.index() + 1, tokenCount, bookLexemeCache.size());
                LOGGER.info("lexicon_unit_processed jobId={} bookId={} unit={}/{} processedTokens={} totalLexemes={}",
                        jobId, bookId, extractedUnit.index() + 1, extracted.units().size(), tokenCount, bookLexemeCache.size());
            }
            bookLexemes.saveAll(bookLexemeCache.values());
            var unresolved = bookLexemeCache.values().stream().filter(item -> "UNRESOLVED".equals(item.getResolutionStatus())).toList();
            LOGGER.info("lexicon_ai_enrichment_requested jobId={} bookId={} candidates={}", jobId, bookId, unresolved.size());
            aiEnrichment.enrich(job, unresolved);
            progressWriter.completed(jobId, extracted.units().size(), tokenCount, bookLexemeCache.size());
            LOGGER.info("lexicon_job_completed jobId={} bookId={} processedUnits={} processedTokens={} totalLexemes={} durationMs={}",
                    jobId, bookId, extracted.units().size(), tokenCount, bookLexemeCache.size(), Duration.between(startedAt, Instant.now()).toMillis());
        } catch (Exception exception) {
            String message = safeMessage(exception);
            progressWriter.failed(jobId, message);
            LOGGER.error("lexicon_job_failed jobId={} bookId={} message={} durationMs={}",
                    jobId, bookId, message, Duration.between(startedAt, Instant.now()).toMillis(), exception);
        }
    }

    private static String safeMessage(Throwable exception) {
        String message = exception.getMessage();
        if (message == null || message.isBlank()) return "Não foi possível preparar o dicionário do livro.";
        return message.substring(0, Math.min(500, message.length()));
    }

    private static String normalizedLanguage(String language) {
        if (language == null || language.isBlank()) return "en";
        String normalized = language.toLowerCase().split("[-_]")[0];
        return normalized.matches("[a-z]{2,3}") ? normalized : "en";
    }
}
