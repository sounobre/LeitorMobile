package br.com.leitormobile.lexicon;

import br.com.leitormobile.auth.CurrentUserService;
import br.com.leitormobile.book.Book;
import br.com.leitormobile.book.BookRepository;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LexiconService {
    private static final Logger LOGGER = LoggerFactory.getLogger(LexiconService.class);
    private final BookRepository books;
    private final LexiconJobRepository jobs;
    private final BookLexemeRepository bookLexemes;
    private final DictionaryEntryRepository dictionaryEntries;
    private final WordFormLookupRepository wordForms;
    private final SenseLookupRepository senses;
    private final CurrentUserService currentUser;
    private final LexiconJobRunner runner;

    public LexiconService(BookRepository books, LexiconJobRepository jobs, BookLexemeRepository bookLexemes,
                          DictionaryEntryRepository dictionaryEntries, WordFormLookupRepository wordForms,
                          SenseLookupRepository senses, CurrentUserService currentUser, LexiconJobRunner runner) {
        this.books = books; this.jobs = jobs; this.bookLexemes = bookLexemes; this.dictionaryEntries = dictionaryEntries;
        this.wordForms = wordForms; this.senses = senses; this.currentUser = currentUser; this.runner = runner;
    }

    public LexiconDtos.JobResponse start(UUID bookId) {
        return start(bookId, false);
    }

    public LexiconDtos.JobResponse start(UUID bookId, boolean force) {
        Book book = ownedBook(bookId);
        var active = jobs.findTopByBookIdAndStatusInOrderByCreatedAtDesc(bookId, List.of("QUEUED", "RUNNING"));
        if (active.isPresent()) return LexiconDtos.JobResponse.from(active.get());

        if (!force) {
            var latest = jobs.findTopByBookIdOrderByCreatedAtDesc(bookId);
            if (latest.filter(job -> "COMPLETED".equals(job.getStatus())).isPresent()) {
                return LexiconDtos.JobResponse.from(latest.get());
            }
        }

        LexiconJob job = jobs.save(new LexiconJob(book));
        LOGGER.info("lexicon_job_queued jobId={} bookId={}", job.getId(), bookId);
        runner.runAsync(job.getId(), book.getId());
        return LexiconDtos.JobResponse.from(job);
    }

    @Transactional(readOnly = true)
    public LexiconDtos.JobResponse status(UUID bookId) {
        ownedBook(bookId);
        return jobs.findTopByBookIdOrderByCreatedAtDesc(bookId)
                .map(LexiconDtos.JobResponse::from)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<LexiconDtos.EntryResponse> list(UUID bookId, String search, int limit) {
        ownedBook(bookId);
        String normalized = search == null ? "" : search.trim().toLowerCase();
        int safeLimit = Math.max(1, Math.min(limit, 2_000));
        return bookLexemes.findForBook(bookId).stream()
                .filter(item -> normalized.isBlank() || item.getLexeme().getLemma().toLowerCase().contains(normalized))
                .limit(safeLimit)
                .map(this::toEntry)
                .toList();
    }

    @Transactional(readOnly = true)
    public LexiconDtos.EntryResponse lookup(UUID bookId, String term) {
        ownedBook(bookId);
        if (term == null || term.isBlank()) return null;
        return bookLexemes.lookup(bookId, term.trim()).stream().findFirst().map(this::toEntry).orElse(null);
    }

    private LexiconDtos.EntryResponse toEntry(BookLexeme item) {
        DictionaryEntry dictionary = dictionaryEntries.findByLexemeId(item.getLexeme().getId()).orElse(null);
        List<LexiconDtos.SenseResponse> senseResponses = dictionary == null ? List.of() : senses.findByDictionaryEntryIdOrderBySenseKeyAsc(dictionary.getId()).stream()
                .map(sense -> new LexiconDtos.SenseResponse(sense.getId(), sense.getSenseKey(), sense.getDefinition(), sense.getTranslationPtBr()))
                .toList();
        return new LexiconDtos.EntryResponse(
                item.getId(), item.getBook().getId(), item.getLexeme().getLemma(), item.getLexeme().getPartOfSpeech(),
                wordForms.findForms(item.getLexeme().getId()), dictionary == null ? "" : dictionary.getDefinition(),
                dictionary == null ? "" : dictionary.getTranslationPtBr(), dictionary == null ? "" : dictionary.getIpa(),
                dictionary == null ? "" : dictionary.getCefr(), item.getFrequency(),
                item.getFirstSentence() == null ? null : item.getFirstSentence().getId(), item.getResolutionStatus(),
                item.getPedagogicalRelevance(), senseResponses, java.time.Instant.now()
        );
    }

    private Book ownedBook(UUID id) {
        return books.findByIdAndOwnerId(id, currentUser.require().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Livro não encontrado."));
    }
}
