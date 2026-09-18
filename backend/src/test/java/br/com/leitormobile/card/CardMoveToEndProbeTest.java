package br.com.leitormobile.card;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.leitormobile.LeitorBackendApplication;
import br.com.leitormobile.auth.AppUser;
import br.com.leitormobile.auth.AppUserRepository;
import br.com.leitormobile.auth.SessionToken;
import br.com.leitormobile.auth.SessionTokenRepository;
import br.com.leitormobile.book.Book;
import br.com.leitormobile.book.BookRepository;
import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(classes = LeitorBackendApplication.class)
@AutoConfigureMockMvc
class CardMoveToEndProbeTest extends PostgresIntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private SessionTokenRepository sessionTokenRepository;

    @Autowired
    private BookRepository bookRepository;

    @Autowired
    private CardRepository cardRepository;

    private AppUser owner;
    private SessionToken session;
    private Book book;
    private String token;
    private final List<UUID> fixtureCardIds = new ArrayList<>();

    @BeforeEach
    void createSyntheticOwnerBookAndSession() {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        owner = userRepository.saveAndFlush(
                new AppUser("wave2.queue.move." + suffix + "@example.invalid", "fixture-only-password-hash")
        );
        token = "wave2-queue-move-token-" + suffix;
        session = sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(token), owner, Instant.now().plusSeconds(3600))
        );
        book = bookRepository.saveAndFlush(new Book(
                owner,
                "wave2-queue-move-" + suffix,
                "queue-move-probe.epub",
                "Queue move probe",
                "Synthetic author",
                "en"
        ));
    }

    @AfterEach
    void removeFixtureState() {
        if (!fixtureCardIds.isEmpty()) {
            cardRepository.deleteAllById(fixtureCardIds);
            cardRepository.flush();
            fixtureCardIds.clear();
        }
        if (book != null) {
            bookRepository.delete(book);
            bookRepository.flush();
            book = null;
        }
        if (session != null) {
            sessionTokenRepository.delete(session);
            sessionTokenRepository.flush();
            session = null;
        }
        if (owner != null) {
            userRepository.delete(owner);
            userRepository.flush();
            owner = null;
        }
    }

    @Test
    void movingNonFinalCardProducesAStrictlyFinalPositionOrDiagnosticEvidence() throws Exception {
        Card first = persistCard("queue-move-card-a", 10);
        Card middle = persistCard("queue-move-card-b", 20);
        Card last = persistCard("queue-move-card-c", 30);

        List<Card> initialCards = cardRepository.findActive(owner.getId());
        int maxQueueOrderBeforeMove = initialCards.stream()
                .mapToInt(Card::getQueueOrder)
                .max()
                .orElseThrow();
        int nextQueueOrderBeforeMove = cardRepository.findNextQueueOrder(owner.getId());

        mockMvc.perform(post("/api/cards/{id}/move-to-end", first.getId())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk());

        List<Card> finalCards = cardRepository.findActive(owner.getId());
        Card movedCard = cardRepository.findById(first.getId()).orElseThrow();
        int nextQueueOrderAfterMove = cardRepository.findNextQueueOrder(owner.getId());
        int maxOtherQueueOrder = finalCards.stream()
                .filter(card -> !card.getId().equals(first.getId()))
                .mapToInt(Card::getQueueOrder)
                .max()
                .orElseThrow();
        boolean movedStrictlyAfterAllOthers = movedCard.getQueueOrder() > maxOtherQueueOrder
                && finalCards.get(finalCards.size() - 1).getId().equals(first.getId());

        assertTrue(movedStrictlyAfterAllOthers,
                "TEST-042 move-to-end probe observed a non-final or duplicate queueOrder; "
                        + "initialOrder=" + observations(initialCards)
                        + "; finalOrder=" + observations(finalCards)
                        + "; movedCard=" + observe(movedCard)
                        + "; oldLastCard=" + observe(last)
                        + "; middleCard=" + observe(middle)
                        + "; maxQueueOrderBeforeMove=" + maxQueueOrderBeforeMove
                        + "; maxOtherQueueOrderAfterMove=" + maxOtherQueueOrder
                        + "; findNextQueueOrderBefore=" + nextQueueOrderBeforeMove
                        + "; findNextQueueOrderAfter=" + nextQueueOrderAfterMove);
    }

    private Card persistCard(String selectedText, int queueOrder) {
        Card card = new Card(
                book,
                "epubcfi(/8/" + queueOrder + ")",
                selectedText,
                "Queue move chapter",
                queueOrder
        );
        card.update(new CardDtos.UpdateRequest(
                selectedText,
                "translation-" + selectedText,
                "pronunciation-" + selectedText,
                "noun",
                "definition-" + selectedText,
                "background-" + selectedText,
                List.of("example-" + selectedText),
                List.of("related-" + selectedText)
        ));
        Card saved = cardRepository.saveAndFlush(card);
        fixtureCardIds.add(saved.getId());
        return saved;
    }

    private static CardObservation observe(Card card) {
        return new CardObservation(
                card.getId(),
                card.getSelectedText(),
                card.getQueueOrder(),
                card.getCreatedAt(),
                card.getUpdatedAt()
        );
    }

    private static List<CardObservation> observations(List<Card> cards) {
        return cards.stream().map(CardMoveToEndProbeTest::observe).toList();
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException exception) {
            throw new AssertionError("SHA-256 is required for the token fixture", exception);
        }
    }

    private record CardObservation(
            UUID id,
            String selectedText,
            Integer queueOrder,
            Instant createdAt,
            Instant updatedAt
    ) {}
}
