package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import br.com.leitormobile.auth.AppUser;
import br.com.leitormobile.auth.CurrentUserService;
import br.com.leitormobile.book.Book;
import br.com.leitormobile.book.BookRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LexiconServiceTest {

    @Test
    void doesNotCreateAnotherJobWhenLatestJobIsCompleted() {
        TestContext context = contextWithCompletedJob();

        assertEquals("COMPLETED", context.service.start(context.bookId).status());
        verify(context.jobs, never()).save(any(LexiconJob.class));
        verifyNoInteractions(context.runner);
    }

    @Test
    void forceCreatesANewJobWhenLatestJobIsCompleted() {
        TestContext context = contextWithCompletedJob();
        LexiconJob queued = new LexiconJob(context.book);
        when(context.jobs.save(any(LexiconJob.class))).thenReturn(queued);

        assertEquals("QUEUED", context.service.start(context.bookId, true).status());
        verify(context.jobs).save(any(LexiconJob.class));
        verify(context.runner).runAsync(isNull(), eq(context.bookId));
    }

    private static TestContext contextWithCompletedJob() {
        UUID bookId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        AppUser owner = mock(AppUser.class);
        Book book = mock(Book.class);
        when(owner.getId()).thenReturn(ownerId);
        when(book.getId()).thenReturn(bookId);

        BookRepository books = mock(BookRepository.class);
        LexiconJobRepository jobs = mock(LexiconJobRepository.class);
        LexiconJobRunner runner = mock(LexiconJobRunner.class);
        CurrentUserService currentUser = mock(CurrentUserService.class);
        when(currentUser.require()).thenReturn(owner);
        when(books.findByIdAndOwnerId(bookId, ownerId)).thenReturn(Optional.of(book));
        when(jobs.findTopByBookIdAndStatusInOrderByCreatedAtDesc(bookId, List.of("QUEUED", "RUNNING")))
                .thenReturn(Optional.empty());

        LexiconJob completed = new LexiconJob(book);
        completed.complete(1, 10, 3);
        when(jobs.findTopByBookIdOrderByCreatedAtDesc(bookId)).thenReturn(Optional.of(completed));

        LexiconService service = new LexiconService(
                books, jobs, mock(BookLexemeRepository.class), mock(DictionaryEntryRepository.class),
                mock(WordFormLookupRepository.class), mock(SenseLookupRepository.class), currentUser, runner);
        return new TestContext(bookId, book, jobs, runner, service);
    }

    private record TestContext(UUID bookId, Book book, LexiconJobRepository jobs, LexiconJobRunner runner, LexiconService service) {}
}
