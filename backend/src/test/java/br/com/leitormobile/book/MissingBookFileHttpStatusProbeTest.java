package br.com.leitormobile.book;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.leitormobile.LeitorBackendApplication;
import br.com.leitormobile.auth.AppUser;
import br.com.leitormobile.auth.AppUserRepository;
import br.com.leitormobile.auth.AuthFilter;
import br.com.leitormobile.auth.AuthService;
import br.com.leitormobile.auth.SessionToken;
import br.com.leitormobile.auth.SessionTokenRepository;
import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(
        classes = LeitorBackendApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT
)
@AutoConfigureMockMvc
@Import(MissingBookFileHttpStatusProbeTest.TraceConfiguration.class)
class MissingBookFileHttpStatusProbeTest extends PostgresIntegrationTestSupport {

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    private static final Path STORAGE_ROOT = createStorageRoot();

    @org.springframework.boot.test.web.server.LocalServerPort
    private int port;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private SessionTokenRepository sessionTokenRepository;

    @Autowired
    private BookRepository bookRepository;

    @SpyBean
    private BookController controller;

    @SpyBean
    private BookContentService contentService;

    @Autowired
    private TraceRecorder traceRecorder;

    private AppUser owner;
    private SessionToken session;
    private String token;
    private Book missingBook;
    private Book existingBook;

    @DynamicPropertySource
    static void registerStorage(DynamicPropertyRegistry registry) {
        registry.add("app.storage-directory", STORAGE_ROOT::toString);
    }

    @BeforeEach
    void createFixture() {
        String suffix = UUID.randomUUID().toString().replace("-", "");
        owner = userRepository.saveAndFlush(
                new AppUser("missing-file-probe." + suffix + "@example.invalid", "fixture-only-password-hash")
        );
        token = "missing-file-probe-token-" + suffix;
        session = sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(token.getBytes(StandardCharsets.UTF_8)), owner, Instant.now().plusSeconds(3600))
        );
        missingBook = bookRepository.saveAndFlush(
                new Book(owner, "manual:missing-" + suffix, "missing.epub", "Missing EPUB", "Probe Author", "en")
        );
        existingBook = bookRepository.saveAndFlush(
                new Book(owner, "manual:existing-" + suffix, "existing.epub", "Existing EPUB", "Probe Author", "en")
        );
        try {
            Path file = STORAGE_ROOT.resolve("books").resolve(existingBook.getId() + ".epub");
            Files.createDirectories(file.getParent());
            Files.write(file, "synthetic epub bytes".getBytes(StandardCharsets.UTF_8));
            existingBook.setFileUri(file.toString());
            bookRepository.saveAndFlush(existingBook);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not create the managed EPUB fixture", exception);
        }
    }

    @AfterEach
    void removeFixture() throws IOException {
        if (missingBook != null) bookRepository.deleteById(missingBook.getId());
        if (existingBook != null) bookRepository.deleteById(existingBook.getId());
        bookRepository.flush();
        if (session != null) sessionTokenRepository.delete(session);
        sessionTokenRepository.flush();
        if (owner != null) userRepository.delete(owner);
        userRepository.flush();
        traceRecorder.clear();
    }

    @AfterAll
    static void removeStorage() throws IOException {
        if (!Files.exists(STORAGE_ROOT)) return;
        try (var paths = Files.walk(STORAGE_ROOT)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException exception) {
                    throw new IllegalStateException("Could not remove probe storage", exception);
                }
            });
        }
    }

    @Test
    void comparesMockMvcAndRealHttpForMissingBookFile() throws Exception {
        HttpObservation authenticatedList = httpGet(port, "/api/books", token);
        HttpObservation existingFile = httpGet(port, "/api/books/" + existingBook.getId() + "/file", token);
        traceRecorder.clear();
        HttpObservation missingFile = httpGet(port, "/api/books/" + missingBook.getId() + "/file", token);
        List<TraceEvent> missingTrace = traceRecorder.snapshot();
        HttpObservation unauthenticated = httpGet(port, "/api/books/" + missingBook.getId() + "/file", null);

        int mockMvcStatus = mockMvc.perform(
                        get("/api/books/{id}/file", missingBook.getId())
                                .header(HttpHeaders.AUTHORIZATION, bearer(token))
                )
                .andExpect(status().isNotFound())
                .andReturn()
                .getResponse()
                .getStatus();

        verify(controller, atLeastOnce()).file(eq(missingBook.getId()));
        verify(contentService, atLeastOnce()).open(eq(missingBook.getId()), eq(false));
        assertEquals(200, authenticatedList.status());
        assertTrue(authenticatedList.body().contains(missingBook.getId().toString()));
        assertEquals(200, existingFile.status());
        assertEquals("application/epub+zip", existingFile.contentType());
        assertArrayEquals("synthetic epub bytes".getBytes(StandardCharsets.UTF_8), existingFile.bodyBytes());
        assertEquals(401, unauthenticated.status());
        assertEquals(404, missingFile.status());

        boolean errorDispatch = missingTrace.stream().anyMatch(event -> event.dispatcher() == DispatcherType.ERROR);
        boolean requestDispatch = missingTrace.stream().anyMatch(event -> event.dispatcher() == DispatcherType.REQUEST);
        boolean authenticatedOriginal = missingTrace.stream()
                .filter(event -> event.dispatcher() == DispatcherType.REQUEST)
                .anyMatch(event -> event.contextAuthenticatedAfter());
        boolean authenticatedError = missingTrace.stream()
                .filter(event -> event.dispatcher() == DispatcherType.ERROR)
                .anyMatch(event -> event.contextAuthenticatedAfter());

        assertTrue(errorDispatch);
        assertTrue(requestDispatch);
        assertTrue(authenticatedOriginal);
        assertTrue(authenticatedError);

        System.out.printf(
                "MISSING_FILE_PROBE mockMvc=%d realHttp=%d list=%d existing=%d unauthenticated=%d "
                        + "body=%s contentType=%s trace=%s errorDispatch=%s requestDispatch=%s "
                        + "authenticatedOriginal=%s authenticatedError=%s%n",
                mockMvcStatus,
                missingFile.status(),
                authenticatedList.status(),
                existingFile.status(),
                unauthenticated.status(),
                sanitize(missingFile.body()),
                missingFile.contentType(),
                missingTrace,
                errorDispatch,
                requestDispatch,
                authenticatedOriginal,
                authenticatedError
        );

    }

    private HttpObservation httpGet(int port, String path, String bearerToken) throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + path))
                .GET();
        if (bearerToken != null) request.header(HttpHeaders.AUTHORIZATION, bearer(bearerToken));
        HttpResponse<byte[]> response = HTTP.send(request.build(), HttpResponse.BodyHandlers.ofByteArray());
        String contentType = response.headers().firstValue(HttpHeaders.CONTENT_TYPE).orElse("");
        return new HttpObservation(response.statusCode(), contentType, response.body());
    }

    private static String bearer(String value) {
        return "Bearer " + value;
    }

    private static String sanitize(String value) {
        String normalized = value.replaceAll("[\\r\\n]+", " ");
        return normalized.length() <= 300 ? normalized : normalized.substring(0, 300);
    }

    private static String sha256(byte[] value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (NoSuchAlgorithmException exception) {
            throw new AssertionError("SHA-256 is required for the token fixture", exception);
        }
    }

    private static Path createStorageRoot() {
        try {
            return Files.createTempDirectory("LeitorMissingFileHttpProbe-");
        } catch (IOException exception) {
            throw new ExceptionInInitializerError(exception);
        }
    }

    private record HttpObservation(int status, String contentType, byte[] bodyBytes) {
        String body() {
            return new String(bodyBytes, StandardCharsets.UTF_8);
        }
    }

    private record TraceEvent(
            DispatcherType dispatcher,
            String uri,
            boolean authorizationHeaderPresent,
            boolean contextAuthenticatedBefore,
            boolean contextAuthenticatedAfter,
            int status
    ) {}

    static final class TraceRecorder {
        private final List<TraceEvent> events = new CopyOnWriteArrayList<>();

        void record(HttpServletRequest request, HttpServletResponse response, boolean before, boolean after) {
            events.add(new TraceEvent(
                    request.getDispatcherType(),
                    request.getRequestURI(),
                    request.getHeader(HttpHeaders.AUTHORIZATION) != null,
                    before,
                    after,
                    response.getStatus()
            ));
        }

        List<TraceEvent> snapshot() {
            return List.copyOf(events);
        }

        void clear() {
            events.clear();
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TraceConfiguration {
        @Bean
        TraceRecorder traceRecorder() {
            return new TraceRecorder();
        }

        @Bean
        @Primary
        AuthFilter tracedAuthFilter(AuthService authService, TraceRecorder recorder) {
            return new AuthFilter(authService) {
                @Override
                protected boolean shouldNotFilterErrorDispatch() {
                    return false;
                }

                @Override
                protected void doFilterInternal(
                        HttpServletRequest request,
                        HttpServletResponse response,
                        FilterChain filterChain
                ) throws ServletException, IOException {
                    boolean before = SecurityContextHolder.getContext().getAuthentication() != null;
                    super.doFilterInternal(request, response, filterChain);
                    boolean after = SecurityContextHolder.getContext().getAuthentication() != null;
                    recorder.record(request, response, before, after);
                }
            };
        }
    }
}
