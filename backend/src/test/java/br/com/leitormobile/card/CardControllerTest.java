package br.com.leitormobile.card;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(classes = LeitorBackendApplication.class)
@AutoConfigureMockMvc
class CardControllerTest extends PostgresIntegrationTestSupport {

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

    private AppUser ownerA;
    private AppUser ownerB;
    private SessionToken sessionA;
    private SessionToken sessionB;
    private String tokenA;
    private String tokenB;
    private final List<UUID> fixtureBookIds = new ArrayList<>();
    private final List<UUID> fixtureCardIds = new ArrayList<>();

    @BeforeEach
    void createSyntheticOwnersAndSessions() {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        ownerA = userRepository.saveAndFlush(
                new AppUser("wave1c.owner.a." + suffix + "@example.invalid", "fixture-only-password-hash")
        );
        ownerB = userRepository.saveAndFlush(
                new AppUser("wave1c.owner.b." + suffix + "@example.invalid", "fixture-only-password-hash")
        );

        tokenA = "wave1c-token-a-" + suffix;
        tokenB = "wave1c-token-b-" + suffix;
        sessionA = sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(tokenA), ownerA, Instant.now().plusSeconds(3600))
        );
        sessionB = sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(tokenB), ownerB, Instant.now().plusSeconds(3600))
        );
    }

    @AfterEach
    void removeFixtureState() {
        if (!fixtureCardIds.isEmpty()) {
            cardRepository.deleteAllById(fixtureCardIds);
            cardRepository.flush();
        }
        if (!fixtureBookIds.isEmpty()) {
            bookRepository.deleteAllById(fixtureBookIds);
            bookRepository.flush();
        }
        if (sessionA != null) {
            sessionTokenRepository.delete(sessionA);
        }
        if (sessionB != null) {
            sessionTokenRepository.delete(sessionB);
        }
        sessionTokenRepository.flush();
        if (ownerA != null) {
            userRepository.delete(ownerA);
        }
        if (ownerB != null) {
            userRepository.delete(ownerB);
        }
        userRepository.flush();
        fixtureCardIds.clear();
        fixtureBookIds.clear();
    }

    @Test
    void listIsOwnerScopedAndFiltersArchivedCardsWithoutOrderAssumptions() throws Exception {
        Book ownerABook = seedBook(ownerA, "list-a");
        Book ownerBBook = seedBook(ownerB, "list-b");
        Card ownerAActive = seedCard(ownerABook, "epubcfi(/6/2)", "owner-a-active", false);
        Card ownerAArchived = seedCard(ownerABook, "epubcfi(/6/4)", "owner-a-archived", true);
        Card ownerBActive = seedCard(ownerBBook, "epubcfi(/6/2)", "owner-b-active", false);
        Card ownerBArchived = seedCard(ownerBBook, "epubcfi(/6/4)", "owner-b-archived", true);

        assertCards(list(tokenA, null), ownerAActive);
        assertCards(list(tokenA, true), ownerAActive, ownerAArchived);
        assertCards(list(tokenB, null), ownerBActive);
        assertCards(list(tokenB, true), ownerBActive, ownerBArchived);

        mockMvc.perform(get("/api/cards"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/cards").header(HttpHeaders.AUTHORIZATION, bearer("invalid-wave-1c-token")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void createBindsBookOwnerValidatesRequiredFieldsAndAppliesNullDefaults() throws Exception {
        Book ownerABook = seedBook(ownerA, "create-a");
        Book ownerBBook = seedBook(ownerB, "create-b");
        int ownerACardsBefore = ownerCardCount(ownerA);
        int ownerBCardsBefore = ownerCardCount(ownerB);

        ObjectNode withNullOptionals = createRequest(ownerABook, "epubcfi(/8/2)", "created with null optionals");
        withNullOptionals.putNull("chapterTitle");
        withNullOptionals.putNull("translation");
        withNullOptionals.putNull("pronunciation");
        withNullOptionals.putNull("partOfSpeech");
        withNullOptionals.putNull("definition");
        withNullOptionals.putNull("background");
        withNullOptionals.putNull("examples");
        withNullOptionals.putNull("relatedWords");

        MvcResult createdResult = performCreate(tokenA, withNullOptionals)
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode createdResponse = objectMapper.readTree(createdResult.getResponse().getContentAsString());
        UUID createdId = UUID.fromString(createdResponse.get("id").asText());
        fixtureCardIds.add(createdId);

        assertEquals(ownerABook.getId().toString(), createdResponse.get("bookId").asText());
        assertEquals("", createdResponse.get("chapterTitle").asText());
        assertEquals("", createdResponse.get("translation").asText());
        assertEquals("", createdResponse.get("pronunciation").asText());
        assertEquals("", createdResponse.get("partOfSpeech").asText());
        assertEquals("", createdResponse.get("definition").asText());
        assertEquals("", createdResponse.get("background").asText());
        assertTrue(createdResponse.get("examples").isArray());
        assertTrue(createdResponse.get("examples").isEmpty());
        assertTrue(createdResponse.get("relatedWords").isArray());
        assertTrue(createdResponse.get("relatedWords").isEmpty());
        Card persisted = cardRepository.findById(createdId).orElseThrow();
        assertEquals(ownerABook.getId(), persisted.getBook().getId());
        assertEquals(ownerA.getId(), bookRepository.findById(ownerABook.getId()).orElseThrow().getOwner().getId());
        assertEquals(ownerACardsBefore + 1, ownerCardCount(ownerA));
        assertEquals(ownerBCardsBefore, ownerCardCount(ownerB));

        performCreate(tokenA, objectMapper.createObjectNode()
                        .put("cfiRange", "epubcfi(/8/4)")
                        .put("selectedText", "missing book"))
                .andExpect(status().isBadRequest());
        performCreate(tokenA, createRequest(ownerABook, "epubcfi(/8/6)", "null book").putNull("bookId"))
                .andExpect(status().isBadRequest());
        performCreate(tokenA, createRequest(ownerABook, "   ", "blank cfi"))
                .andExpect(status().isBadRequest());
        performCreate(tokenA, createRequest(ownerABook, "epubcfi(/8/8)", "   "))
                .andExpect(status().isBadRequest());
        performCreate(tokenA, createRequestFromBookId(UUID.randomUUID(), "epubcfi(/8/10)", "missing book"))
                .andExpect(status().isNotFound());
        performCreate(tokenA, createRequest(ownerBBook, "epubcfi(/8/12)", "other owner book"))
                .andExpect(status().isNotFound());
        performCreate(null, createRequest(ownerABook, "epubcfi(/8/14)", "unauthenticated"))
                .andExpect(status().isUnauthorized());
        performCreate("invalid-wave-1c-token", createRequest(ownerABook, "epubcfi(/8/16)", "invalid session"))
                .andExpect(status().isUnauthorized());

        assertEquals(ownerACardsBefore + 1, ownerCardCount(ownerA));
        assertEquals(ownerBCardsBefore, ownerCardCount(ownerB));
        assertTrue(cardRepository.findById(createdId).isPresent());
    }

    @Test
    void updateOwnCardPreservesLocationRejectsInvalidAndCrossOwnerAccess() throws Exception {
        Book ownerABook = seedBook(ownerA, "update-a");
        Book ownerBBook = seedBook(ownerB, "update-b");
        Card own = seedCard(ownerABook, "epubcfi(/10/2)", "original owner-a", false);
        Card other = seedCard(ownerBBook, "epubcfi(/10/4)", "original owner-b", false);

        ObjectNode validUpdate = updateRequest("updated owner-a", "translation", "pronunciation", "noun",
                "definition", "background", List.of("example"), List.of("related"));
        MvcResult updateResult = performUpdate(own.getId(), tokenA, validUpdate)
                .andExpect(status().isOk())
                .andReturn();
        JsonNode updatedResponse = objectMapper.readTree(updateResult.getResponse().getContentAsString());
        assertEquals("updated owner-a", updatedResponse.get("selectedText").asText());
        assertEquals("translation", updatedResponse.get("translation").asText());
        assertEquals("epubcfi(/10/2)", updatedResponse.get("cfiRange").asText());
        assertEquals(ownerABook.getId().toString(), updatedResponse.get("bookId").asText());
        assertEquals("Chapter Book update-a", updatedResponse.get("chapterTitle").asText());

        Card updated = cardRepository.findById(own.getId()).orElseThrow();
        assertEquals("updated owner-a", updated.getSelectedText());
        assertEquals("epubcfi(/10/2)", updated.getCfiRange());
        assertEquals(ownerABook.getId(), updated.getBook().getId());
        assertEquals("Chapter Book update-a", updated.getChapterTitle());

        performUpdate(own.getId(), tokenA, updateRequest("   ", "ignored", null, null, null, null, null, null))
                .andExpect(status().isBadRequest());
        performUpdate(other.getId(), tokenA, updateRequest("cross-owner", null, null, null, null, null, null, null))
                .andExpect(status().isNotFound());
        performUpdate(UUID.randomUUID(), tokenA, updateRequest("missing", null, null, null, null, null, null, null))
                .andExpect(status().isNotFound());
        performUpdate(own.getId(), null, updateRequest("unauthenticated", null, null, null, null, null, null, null))
                .andExpect(status().isUnauthorized());
        performUpdate(own.getId(), "invalid-wave-1c-token", updateRequest("invalid session", null, null, null, null, null, null, null))
                .andExpect(status().isUnauthorized());

        Card ownAfterNegativeRequests = cardRepository.findById(own.getId()).orElseThrow();
        assertEquals("updated owner-a", ownAfterNegativeRequests.getSelectedText());
        assertEquals("translation", ownAfterNegativeRequests.getTranslation());
        assertEquals(ownerABook.getId(), ownAfterNegativeRequests.getBook().getId());
        assertEquals("epubcfi(/10/2)", ownAfterNegativeRequests.getCfiRange());
        Card otherAfterNegativeRequests = cardRepository.findById(other.getId()).orElseThrow();
        assertEquals("original owner-b", otherAfterNegativeRequests.getSelectedText());
        assertEquals(ownerBBook.getId(), otherAfterNegativeRequests.getBook().getId());
    }

    @Test
    void archiveAndUnarchiveChangeOnlyOwnCardAndRespectListVisibility() throws Exception {
        Book ownerABook = seedBook(ownerA, "archive-a");
        Book ownerBBook = seedBook(ownerB, "archive-b");
        Card own = seedCard(ownerABook, "epubcfi(/12/2)", "archive own", false);
        Card other = seedCard(ownerBBook, "epubcfi(/12/4)", "archive other", false);

        MvcResult archivedResult = mockMvc.perform(post("/api/cards/{id}/archive", own.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode archivedResponse = objectMapper.readTree(archivedResult.getResponse().getContentAsString());
        assertTrue(archivedResponse.get("archived").asBoolean());
        assertTrue(cardRepository.findById(own.getId()).orElseThrow().isArchived());
        assertCards(list(tokenA, null));
        assertCards(list(tokenA, true), own);

        MvcResult unarchivedResult = mockMvc.perform(post("/api/cards/{id}/unarchive", own.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode unarchivedResponse = objectMapper.readTree(unarchivedResult.getResponse().getContentAsString());
        assertFalse(unarchivedResponse.get("archived").asBoolean());
        assertFalse(cardRepository.findById(own.getId()).orElseThrow().isArchived());
        assertCards(list(tokenA, null), own);

        mockMvc.perform(post("/api/cards/{id}/archive", other.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/cards/{id}/unarchive", other.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/cards/{id}/archive", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/cards/{id}/unarchive", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/cards/{id}/archive", own.getId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/cards/{id}/unarchive", own.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer("invalid-wave-1c-token")))
                .andExpect(status().isUnauthorized());

        assertFalse(cardRepository.findById(other.getId()).orElseThrow().isArchived());
        assertFalse(cardRepository.findById(own.getId()).orElseThrow().isArchived());
    }

    @Test
    void moveToEndAllowsOwnCardButOnlyValidatesAccessBoundaries() throws Exception {
        Book ownerABook = seedBook(ownerA, "move-a");
        Book ownerBBook = seedBook(ownerB, "move-b");
        Card own = seedCard(ownerABook, "epubcfi(/14/2)", "move own", false);
        Card other = seedCard(ownerBBook, "epubcfi(/14/4)", "move other", false);

        MvcResult movedResult = mockMvc.perform(post("/api/cards/{id}/move-to-end", own.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode movedResponse = objectMapper.readTree(movedResult.getResponse().getContentAsString());
        assertEquals(own.getId().toString(), movedResponse.get("id").asText());
        assertEquals(ownerABook.getId().toString(), movedResponse.get("bookId").asText());
        assertEquals("move own", movedResponse.get("selectedText").asText());

        mockMvc.perform(post("/api/cards/{id}/move-to-end", other.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/cards/{id}/move-to-end", UUID.randomUUID())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/cards/{id}/move-to-end", own.getId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/cards/{id}/move-to-end", own.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer("invalid-wave-1c-token")))
                .andExpect(status().isUnauthorized());

        Card ownAfterRequests = cardRepository.findById(own.getId()).orElseThrow();
        Card otherAfterRequests = cardRepository.findById(other.getId()).orElseThrow();
        assertEquals("move own", ownAfterRequests.getSelectedText());
        assertEquals(ownerABook.getId(), ownAfterRequests.getBook().getId());
        assertEquals("epubcfi(/14/2)", ownAfterRequests.getCfiRange());
        assertEquals("move other", otherAfterRequests.getSelectedText());
        assertEquals(ownerBBook.getId(), otherAfterRequests.getBook().getId());
    }

    private JsonNode list(String token, Boolean includeArchived) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/cards").header(HttpHeaders.AUTHORIZATION, bearer(token));
        if (includeArchived != null) {
            request.param("includeArchived", includeArchived.toString());
        }
        return objectMapper.readTree(mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString());
    }

    private ResultActions performCreate(String token, ObjectNode requestBody) throws Exception {
        MockHttpServletRequestBuilder request = post("/api/cards")
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody.toString());
        if (token != null) {
            request.header(HttpHeaders.AUTHORIZATION, bearer(token));
        }
        return mockMvc.perform(request);
    }

    private ResultActions performUpdate(UUID id, String token, ObjectNode requestBody) throws Exception {
        MockHttpServletRequestBuilder request = patch("/api/cards/{id}", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(requestBody.toString());
        if (token != null) {
            request.header(HttpHeaders.AUTHORIZATION, bearer(token));
        }
        return mockMvc.perform(request);
    }

    private ObjectNode createRequest(Book book, String cfiRange, String selectedText) {
        return createRequestFromBookId(book.getId(), cfiRange, selectedText)
                .put("chapterTitle", "Chapter " + book.getTitle());
    }

    private ObjectNode createRequestFromBookId(UUID bookId, String cfiRange, String selectedText) {
        return objectMapper.createObjectNode()
                .put("bookId", bookId.toString())
                .put("cfiRange", cfiRange)
                .put("selectedText", selectedText);
    }

    private ObjectNode updateRequest(
            String selectedText,
            String translation,
            String pronunciation,
            String partOfSpeech,
            String definition,
            String background,
            List<String> examples,
            List<String> relatedWords
    ) {
        ObjectNode request = objectMapper.createObjectNode().put("selectedText", selectedText);
        putNullable(request, "translation", translation);
        putNullable(request, "pronunciation", pronunciation);
        putNullable(request, "partOfSpeech", partOfSpeech);
        putNullable(request, "definition", definition);
        putNullable(request, "background", background);
        if (examples == null) request.putNull("examples"); else request.set("examples", objectMapper.valueToTree(examples));
        if (relatedWords == null) request.putNull("relatedWords"); else request.set("relatedWords", objectMapper.valueToTree(relatedWords));
        return request;
    }

    private static void putNullable(ObjectNode node, String field, String value) {
        if (value == null) node.putNull(field); else node.put(field, value);
    }

    private Book seedBook(AppUser owner, String label) {
        Book book = bookRepository.saveAndFlush(new Book(
                owner,
                "wave-1c-" + label + "-" + UUID.randomUUID(),
                label + ".epub",
                "Book " + label,
                "Author " + label,
                "en"
        ));
        fixtureBookIds.add(book.getId());
        return book;
    }

    private Card seedCard(Book book, String cfiRange, String selectedText, boolean archived) {
        Card card = new Card(book, cfiRange, selectedText, "Chapter " + book.getTitle(), 0);
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
        if (archived) {
            card.archive();
        }
        Card saved = cardRepository.saveAndFlush(card);
        fixtureCardIds.add(saved.getId());
        return saved;
    }

    private int ownerCardCount(AppUser owner) {
        return cardRepository.findAllForOwner(owner.getId()).size();
    }

    private void assertCards(JsonNode actual, Card... expectedCards) {
        Map<String, String> actualCards = new HashMap<>();
        actual.forEach(card -> actualCards.put(card.get("id").asText(), card.get("selectedText").asText()));
        Map<String, String> expected = new HashMap<>();
        for (Card card : expectedCards) {
            expected.put(card.getId().toString(), card.getSelectedText());
        }
        assertEquals(expected, actualCards);
    }

    private static String bearer(String token) {
        return "Bearer " + token;
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
}
