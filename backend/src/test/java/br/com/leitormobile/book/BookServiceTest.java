package br.com.leitormobile.book;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import br.com.leitormobile.auth.AppUser;
import br.com.leitormobile.auth.CurrentUserService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.web.server.ResponseStatusException;

class BookServiceTest {

    @Test
    void deletingBookRemovesStoredEpubAndAllKnownCoverFiles(@TempDir Path storageRoot) throws IOException {
        UUID bookId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        Path epub = storageRoot.resolve("books").resolve(bookId + ".epub");
        Path cover = storageRoot.resolve("covers").resolve(bookId + ".jpg");
        Path staleCover = storageRoot.resolve("covers").resolve(bookId + ".png");
        Files.createDirectories(epub.getParent());
        Files.createDirectories(cover.getParent());
        Files.writeString(epub, "epub");
        Files.writeString(cover, "cover");
        Files.writeString(staleCover, "stale-cover");

        try {
            AppUser owner = mock(AppUser.class);
            when(owner.getId()).thenReturn(ownerId);
            CurrentUserService currentUser = mock(CurrentUserService.class);
            when(currentUser.require()).thenReturn(owner);
            BookRepository repository = mock(BookRepository.class);
            Book book = new Book(owner, "hash-" + bookId, "book.epub", "Book", "Author", "en");
            book.setFileUri(epub.toString());
            book.setCoverUri(cover.toString());
            when(repository.findByIdAndOwnerId(bookId, ownerId)).thenReturn(Optional.of(book));
            BookContentService contentService = new BookContentService(repository, currentUser, storageRoot.toString());

            new BookService(repository, currentUser, contentService).delete(bookId);

            assertFalse(Files.exists(epub));
            assertFalse(Files.exists(cover));
            assertFalse(Files.exists(staleCover));
            verify(repository).deleteById(bookId);
        } finally {
            Files.deleteIfExists(epub);
            Files.deleteIfExists(cover);
            Files.deleteIfExists(staleCover);
        }
    }

    @Test
    void deletingBookWithContentOutsideStorageFailsWithoutDeletingDatabaseRow() throws IOException {
        UUID bookId = UUID.randomUUID();
        UUID ownerId = UUID.randomUUID();
        Path storageRoot = Files.createTempDirectory("leitor-storage-");
        Path externalFile = Files.createTempFile("leitor-book-", ".epub");

        try {
            AppUser owner = mock(AppUser.class);
            when(owner.getId()).thenReturn(ownerId);
            CurrentUserService currentUser = mock(CurrentUserService.class);
            when(currentUser.require()).thenReturn(owner);
            BookRepository repository = mock(BookRepository.class);
            Book book = new Book(owner, "hash-" + bookId, "book.epub", "Book", "Author", "en");
            book.setFileUri(externalFile.toString());
            when(repository.findByIdAndOwnerId(bookId, ownerId)).thenReturn(Optional.of(book));
            BookContentService contentService = new BookContentService(repository, currentUser, storageRoot.toString());

            assertThrows(ResponseStatusException.class, () -> new BookService(repository, currentUser, contentService).delete(bookId));

            assertTrue(Files.exists(externalFile));
            verify(repository, never()).deleteById(bookId);
        } finally {
            Files.deleteIfExists(externalFile);
            Files.deleteIfExists(storageRoot);
        }
    }
}
