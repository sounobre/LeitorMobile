package br.com.leitormobile.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.leitormobile.LeitorBackendApplication;
import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(classes = LeitorBackendApplication.class)
@AutoConfigureMockMvc
class SecurityConfigTest extends PostgresIntegrationTestSupport {

    private static final String EXPIRED_TOKEN = "expired-token-wave-1a";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private SessionTokenRepository sessionTokenRepository;

    @Value("${app.auth.email}")
    private String knownEmail;

    private SessionToken expiredFixture;

    @AfterEach
    void removeExpiredFixture() {
        if (expiredFixture != null) {
            sessionTokenRepository.delete(expiredFixture);
            expiredFixture = null;
        }
    }

    @Test
    void unauthenticatedApiRequestReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/books"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void malformedBearerTokenReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/books").header("Authorization", "Bearer"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unknownBearerTokenReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/books").header("Authorization", "Bearer token-not-in-test-database"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredBearerTokenReturnsUnauthorized() throws Exception {
        AppUser user = appUserRepository.findByEmailIgnoreCase(knownEmail)
                .orElseThrow(() -> new AssertionError("test account was not seeded"));
        expiredFixture = sessionTokenRepository.save(
                new SessionToken(sha256(EXPIRED_TOKEN), user, Instant.EPOCH)
        );

        mockMvc.perform(get("/api/books").header("Authorization", "Bearer " + EXPIRED_TOKEN))
                .andExpect(status().isUnauthorized());
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
