package br.com.leitormobile.book;

import br.com.leitormobile.auth.AppUser;
import br.com.leitormobile.auth.CurrentUserService;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BookService {

    private final BookRepository repository;
    private final CurrentUserService currentUser;
    private final BookContentService contentService;

    public BookService(
            BookRepository repository,
            CurrentUserService currentUser,
            BookContentService contentService
    ) {
        this.repository = repository;
        this.currentUser = currentUser;
        this.contentService = contentService;
    }

    @Transactional(readOnly = true)
    public List<BookDtos.Response> list(String search) {
        AppUser user = currentUser.require();
        String normalized = search == null ? "" : search.trim();
        List<Book> books = normalized.isEmpty()
                ? repository.findLibrary(user.getId())
                : repository.search(user.getId(), normalized);
        return books.stream().map(BookDtos.Response::from).toList();
    }

    @Transactional
    public BookDtos.Response create(BookDtos.CreateBookRequest request) {
        AppUser user = currentUser.require();
        String hash = request.fileHash() == null || request.fileHash().isBlank()
                ? "manual:" + UUID.randomUUID()
                : request.fileHash().trim();
        if (repository.existsByFileHashAndOwnerId(hash, user.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este livro já está na biblioteca.");
        }
        String fallbackTitle = request.originalName().replaceFirst("(?i)\\.epub$", "");
        Book book = new Book(
                user,
                hash,
                request.originalName().trim(),
                blankOr(request.title(), fallbackTitle),
                blankOr(request.author(), ""),
                blankOr(request.language(), "pt-BR")
        );
        book.setCoverUri(blankOrNull(request.coverUri()));
        book.setDescription(blankOr(request.description(), ""));
        book.setPublisher(blankOr(request.publisher(), ""));
        try {
            return BookDtos.Response.from(repository.save(book));
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Este livro já está na biblioteca.", exception);
        }
    }

    @Transactional
    public BookDtos.Response updateProgress(UUID id, BookDtos.ProgressRequest request) {
        Book book = repository.findByIdAndOwnerId(id, currentUser.require().getId()).orElseThrow(() -> notFound(id));
        book.updateProgress(request.lastCfi(), request.progress() == null ? book.getProgress() : request.progress());
        return BookDtos.Response.from(book);
    }

    @Transactional
    public void delete(UUID id) {
        Book book = repository.findByIdAndOwnerId(id, currentUser.require().getId()).orElseThrow(() -> notFound(id));
        contentService.deleteStoredContent(id, book);
        repository.deleteById(id);
    }

    private ResponseStatusException notFound(UUID id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Livro não encontrado: " + id);
    }

    private static String blankOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static String blankOrNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
