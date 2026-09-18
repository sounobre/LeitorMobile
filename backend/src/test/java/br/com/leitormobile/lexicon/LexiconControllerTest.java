package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest(classes = LeitorBackendApplication.class)
@AutoConfigureMockMvc
class LexiconControllerTest extends PostgresIntegrationTestSupport {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AppUserRepository userRepository;
    @Autowired private SessionTokenRepository sessionTokenRepository;
    @Autowired private BookRepository bookRepository;
    @Autowired private LexemeRepository lexemeRepository;
    @Autowired private WordFormLookupRepository wordFormRepository;
    @Autowired private DictionaryEntryRepository dictionaryEntryRepository;
    @Autowired private SenseLookupRepository senseRepository;
    @Autowired private BookLexemeRepository bookLexemeRepository;

    private final List<UUID> fixtureBookIds = new ArrayList<>();
    private final List<UUID> fixtureLexemeIds = new ArrayList<>();
    private final List<WordForm> fixtureWordForms = new ArrayList<>();
    private final List<UUID> fixtureDictionaryEntryIds = new ArrayList<>();
    private final List<UUID> fixtureSenseIds = new ArrayList<>();
    private final List<UUID> fixtureBookLexemeIds = new ArrayList<>();
    private final List<SessionToken> fixtureSessions = new ArrayList<>();

    private AppUser ownerA;
    private AppUser ownerB;
    private Book ownerABook;
    private Book ownerBBook;
    private String tokenA;
    private String tokenB;
    private BookLexeme ownerAPrimary;
    private BookLexeme ownerASecondary;
    private BookLexeme ownerBEntry;

    @BeforeEach
    void createPersistedLexiconFixture() {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        ownerA = userRepository.saveAndFlush(new AppUser(
                "wave1d.owner.a." + suffix + "@example.invalid", "fixture-only-password-hash"));
        ownerB = userRepository.saveAndFlush(new AppUser(
                "wave1d.owner.b." + suffix + "@example.invalid", "fixture-only-password-hash"));
        tokenA = "wave1d-token-a-" + suffix;
        tokenB = "wave1d-token-b-" + suffix;
        fixtureSessions.add(sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(tokenA), ownerA, Instant.now().plusSeconds(3600))));
        fixtureSessions.add(sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(tokenB), ownerB, Instant.now().plusSeconds(3600))));

        ownerABook = saveBook(ownerA, "owner-a-lexicon-" + suffix, "Owner A Lexicon");
        ownerBBook = saveBook(ownerB, "owner-b-lexicon-" + suffix, "Owner B Lexicon");
        ownerAPrimary = saveCompleteEntry(
                ownerABook, "luminous-" + suffix, "adjective", 7,
                List.of("luminous-" + suffix, "luminescent-" + suffix),
                "emitting or reflecting light", "luminoso", "/ˈluːmɪnəs/", "B2",
                "RESOLVED_LOCAL", "CORE",
                List.of(
                        new SenseFixture("01", "giving off light", "que emite luz"),
                        new SenseFixture("02", "full of brightness", "cheio de brilho")));
        ownerASecondary = saveBookLexeme(ownerABook, "orbit-" + suffix, "noun", 2, "CORE");
        ownerBEntry = saveBookLexeme(ownerBBook, "private-" + suffix, "adjective", 11, "OPTIONAL");
    }

    @AfterEach
    void removePersistedLexiconFixture() {
        if (!fixtureBookLexemeIds.isEmpty()) {
            bookLexemeRepository.deleteAllById(fixtureBookLexemeIds);
            bookLexemeRepository.flush();
        }
        if (!fixtureSenseIds.isEmpty()) {
            senseRepository.deleteAllById(fixtureSenseIds);
            senseRepository.flush();
        }
        if (!fixtureDictionaryEntryIds.isEmpty()) {
            dictionaryEntryRepository.deleteAllById(fixtureDictionaryEntryIds);
            dictionaryEntryRepository.flush();
        }
        if (!fixtureWordForms.isEmpty()) {
            wordFormRepository.deleteAll(fixtureWordForms);
            wordFormRepository.flush();
        }
        if (!fixtureBookIds.isEmpty()) {
            bookRepository.deleteAllById(fixtureBookIds);
            bookRepository.flush();
        }
        if (!fixtureLexemeIds.isEmpty()) {
            lexemeRepository.deleteAllById(fixtureLexemeIds);
            lexemeRepository.flush();
        }
        if (!fixtureSessions.isEmpty()) {
            sessionTokenRepository.deleteAll(fixtureSessions);
            sessionTokenRepository.flush();
        }
        if (ownerA != null) userRepository.delete(ownerA);
        if (ownerB != null) userRepository.delete(ownerB);
        userRepository.flush();
        fixtureBookLexemeIds.clear();
        fixtureSenseIds.clear();
        fixtureDictionaryEntryIds.clear();
        fixtureWordForms.clear();
        fixtureBookIds.clear();
        fixtureLexemeIds.clear();
        fixtureSessions.clear();
    }

    @Test
    void listReturnsPersistedFieldsSearchAndLimitForCurrentOwner() throws Exception {
        PersistenceSnapshot before = snapshot();
        JsonNode defaultList = json(performList(ownerABook.getId(), tokenA, null, null)
                .andExpect(status().isOk()).andReturn());
        assertEquals(2, defaultList.size());
        assertEquals(Set.of(ownerAPrimary.getId().toString(), ownerASecondary.getId().toString()), ids(defaultList));

        JsonNode explicitEmptySearch = json(performList(ownerABook.getId(), tokenA, "", null)
                .andExpect(status().isOk()).andReturn());
        assertEquals(ids(defaultList), ids(explicitEmptySearch));

        JsonNode primary = findById(defaultList, ownerAPrimary.getId());
        String suffix = ownerAPrimary.getLexeme().getLemma().substring("luminous-".length());
        assertEquals(ownerABook.getId().toString(), primary.get("bookId").asText());
        assertEquals(ownerAPrimary.getLexeme().getLemma(), primary.get("lemma").asText());
        assertEquals("adjective", primary.get("partOfSpeech").asText());
        assertEquals(List.of("luminescent-" + suffix, "luminous-" + suffix), jsonStrings(primary.get("wordForms")));
        assertEquals("emitting or reflecting light", primary.get("definition").asText());
        assertEquals("luminoso", primary.get("translationPtBr").asText());
        assertEquals("/ˈluːmɪnəs/", primary.get("ipa").asText());
        assertEquals("B2", primary.get("cefr").asText());
        assertEquals(7, primary.get("bookFrequency").asInt());
        assertTrue(primary.get("firstSentenceId").isNull());
        assertEquals("RESOLVED_LOCAL", primary.get("resolutionStatus").asText());
        assertEquals("CORE", primary.get("pedagogicalRelevance").asText());
        assertEquals(2, primary.get("senses").size());
        assertEquals("01", primary.get("senses").get(0).get("senseKey").asText());
        assertEquals("giving off light", primary.get("senses").get(0).get("definition").asText());
        assertEquals("que emite luz", primary.get("senses").get(0).get("translationPtBr").asText());
        assertEquals("02", primary.get("senses").get(1).get("senseKey").asText());
        assertNotNull(Instant.parse(primary.get("updatedAt").asText()));

        JsonNode searched = json(performList(
                ownerABook.getId(), tokenA,
                "  " + ownerAPrimary.getLexeme().getLemma().toUpperCase(Locale.ROOT) + "  ", null)
                .andExpect(status().isOk()).andReturn());
        assertEquals(1, searched.size());
        assertEquals(ownerAPrimary.getId().toString(), searched.get(0).get("id").asText());

        JsonNode noMatch = json(performList(ownerABook.getId(), tokenA, "does-not-exist", null)
                .andExpect(status().isOk()).andReturn());
        assertTrue(noMatch.isArray());
        assertEquals(0, noMatch.size());

        JsonNode limited = json(performList(ownerABook.getId(), tokenA, null, 1)
                .andExpect(status().isOk()).andReturn());
        assertEquals(1, limited.size());
        assertEquals(ownerAPrimary.getId().toString(), limited.get(0).get("id").asText());
        assertEquals(before, snapshot());
    }

    @Test
    void listAndLookupAreScopedToBookOwnerAndDoNotLeakOtherOwnerData() throws Exception {
        PersistenceSnapshot before = snapshot();
        JsonNode ownerAList = json(performList(ownerABook.getId(), tokenA, null, null)
                .andExpect(status().isOk()).andReturn());
        assertFalse(ids(ownerAList).contains(ownerBEntry.getId().toString()));
        assertFalse(ownerAList.toString().contains(ownerBEntry.getLexeme().getLemma()));
        performList(ownerBBook.getId(), tokenA, null, null).andExpect(status().isNotFound());
        performList(UUID.randomUUID(), tokenA, null, null).andExpect(status().isNotFound());
        performLookup(ownerABook.getId(), tokenB, ownerAPrimary.getLexeme().getLemma())
                .andExpect(status().isNotFound());
        performLookup(ownerBBook.getId(), tokenA, ownerBEntry.getLexeme().getLemma())
                .andExpect(status().isNotFound());

        JsonNode ownerBList = json(performList(ownerBBook.getId(), tokenB, null, null)
                .andExpect(status().isOk()).andReturn());
        assertEquals(1, ownerBList.size());
        assertEquals(ownerBEntry.getLexeme().getLemma(), ownerBList.get(0).get("lemma").asText());
        assertFalse(ownerBList.toString().contains(ownerAPrimary.getLexeme().getLemma()));
        assertEquals(before, snapshot());
    }

    @Test
    void lookupReturnsPersistedEntryForLemmaAndCaseInsensitiveTrimmedWordForm() throws Exception {
        PersistenceSnapshot before = snapshot();
        JsonNode listEntry = findById(json(performList(ownerABook.getId(), tokenA, null, null)
                .andExpect(status().isOk()).andReturn()), ownerAPrimary.getId());
        JsonNode byLemma = json(performLookup(ownerABook.getId(), tokenA, ownerAPrimary.getLexeme().getLemma())
                .andExpect(status().isOk()).andReturn());
        assertEntryFieldsEqualExceptUpdatedAt(listEntry, byLemma);

        String wordForm = wordFormRepository.findForms(ownerAPrimary.getLexeme().getId()).get(1);
        JsonNode byWordForm = json(performLookup(ownerABook.getId(), tokenA, "  " + wordForm.toUpperCase(Locale.ROOT) + "  ")
                .andExpect(status().isOk()).andReturn());
        assertEntryFieldsEqualExceptUpdatedAt(listEntry, byWordForm);
        assertEquals(before, snapshot());
    }

    @Test
    void lookupUsesEmptyBodyForAbsentAndBlankTermsAndBindingErrorForMissingTerm() throws Exception {
        PersistenceSnapshot before = snapshot();
        MvcResult absent = performLookup(ownerABook.getId(), tokenA, "not-in-persisted-lexicon")
                .andExpect(status().isOk()).andReturn();
        assertEquals("", absent.getResponse().getContentAsString());
        MvcResult blank = performLookup(ownerABook.getId(), tokenA, "   ")
                .andExpect(status().isOk()).andReturn();
        assertEquals("", blank.getResponse().getContentAsString());
        mockMvc.perform(get("/api/books/{bookId}/lexicon/lookup", ownerABook.getId())
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isBadRequest());
        performLookup(UUID.randomUUID(), tokenA, ownerAPrimary.getLexeme().getLemma())
                .andExpect(status().isNotFound());
        assertEquals(before, snapshot());
    }

    @Test
    void listAndLookupRejectMissingOrInvalidSessionsWithoutChangingPersistedLexicon() throws Exception {
        PersistenceSnapshot before = snapshot();
        performList(ownerABook.getId(), null, null, null).andExpect(status().isUnauthorized());
        performList(ownerABook.getId(), "invalid-wave-1d-token", null, null)
                .andExpect(status().isUnauthorized());
        performLookup(ownerABook.getId(), null, ownerAPrimary.getLexeme().getLemma())
                .andExpect(status().isUnauthorized());
        performLookup(ownerABook.getId(), "invalid-wave-1d-token", ownerAPrimary.getLexeme().getLemma())
                .andExpect(status().isUnauthorized());
        assertEquals(before, snapshot());
    }

    private MockHttpServletRequestBuilder listRequest(UUID bookId, String token, String search, Integer limit) {
        MockHttpServletRequestBuilder request = get("/api/books/{bookId}/lexicon", bookId);
        withBearer(request, token);
        if (search != null) request.param("search", search);
        if (limit != null) request.param("limit", String.valueOf(limit));
        return request;
    }

    private MockHttpServletRequestBuilder lookupRequest(UUID bookId, String token, String term) {
        MockHttpServletRequestBuilder request = get("/api/books/{bookId}/lexicon/lookup", bookId);
        withBearer(request, token);
        if (term != null) request.param("term", term);
        return request;
    }

    private org.springframework.test.web.servlet.ResultActions performList(UUID bookId, String token, String search, Integer limit) throws Exception {
        return mockMvc.perform(listRequest(bookId, token, search, limit));
    }

    private org.springframework.test.web.servlet.ResultActions performLookup(UUID bookId, String token, String term) throws Exception {
        return mockMvc.perform(lookupRequest(bookId, token, term));
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private Book saveBook(AppUser owner, String label, String title) {
        Book book = bookRepository.saveAndFlush(new Book(owner, label, label + ".epub", title, "Synthetic Author", "en"));
        fixtureBookIds.add(book.getId());
        return book;
    }

    private BookLexeme saveCompleteEntry(
            Book book, String lemma, String partOfSpeech, int frequency, List<String> forms,
            String definition, String translation, String ipa, String cefr, String resolutionStatus,
            String pedagogicalRelevance, List<SenseFixture> senseFixtures
    ) {
        Lexeme lexeme = lexemeRepository.saveAndFlush(new Lexeme("en", lemma, partOfSpeech));
        fixtureLexemeIds.add(lexeme.getId());
        for (String form : forms) {
            WordForm wordForm = wordFormRepository.saveAndFlush(new WordForm(lexeme, form));
            fixtureWordForms.add(wordForm);
        }
        DictionaryEntry dictionaryEntry = new DictionaryEntry(lexeme);
        dictionaryEntry.enrich(definition, translation, ipa, cefr, "SYNTHETIC_FIXTURE");
        dictionaryEntry = dictionaryEntryRepository.saveAndFlush(dictionaryEntry);
        fixtureDictionaryEntryIds.add(dictionaryEntry.getId());
        for (SenseFixture senseFixture : senseFixtures) {
            LexicalSense sense = senseRepository.saveAndFlush(new LexicalSense(
                    dictionaryEntry, senseFixture.senseKey(), senseFixture.definition(), senseFixture.translation(),
                    cefr, "SYNTHETIC_FIXTURE"));
            fixtureSenseIds.add(sense.getId());
        }
        return saveBookLexeme(book, lexeme, frequency, resolutionStatus, pedagogicalRelevance);
    }

    private BookLexeme saveBookLexeme(Book book, String lemma, String partOfSpeech, int frequency, String relevance) {
        Lexeme lexeme = lexemeRepository.saveAndFlush(new Lexeme("en", lemma, partOfSpeech));
        fixtureLexemeIds.add(lexeme.getId());
        WordForm wordForm = wordFormRepository.saveAndFlush(new WordForm(lexeme, lemma));
        fixtureWordForms.add(wordForm);
        return saveBookLexeme(book, lexeme, frequency, "UNRESOLVED", relevance);
    }

    private BookLexeme saveBookLexeme(Book book, Lexeme lexeme, int frequency, String status, String relevance) {
        BookLexeme bookLexeme = new BookLexeme(book, lexeme, null);
        for (int index = 0; index < frequency; index++) bookLexeme.increment(null);
        bookLexeme.resolve(status, relevance);
        bookLexeme = bookLexemeRepository.saveAndFlush(bookLexeme);
        fixtureBookLexemeIds.add(bookLexeme.getId());
        return bookLexeme;
    }

    private PersistenceSnapshot snapshot() {
        return new PersistenceSnapshot(List.of(
                snapshotEntry(ownerAPrimary), snapshotEntry(ownerASecondary), snapshotEntry(ownerBEntry)));
    }

    private EntrySnapshot snapshotEntry(BookLexeme bookLexeme) {
        return new EntrySnapshot(
                bookLexeme.getId(), bookLexeme.getFrequency(), bookLexeme.getResolutionStatus(),
                bookLexeme.getPedagogicalRelevance(), wordFormRepository.findForms(bookLexeme.getLexeme().getId()),
                dictionaryEntryRepository.findByLexemeId(bookLexeme.getLexeme().getId())
                        .map(DictionaryEntry::getId)
                        .map(dictionaryId -> senseRepository.findByDictionaryEntryIdOrderBySenseKeyAsc(dictionaryId)
                                .stream().map(LexicalSense::getId).toList())
                        .orElse(List.of()));
    }

    private JsonNode findById(JsonNode entries, UUID id) {
        for (JsonNode entry : entries) {
            if (id.toString().equals(entry.get("id").asText())) return entry;
        }
        throw new AssertionError("Entry not found in response: " + id);
    }

    private void assertEntryFieldsEqualExceptUpdatedAt(JsonNode expected, JsonNode actual) {
        for (String field : List.of(
                "id", "bookId", "lemma", "partOfSpeech", "wordForms", "definition", "translationPtBr",
                "ipa", "cefr", "bookFrequency", "firstSentenceId", "resolutionStatus", "pedagogicalRelevance", "senses")) {
            assertEquals(expected.get(field), actual.get(field), "Mismatch in persisted field: " + field);
        }
        assertNotNull(Instant.parse(actual.get("updatedAt").asText()));
    }

    private List<String> jsonStrings(JsonNode values) {
        List<String> result = new ArrayList<>();
        values.forEach(value -> result.add(value.asText()));
        return result;
    }

    private static Set<String> ids(JsonNode entries) {
        Set<String> result = new HashSet<>();
        entries.forEach(entry -> result.add(entry.get("id").asText()));
        return result;
    }

    private static void withBearer(MockHttpServletRequestBuilder request, String token) {
        if (token != null) request.header(HttpHeaders.AUTHORIZATION, bearer(token));
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 not available", exception);
        }
    }

    private record SenseFixture(String senseKey, String definition, String translation) {}
    private record PersistenceSnapshot(List<EntrySnapshot> entries) {}
    private record EntrySnapshot(
            UUID bookLexemeId, int frequency, String resolutionStatus, String pedagogicalRelevance,
            List<String> forms, List<UUID> senseIds) {}
}
