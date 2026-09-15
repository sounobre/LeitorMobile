package br.com.leitormobile.book;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.leitormobile.LeitorBackendApplication;
import br.com.leitormobile.auth.AppUser;
import br.com.leitormobile.auth.AppUserRepository;
import br.com.leitormobile.auth.SessionToken;
import br.com.leitormobile.auth.SessionTokenRepository;
import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(classes = LeitorBackendApplication.class)
@AutoConfigureMockMvc
class BookControllerApiTest extends PostgresIntegrationTestSupport {

    private static final Path STORAGE_ROOT = createStorageRoot();
    private static final List<String> MANAGED_COVER_EXTENSIONS = List.of(".jpg", ".png", ".webp", ".gif");

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

    private AppUser ownerA;
    private AppUser ownerB;
    private SessionToken sessionA;
    private SessionToken sessionB;
    private String tokenA;
    private String tokenB;
    private final List<UUID> fixtureBookIds = new ArrayList<>();
    private final List<Path> externalFixtureFiles = new ArrayList<>();

    @DynamicPropertySource
    static void registerIsolatedStorage(DynamicPropertyRegistry registry) {
        registry.add("app.storage-directory", STORAGE_ROOT::toString);
    }

    @BeforeEach
    void createIsolatedOwnersAndSessions() {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        ownerA = userRepository.saveAndFlush(
                new AppUser("wave1b.owner.a." + suffix + "@example.invalid", "fixture-only-password-hash")
        );
        ownerB = userRepository.saveAndFlush(
                new AppUser("wave1b.owner.b." + suffix + "@example.invalid", "fixture-only-password-hash")
        );

        tokenA = "wave1b-token-a-" + suffix;
        tokenB = "wave1b-token-b-" + suffix;
        sessionA = sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(tokenA.getBytes(StandardCharsets.UTF_8)), ownerA, Instant.now().plusSeconds(3600))
        );
        sessionB = sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(tokenB.getBytes(StandardCharsets.UTF_8)), ownerB, Instant.now().plusSeconds(3600))
        );
    }

    @AfterEach
    void removeFixtureState() throws IOException {
        for (UUID bookId : fixtureBookIds) {
            deleteManagedFiles(bookId);
        }
        for (Path externalFile : externalFixtureFiles) {
            Files.deleteIfExists(externalFile);
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
        fixtureBookIds.clear();
        externalFixtureFiles.clear();
    }

    @AfterAll
    static void removeStorageRoot() throws IOException {
        if (Files.exists(STORAGE_ROOT)) {
            try (var paths = Files.walk(STORAGE_ROOT)) {
                paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                    try {
                        Files.deleteIfExists(path);
                    } catch (IOException exception) {
                        throw new IllegalStateException("Could not clean Wave 1B storage root", exception);
                    }
                });
            }
        }
    }

    @Test
    void listSearchAndCoverAccessRemainScopedToCurrentOwner() throws Exception {
        Book ownerATitle = seedBook(ownerA, uniqueHash("list-a-title"), "alpha.epub", "Alpha Novel", "Jane Author");
        Book ownerAAuthor = seedBook(ownerA, uniqueHash("list-a-author"), "manual.epub", "Other Title", "Unique Author");
        Book ownerBBook = seedBook(ownerB, uniqueHash("list-b"), "other.epub", "Other Owner Book", "Other Owner");

        byte[] ownerACover = "owner-a-cover".getBytes(StandardCharsets.UTF_8);
        byte[] ownerBCover = "owner-b-cover".getBytes(StandardCharsets.UTF_8);
        attachCover(ownerATitle, ownerACover, ".jpg");
        attachCover(ownerBBook, ownerBCover, ".png");

        assertBookIds(library(tokenA, null), ownerATitle.getId(), ownerAAuthor.getId());
        assertBookIds(library(tokenA, "   "), ownerATitle.getId(), ownerAAuthor.getId());
        assertBookIds(library(tokenA, "alpha novel"), ownerATitle.getId());
        assertBookIds(library(tokenA, "unique author"), ownerAAuthor.getId());
        assertBookIds(library(tokenA, "no matching book"));
        assertBookIds(library(tokenB, null), ownerBBook.getId());

        mockMvc.perform(get("/api/books/{id}/cover", ownerATitle.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isOk())
                .andExpect(result -> assertArrayEquals(ownerACover, result.getResponse().getContentAsByteArray()));
        mockMvc.perform(get("/api/books/{id}/cover", ownerAAuthor.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/books/{id}/cover", ownerBBook.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/books/{id}/cover", UUID.randomUUID()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/books/{id}/cover", ownerATitle.getId()))
                .andExpect(status().isUnauthorized());

        assertTrue(Files.exists(Path.of(ownerATitle.getCoverUri())));
        assertTrue(Files.exists(Path.of(ownerBBook.getCoverUri())));
    }

    @Test
    void createBookAppliesApi004DefaultsAndBindsTheCurrentOwner() throws Exception {
        ObjectNode request = objectMapper.createObjectNode();
        request.put("originalName", "  defaults.epub ");
        request.put("fileHash", " ");
        request.put("title", " ");
        request.putNull("author");
        request.put("language", " ");
        request.put("coverUri", " ");
        request.putNull("description");
        request.put("publisher", " ");

        UUID id = createBook(tokenA, request);
        JsonNode response = bookResponse(id);
        assertEquals("defaults.epub", response.get("originalName").asText());
        assertEquals("  defaults.epub ", response.get("title").asText());
        assertEquals("", response.get("author").asText());
        assertEquals("pt-BR", response.get("language").asText());
        assertEquals("", response.get("description").asText());
        assertEquals("", response.get("publisher").asText());
        assertTrue(response.get("fileHash").asText().startsWith("manual:"));
        assertTrue(response.get("coverUri").isNull());

        Book stored = bookRepository.findById(id).orElseThrow();
        assertEquals(ownerA.getId(), stored.getOwner().getId());
        assertEquals("manual:", stored.getFileHash().substring(0, "manual:".length()));
    }

    @Test
    void createBookTrimsExplicitHashRejectsDuplicatesAndObservesCrossOwnerConstraint() throws Exception {
        String hash = uniqueHash("duplicate");
        ObjectNode firstRequest = createRequest("first.epub");
        firstRequest.put("fileHash", " " + hash + " ");
        UUID firstId = createBook(tokenA, firstRequest);
        assertEquals(hash, bookRepository.findById(firstId).orElseThrow().getFileHash());

        int ownerABookCount = bookRepository.findLibrary(ownerA.getId()).size();
        MvcResult duplicate = performCreate(tokenA, createRequestWithHash("duplicate.epub", hash)).andReturn();
        assertEquals(409, duplicate.getResponse().getStatus());
        assertEquals(ownerABookCount, bookRepository.findLibrary(ownerA.getId()).size());

        MvcResult crossOwner = performCreate(tokenB, createRequestWithHash("cross-owner.epub", hash)).andReturn();
        assertEquals(201, crossOwner.getResponse().getStatus());
        UUID crossOwnerId = UUID.fromString(objectMapper.readTree(crossOwner.getResponse().getContentAsString()).get("id").asText());
        fixtureBookIds.add(crossOwnerId);

        Book ownerABook = bookRepository.findById(firstId).orElseThrow();
        Book ownerBBook = bookRepository.findById(crossOwnerId).orElseThrow();
        assertNotEquals(firstId, crossOwnerId);
        assertEquals(ownerA.getId(), ownerABook.getOwner().getId());
        assertEquals(ownerB.getId(), ownerBBook.getOwner().getId());
        assertEquals(hash, ownerABook.getFileHash());
        assertEquals(hash, ownerBBook.getFileHash());
    }

    @Test
    void createBookRequiresOriginalNameAndAuthenticatedOwner() throws Exception {
        int initialCount = bookRepository.findLibrary(ownerA.getId()).size();
        mockMvc.perform(post("/api/books")
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fileHash\":\"missing-name\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/books")
                        .header(HttpHeaders.AUTHORIZATION, bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalName\":\"   \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/books")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createRequest("unauthenticated.epub").toString()))
                .andExpect(status().isUnauthorized());
        assertEquals(initialCount, bookRepository.findLibrary(ownerA.getId()).size());
    }

    @Test
    void uploadStoresMatchingEpubAndCoverInsideTheDedicatedStorageRoot() throws Exception {
        byte[] epubBytes = "synthetic epub payload".getBytes(StandardCharsets.UTF_8);
        byte[] coverBytes = "synthetic png payload".getBytes(StandardCharsets.UTF_8);
        Book book = seedBook(ownerA, sha256(epubBytes), "uploaded.epub", "Uploaded", "Author");

        upload(tokenA, book.getId(),
                new MockMultipartFile("epub", "uploaded.epub", "application/epub+zip", epubBytes),
                new MockMultipartFile("cover", "uploaded.png", "image/png", coverBytes))
                .andExpect(status().isOk());

        Path epubPath = STORAGE_ROOT.resolve("books").resolve(book.getId() + ".epub");
        Path coverPath = STORAGE_ROOT.resolve("covers").resolve(book.getId() + ".png");
        assertTrue(Files.isRegularFile(epubPath));
        assertTrue(Files.isRegularFile(coverPath));
        assertArrayEquals(epubBytes, Files.readAllBytes(epubPath));
        assertArrayEquals(coverBytes, Files.readAllBytes(coverPath));
        Book stored = bookRepository.findById(book.getId()).orElseThrow();
        assertEquals(epubPath.toString(), stored.getFileUri());
        assertEquals(coverPath.toString(), stored.getCoverUri());
    }

    @Test
    void uploadRejectsInvalidContentAndOwnershipWithoutCreatingManagedFiles() throws Exception {
        byte[] content = "content".getBytes(StandardCharsets.UTF_8);
        Book mismatch = seedBook(ownerA, uniqueHash("mismatch"), "mismatch.epub", "Mismatch", "Author");
        upload(tokenA, mismatch.getId(), new MockMultipartFile("epub", "mismatch.epub", "application/epub+zip", content), null)
                .andExpect(status().isBadRequest());
        assertNull(bookRepository.findById(mismatch.getId()).orElseThrow().getFileUri());
        assertFalse(Files.exists(STORAGE_ROOT.resolve("books").resolve(mismatch.getId() + ".epub")));

        Book empty = seedBook(ownerA, uniqueHash("empty-upload"), "empty.epub", "Empty", "Author");
        upload(tokenA, empty.getId(), null, null).andExpect(status().isBadRequest());
        assertNull(bookRepository.findById(empty.getId()).orElseThrow().getFileUri());

        Book otherOwner = seedBook(ownerB, sha256(content), "other.epub", "Other", "Owner");
        upload(tokenA, otherOwner.getId(), new MockMultipartFile("epub", "other.epub", "application/epub+zip", content), null)
                .andExpect(status().isNotFound());
        upload(tokenA, UUID.randomUUID(), new MockMultipartFile("epub", "missing.epub", "application/epub+zip", content), null)
                .andExpect(status().isNotFound());
        assertFalse(Files.exists(STORAGE_ROOT.resolve("books").resolve(otherOwner.getId() + ".epub")));
    }

    @Test
    void uploadRejectsDeclaredEpubSizeAbove100MbWithoutAllocatingAGiantFixture() throws Exception {
        byte[] smallPayload = new byte[] {1, 2, 3};
        Book book = seedBook(ownerA, uniqueHash("large"), "large.epub", "Large", "Author");
        long overLimit = 100L * 1024L * 1024L + 1;

        upload(tokenA, book.getId(), new DeclaredSizeMultipartFile(
                        "epub", "large.epub", "application/epub+zip", smallPayload, overLimit), null)
                .andExpect(status().isPayloadTooLarge());

        assertNull(bookRepository.findById(book.getId()).orElseThrow().getFileUri());
        assertFalse(Files.exists(STORAGE_ROOT.resolve("books").resolve(book.getId() + ".epub")));
    }

    @Test
    void uploadOriginalFilenameCannotEscapeTheManagedStorageRoot() throws Exception {
        byte[] content = "path-safe content".getBytes(StandardCharsets.UTF_8);
        Book book = seedBook(ownerA, sha256(content), "safe.epub", "Safe", "Author");
        Path outsideCandidate = STORAGE_ROOT.getParent().resolve("wave-1b-upload-escape-" + book.getId() + ".epub");
        externalFixtureFiles.add(outsideCandidate);

        upload(tokenA, book.getId(), new MockMultipartFile(
                        "epub", "..\\..\\" + outsideCandidate.getFileName(), "application/epub+zip", content), null)
                .andExpect(status().isOk());

        assertTrue(Files.isRegularFile(STORAGE_ROOT.resolve("books").resolve(book.getId() + ".epub")));
        assertFalse(Files.exists(outsideCandidate));
        assertTrue(Path.of(bookRepository.findById(book.getId()).orElseThrow().getFileUri())
                .toAbsolutePath().normalize().startsWith(STORAGE_ROOT.toAbsolutePath().normalize()));
    }

    @Test
    void deleteRemovesOnlyTheAuthorizedBookAndItsManagedContent() throws Exception {
        Book own = seedBookWithManagedContent(ownerA, "delete-own");
        Path epub = Path.of(own.getFileUri());
        Path cover = Path.of(own.getCoverUri());
        Path staleCover = STORAGE_ROOT.resolve("covers").resolve(own.getId() + ".png");
        Files.writeString(staleCover, "stale");

        mockMvc.perform(delete("/api/books/{id}", own.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNoContent());

        assertFalse(bookRepository.existsById(own.getId()));
        assertFalse(Files.exists(epub));
        assertFalse(Files.exists(cover));
        assertFalse(Files.exists(staleCover));
    }

    @Test
    void deleteRejectsMissingOtherOwnerAndUnauthenticatedRequestsWithoutDeletingFiles() throws Exception {
        Book otherOwner = seedBookWithManagedContent(ownerB, "delete-other");
        Path otherEpub = Path.of(otherOwner.getFileUri());
        Path otherCover = Path.of(otherOwner.getCoverUri());

        mockMvc.perform(delete("/api/books/{id}", otherOwner.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/books/{id}", UUID.randomUUID()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/books/{id}", otherOwner.getId()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/books/{id}", otherOwner.getId()).header(HttpHeaders.AUTHORIZATION, bearer("invalid-wave-1b-token")))
                .andExpect(status().isUnauthorized());

        assertTrue(bookRepository.existsById(otherOwner.getId()));
        assertTrue(Files.exists(otherEpub));
        assertTrue(Files.exists(otherCover));
    }

    @Test
    void deleteRejectsStoredPathOutsideRootWithoutDeletingDatabaseOrExternalFile() throws Exception {
        Book book = seedBook(ownerA, uniqueHash("delete-outside"), "outside.epub", "Outside", "Author");
        Path externalFile = Files.createTempFile("wave-1b-delete-outside-", ".epub");
        externalFixtureFiles.add(externalFile);
        Files.writeString(externalFile, "external");
        book.setFileUri(externalFile.toString());
        bookRepository.saveAndFlush(book);

        mockMvc.perform(delete("/api/books/{id}", book.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isInternalServerError());

        assertTrue(bookRepository.existsById(book.getId()));
        assertTrue(Files.exists(externalFile));
    }

    @Test
    void downloadIsOwnerScopedAndRequiresAnAccessibleManagedFile() throws Exception {
        byte[] ownContent = "own epub".getBytes(StandardCharsets.UTF_8);
        Book own = seedBookWithFile(ownerA, uniqueHash("download-own"), "own.epub", ownContent);
        Book noFile = seedBook(ownerA, uniqueHash("download-none"), "none.epub", "None", "Author");
        Book other = seedBookWithFile(ownerB, uniqueHash("download-other"), "other.epub", "other epub".getBytes(StandardCharsets.UTF_8));
        Book outside = seedBook(ownerA, uniqueHash("download-outside"), "outside.epub", "Outside", "Author");
        Path externalFile = Files.createTempFile("wave-1b-download-outside-", ".epub");
        externalFixtureFiles.add(externalFile);
        Files.writeString(externalFile, "outside");
        outside.setFileUri(externalFile.toString());
        bookRepository.saveAndFlush(outside);

        mockMvc.perform(get("/api/books/{id}/file", own.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isOk())
                .andExpect(result -> assertArrayEquals(ownContent, result.getResponse().getContentAsByteArray()));
        mockMvc.perform(get("/api/books/{id}/file", noFile.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/books/{id}/file", other.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/books/{id}/file", outside.getId()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/books/{id}/file", UUID.randomUUID()).header(HttpHeaders.AUTHORIZATION, bearer(tokenA)))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/books/{id}/file", own.getId()))
                .andExpect(status().isUnauthorized());
        assertTrue(Files.exists(externalFile));
    }

    @Test
    void progressPersistsValidValuesAndRejectsInvalidValuesWithoutChangingState() throws Exception {
        Book own = seedBook(ownerA, uniqueHash("progress-own"), "progress.epub", "Progress", "Author");
        Book other = seedBook(ownerB, uniqueHash("progress-other"), "other-progress.epub", "Other", "Owner");

        patchProgress(own.getId(), tokenA, "{\"lastCfi\":\"epubcfi(/6/2)\",\"progress\":0.5}")
                .andExpect(status().isOk());
        Book afterValid = bookRepository.findById(own.getId()).orElseThrow();
        assertEquals(0, afterValid.getProgress().compareTo(new BigDecimal("0.5")));
        assertEquals("epubcfi(/6/2)", afterValid.getLastCfi());
        assertNotNull(afterValid.getLastOpenedAt());

        patchProgress(own.getId(), tokenA, "{\"lastCfi\":\"invalid-range\",\"progress\":-0.1}")
                .andExpect(status().isBadRequest());
        patchProgress(own.getId(), tokenA, "{\"lastCfi\":\"invalid-range\",\"progress\":1.1}")
                .andExpect(status().isBadRequest());
        Book afterInvalid = bookRepository.findById(own.getId()).orElseThrow();
        assertEquals(0, afterInvalid.getProgress().compareTo(new BigDecimal("0.5")));
        assertEquals("epubcfi(/6/2)", afterInvalid.getLastCfi());

        patchProgress(own.getId(), tokenA, "{\"lastCfi\":\"\",\"progress\":null}")
                .andExpect(status().isOk());
        Book afterNullProgress = bookRepository.findById(own.getId()).orElseThrow();
        assertEquals(0, afterNullProgress.getProgress().compareTo(new BigDecimal("0.5")));
        assertEquals("", afterNullProgress.getLastCfi());

        patchProgress(own.getId(), tokenA, "{\"lastCfi\":null,\"progress\":0.75}")
                .andExpect(status().isOk());
        Book afterNullCfi = bookRepository.findById(own.getId()).orElseThrow();
        assertEquals(0, afterNullCfi.getProgress().compareTo(new BigDecimal("0.75")));
        assertNull(afterNullCfi.getLastCfi());

        patchProgress(own.getId(), "invalid-wave-1b-token", "{\"lastCfi\":\"unauthorized\",\"progress\":0.1}")
                .andExpect(status().isUnauthorized());
        patchProgress(other.getId(), tokenA, "{\"lastCfi\":\"wrong-owner\",\"progress\":0.1}")
                .andExpect(status().isNotFound());
        Book afterUnauthorized = bookRepository.findById(own.getId()).orElseThrow();
        assertEquals(0, afterUnauthorized.getProgress().compareTo(new BigDecimal("0.75")));
        assertNull(afterUnauthorized.getLastCfi());
        assertEquals(0, bookRepository.findById(other.getId()).orElseThrow().getProgress().compareTo(BigDecimal.ZERO));
    }

    private JsonNode library(String token, String search) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/books").header(HttpHeaders.AUTHORIZATION, bearer(token));
        if (search != null) {
            request.param("search", search);
        }
        return objectMapper.readTree(mockMvc.perform(request).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString());
    }

    private UUID createBook(String token, ObjectNode request) throws Exception {
        MvcResult result = performCreate(token, request).andExpect(status().isCreated()).andReturn();
        UUID id = UUID.fromString(objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asText());
        fixtureBookIds.add(id);
        return id;
    }

    private org.springframework.test.web.servlet.ResultActions performCreate(String token, ObjectNode request) throws Exception {
        MockHttpServletRequestBuilder builder = post("/api/books")
                .contentType(MediaType.APPLICATION_JSON)
                .content(request.toString());
        if (token != null) {
            builder.header(HttpHeaders.AUTHORIZATION, bearer(token));
        }
        return mockMvc.perform(builder);
    }

    private JsonNode bookResponse(UUID id) throws Exception {
        JsonNode books = library(tokenA, null);
        for (JsonNode book : books) {
            if (id.toString().equals(book.get("id").asText())) {
                return book;
            }
        }
        throw new AssertionError("Created book was not returned by the owner library: " + id);
    }

    private org.springframework.test.web.servlet.ResultActions upload(
            String token,
            UUID id,
            MockMultipartFile epub,
            MockMultipartFile cover
    ) throws Exception {
        var request = multipart("/api/books/{id}/content", id);
        if (epub != null) request.file(epub);
        if (cover != null) request.file(cover);
        if (token != null) request.header(HttpHeaders.AUTHORIZATION, bearer(token));
        return mockMvc.perform(request);
    }

    private org.springframework.test.web.servlet.ResultActions patchProgress(UUID id, String token, String body) throws Exception {
        MockHttpServletRequestBuilder request = patch("/api/books/{id}/progress", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body);
        if (token != null) request.header(HttpHeaders.AUTHORIZATION, bearer(token));
        return mockMvc.perform(request);
    }

    private Book seedBook(AppUser owner, String hash, String originalName, String title, String author) {
        Book book = bookRepository.saveAndFlush(new Book(owner, hash, originalName, title, author, "pt-BR"));
        fixtureBookIds.add(book.getId());
        return book;
    }

    private Book seedBookWithFile(AppUser owner, String label, String originalName, byte[] content) throws IOException {
        Book book = seedBook(owner, uniqueHash(label), originalName, label, "Author");
        Path file = STORAGE_ROOT.resolve("books").resolve(book.getId() + ".epub");
        Files.createDirectories(file.getParent());
        Files.write(file, content);
        book.setFileUri(file.toString());
        return bookRepository.saveAndFlush(book);
    }

    private Book seedBookWithManagedContent(AppUser owner, String label) throws IOException {
        Book book = seedBook(owner, uniqueHash(label), label + ".epub", label, "Author");
        Path epub = STORAGE_ROOT.resolve("books").resolve(book.getId() + ".epub");
        Path cover = STORAGE_ROOT.resolve("covers").resolve(book.getId() + ".jpg");
        Files.createDirectories(epub.getParent());
        Files.createDirectories(cover.getParent());
        Files.writeString(epub, "epub-" + label);
        Files.writeString(cover, "cover-" + label);
        book.setFileUri(epub.toString());
        book.setCoverUri(cover.toString());
        return bookRepository.saveAndFlush(book);
    }

    private void attachCover(Book book, byte[] content, String extension) throws IOException {
        Path cover = STORAGE_ROOT.resolve("covers").resolve(book.getId() + extension);
        Files.createDirectories(cover.getParent());
        Files.write(cover, content);
        book.setCoverUri(cover.toString());
        bookRepository.saveAndFlush(book);
    }

    private void deleteManagedFiles(UUID bookId) throws IOException {
        Files.deleteIfExists(STORAGE_ROOT.resolve("books").resolve(bookId + ".epub"));
        for (String extension : MANAGED_COVER_EXTENSIONS) {
            Files.deleteIfExists(STORAGE_ROOT.resolve("covers").resolve(bookId + extension));
        }
    }

    private void assertBookIds(JsonNode response, UUID... expectedIds) {
        Set<String> actualIds = new HashSet<>();
        response.forEach(book -> actualIds.add(book.get("id").asText()));
        Set<String> expected = new HashSet<>();
        for (UUID expectedId : expectedIds) expected.add(expectedId.toString());
        assertEquals(expected, actualIds);
    }

    private ObjectNode createRequest(String originalName) {
        return objectMapper.createObjectNode().put("originalName", originalName);
    }

    private ObjectNode createRequestWithHash(String originalName, String hash) {
        return createRequest(originalName).put("fileHash", hash);
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private static String uniqueHash(String label) {
        return label + "-" + UUID.randomUUID();
    }

    private static String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 not available", exception);
        }
    }

    private static Path createStorageRoot() {
        try {
            return Files.createTempDirectory("leitor-wave-1b-book-api-");
        } catch (IOException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    private static final class DeclaredSizeMultipartFile extends MockMultipartFile {
        private final long declaredSize;

        private DeclaredSizeMultipartFile(
                String name,
                String originalFilename,
                String contentType,
                byte[] content,
                long declaredSize
        ) {
            super(name, originalFilename, contentType, content);
            this.declaredSize = declaredSize;
        }

        @Override
        public long getSize() {
            return declaredSize;
        }
    }
}
