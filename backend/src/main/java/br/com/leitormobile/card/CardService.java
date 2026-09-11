package br.com.leitormobile.card;

import br.com.leitormobile.auth.AppUser;
import br.com.leitormobile.auth.CurrentUserService;
import br.com.leitormobile.book.Book;
import br.com.leitormobile.book.BookRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CardService {

    private final CardRepository repository;
    private final BookRepository bookRepository;
    private final CurrentUserService currentUser;

    public CardService(CardRepository repository, BookRepository bookRepository, CurrentUserService currentUser) {
        this.repository = repository;
        this.bookRepository = bookRepository;
        this.currentUser = currentUser;
    }

    @Transactional(readOnly = true)
    public List<CardDtos.Response> list(boolean includeArchived) {
        AppUser user = currentUser.require();
        List<Card> cards = includeArchived
                ? repository.findAllForOwner(user.getId())
                : repository.findActive(user.getId());
        return cards.stream().map(CardDtos.Response::from).toList();
    }

    @Transactional
    public CardDtos.Response create(CardDtos.CreateRequest request) {
        UUID ownerId = currentUser.require().getId();
        Book book = bookRepository.findByIdAndOwnerId(request.bookId(), ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Livro não encontrado."));
        Card card = new Card(book, request.cfiRange(), request.selectedText(), safe(request.chapterTitle()), repository.findNextQueueOrder(ownerId));
        card.update(new CardDtos.UpdateRequest(
                request.selectedText(), request.translation(), request.pronunciation(), request.partOfSpeech(),
                request.definition(), request.background(), request.examples(), request.relatedWords()
        ));
        return CardDtos.Response.from(repository.save(card));
    }

    @Transactional
    public CardDtos.Response update(UUID id, CardDtos.UpdateRequest request) {
        Card card = find(id);
        card.update(request);
        return CardDtos.Response.from(card);
    }

    @Transactional
    public CardDtos.Response archive(UUID id) {
        Card card = find(id);
        card.archive();
        return CardDtos.Response.from(card);
    }

    @Transactional
    public CardDtos.Response unarchive(UUID id) {
        Card card = find(id);
        card.unarchive();
        return CardDtos.Response.from(card);
    }

    @Transactional
    public CardDtos.Response moveToEnd(UUID id) {
        UUID ownerId = currentUser.require().getId();
        Card card = find(id);
        card.moveToEnd(repository.findNextQueueOrder(ownerId));
        return CardDtos.Response.from(card);
    }

    private Card find(UUID id) {
        return repository.findByIdAndBookOwnerId(id, currentUser.require().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Card não encontrado."));
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}