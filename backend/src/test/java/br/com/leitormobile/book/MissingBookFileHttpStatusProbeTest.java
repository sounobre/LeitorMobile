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
import br.com.leitormobile.auth.SessionToken;
import br.com.leitormobile.auth.SessionTokenRepository;
import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
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
import java.util.EnumSet;
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
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;
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
@Import(MissingBookFileHttpStatusProbeTest.PassiveTraceConfiguration.class)
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
    private PassiveTraceRecorder passiveTraceRecorder;

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
        passiveTraceRecorder.clear();
        HttpObservation missingFileRun1 = httpGet(port, "/api/books/" + missingBook.getId() + "/file", token);
        HttpObservation missingFileRun2 = httpGet(port, "/api/books/" + missingBook.getId() + "/file", token);
        HttpObservation missingFileRun3 = httpGet(port, "/api/books/" + missingBook.getId() + "/file", token);
        List<PassiveTraceEvent> missingTrace = passiveTraceRecorder.snapshot();
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
        assertTrue(missingFileRun1.status() == 404 || missingFileRun1.status() == 401,
                "Authenticated missing-file HTTP status must be 404 or 401, got " + missingFileRun1.status());
        assertEquals(missingFileRun1.status(), missingFileRun2.status());
        assertEquals(missingFileRun1.status(), missingFileRun3.status());

        boolean requestTrace = missingTrace.stream()
                .anyMatch(event -> event.dispatcher() == DispatcherType.REQUEST
                        && event.uri().equals("/api/books/" + missingBook.getId() + "/file")
                        && event.authorizationHeaderPresent());
        boolean errorTrace = missingTrace.stream()
                .anyMatch(event -> event.dispatcher() == DispatcherType.ERROR);
        assertTrue(requestTrace, "Passive trace must observe the authenticated request dispatch.");
        if (missingFileRun1.status() == 401) {
            assertTrue(errorTrace, "401 reproduction must include an ERROR dispatch in passive trace.");
        }

        System.out.printf(
                "MISSING_FILE_PROBE mockMvc=%d realHttpRun1=%d realHttpRun2=%d realHttpRun3=%d "
                        + "list=%d existing=%d unauthenticated=%d body=%s contentType=%s trace=%s%n",
                mockMvcStatus,
                missingFileRun1.status(),
                missingFileRun2.status(),
                missingFileRun3.status(),
                authenticatedList.status(),
                existingFile.status(),
                unauthenticated.status(),
                sanitize(missingFileRun1.body()),
                missingFileRun1.contentType(),
                missingTrace
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

    private record PassiveTraceEvent(
            DispatcherType dispatcher,
            String uri,
            boolean authorizationHeaderPresent,
            boolean contextAuthenticatedBefore,
            boolean contextAuthenticatedAfter,
            int status
    ) {}

    static final class PassiveTraceRecorder {
        private final List<PassiveTraceEvent> events = new CopyOnWriteArrayList<>();

        void record(HttpServletRequest request, HttpServletResponse response, boolean before, boolean after) {
            events.add(new PassiveTraceEvent(
                    request.getDispatcherType(),
                    request.getRequestURI(),
                    request.getHeader(HttpHeaders.AUTHORIZATION) != null,
                    before,
                    after,
                    response.getStatus()
            ));
        }

        List<PassiveTraceEvent> snapshot() {
            return List.copyOf(events);
        }

        void clear() {
            events.clear();
        }
    }

    static final class PassiveTraceFilter implements Filter {
        private final PassiveTraceRecorder recorder;

        PassiveTraceFilter(PassiveTraceRecorder recorder) {
            this.recorder = recorder;
        }

        @Override
        public void doFilter(ServletRequest request, ServletResponse response, FilterChain filterChain)
                throws IOException, ServletException {
            if (!(request instanceof HttpServletRequest httpRequest)
                    || !(response instanceof HttpServletResponse httpResponse)) {
                filterChain.doFilter(request, response);
                return;
            }

            boolean before = isAuthenticated();
            try {
                filterChain.doFilter(request, response);
            } finally {
                recorder.record(httpRequest, httpResponse, before, isAuthenticated());
            }
        }

        private static boolean isAuthenticated() {
            return SecurityContextHolder.getContext().getAuthentication() != null;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class PassiveTraceConfiguration {
        @Bean
        PassiveTraceRecorder passiveTraceRecorder() {
            return new PassiveTraceRecorder();
        }

        @Bean
        FilterRegistrationBean<Filter> passiveTraceFilter(PassiveTraceRecorder recorder) {
            FilterRegistrationBean<Filter> registration = new FilterRegistrationBean<>();
            registration.setFilter(new PassiveTraceFilter(recorder));
            registration.addUrlPatterns("/*");
            registration.setDispatcherTypes(EnumSet.of(DispatcherType.REQUEST, DispatcherType.ERROR));
            registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
            return registration;
        }
    }
}
