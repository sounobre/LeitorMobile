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
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(classes = LeitorBackendApplication.class)
@AutoConfigureMockMvc
class CardQueueOrderProbeTest extends PostgresIntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

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
                new AppUser("wave2.queue.create." + suffix + "@example.invalid", "fixture-only-password-hash")
        );
        token = "wave2-queue-create-token-" + suffix;
        session = sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(token), owner, Instant.now().plusSeconds(3600))
        );
        book = bookRepository.saveAndFlush(new Book(
                owner,
                "wave2-queue-create-" + suffix,
                "queue-order-probe.epub",
                "Queue order probe",
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
    void sequentialCreationProducesStrictlyIncreasingQueueOrdersOrDiagnosticEvidence() throws Exception {
        assertTrue(cardRepository.findActive(owner.getId()).isEmpty(),
                "TEST-041 fixture must start without active cards");

        List<CardObservation> createdCards = new ArrayList<>();
        List<Integer> nextQueueOrderBeforeCreation = new ArrayList<>();
        List<Integer> nextQueueOrderAfterCreation = new ArrayList<>();

        for (int index = 1; index <= 3; index++) {
            nextQueueOrderBeforeCreation.add(cardRepository.findNextQueueOrder(owner.getId()));

            String selectedText = "queue-create-card-" + index;
            CardDtos.CreateRequest request = new CardDtos.CreateRequest(
                    book.getId(),
                    "epubcfi(/6/" + (index * 2) + ")",
                    selectedText,
                    "Queue chapter",
                    "translation-" + index,
                    "pronunciation-" + index,
                    "noun",
                    "definition-" + index,
                    "background-" + index,
                    List.of("example-" + index),
                    List.of("related-" + index)
            );

            String response = mockMvc.perform(post("/api/cards")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsBytes(request)))
                    .andExpect(status().isCreated())
                    .andReturn()
                    .getResponse()
                    .getContentAsString();

            UUID cardId = UUID.fromString(objectMapper.readTree(response).get("id").asText());
            fixtureCardIds.add(cardId);
            Card persisted = cardRepository.findById(cardId).orElseThrow();
            createdCards.add(observe(persisted));
            nextQueueOrderAfterCreation.add(cardRepository.findNextQueueOrder(owner.getId()));
        }

        List<Card> returnedCards = cardRepository.findActive(owner.getId());
        List<Integer> createdQueueOrders = createdCards.stream()
                .map(CardObservation::queueOrder)
                .toList();
        boolean strictlyIncreasing = isStrictlyIncreasing(createdQueueOrders);

        assertTrue(strictlyIncreasing,
                "TEST-041 queueOrder probe observed a non-distinguishable or anomalous progression; "
                        + "createdCards=" + createdCards
                        + "; returnedOrder=" + observations(returnedCards)
                        + "; findNextQueueOrderBefore=" + nextQueueOrderBeforeCreation
                        + "; findNextQueueOrderAfter=" + nextQueueOrderAfterCreation);
    }

    private static CardObservation observe(Card card) {
        return new CardObservation(card.getId(), card.getSelectedText(), card.getQueueOrder(), card.getCreatedAt());
    }

    private static List<CardObservation> observations(List<Card> cards) {
        return cards.stream().map(CardQueueOrderProbeTest::observe).toList();
    }

    private static boolean isStrictlyIncreasing(List<Integer> values) {
        for (int index = 1; index < values.size(); index++) {
            if (values.get(index) <= values.get(index - 1)) {
                return false;
            }
        }
        return true;
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

    private record CardObservation(UUID id, String selectedText, Integer queueOrder, Instant createdAt) {}
}
