package br.com.leitormobile.health;

import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.leitormobile.LeitorBackendApplication;
import br.com.leitormobile.auth.AppUser;
import br.com.leitormobile.auth.AppUserRepository;
import br.com.leitormobile.auth.SessionToken;
import br.com.leitormobile.auth.SessionTokenRepository;
import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(classes = {
        LeitorBackendApplication.class,
        ActuatorContractTest.DegradedHealthConfiguration.class
})
@AutoConfigureMockMvc
class ActuatorContractTest extends PostgresIntegrationTestSupport {

    private static final AtomicBoolean DEGRADED = new AtomicBoolean();

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository userRepository;

    @Autowired
    private SessionTokenRepository sessionTokenRepository;

    private AppUser fixtureUser;
    private SessionToken fixtureSession;
    private String fixtureToken;

    @BeforeEach
    void createSyntheticSession() {
        DEGRADED.set(false);
        String suffix = UUID.randomUUID().toString().replace("-", "");
        fixtureUser = userRepository.saveAndFlush(
                new AppUser("wave1dc.actuator." + suffix + "@example.invalid", "fixture-only-password-hash")
        );
        fixtureToken = "wave1d-c-actuator-token-" + suffix;
        fixtureSession = sessionTokenRepository.saveAndFlush(
                new SessionToken(sha256(fixtureToken), fixtureUser, Instant.now().plusSeconds(3600))
        );
    }

    @AfterEach
    void removeSyntheticSession() {
        DEGRADED.set(false);
        if (fixtureSession != null) {
            sessionTokenRepository.delete(fixtureSession);
            fixtureSession = null;
        }
        if (fixtureUser != null) {
            userRepository.delete(fixtureUser);
            fixtureUser = null;
        }
    }

    @Test
    void healthIsPublicAndReportsUpWhenDatabaseIsAvailable() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("UP")));
    }

    @Test
    void infoRequiresAuthenticationAndReturnsTheObservedEmptyPayload() throws Exception {
        mockMvc.perform(get("/actuator/info"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/actuator/info").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(content().json("{}"));
    }

    @Test
    void invalidBearerTokenCannotAccessInfo() throws Exception {
        mockMvc.perform(get("/actuator/info").header("Authorization", "Bearer invalid-wave-1d-c-token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void testOnlyHealthContributorProducesObservedDegradedHealth() throws Exception {
        DEGRADED.set(true);

        MvcResult result = mockMvc.perform(get("/actuator/health")).andReturn();
        JsonNode payload = objectMapper.readTree(result.getResponse().getContentAsString());

        assertEquals(503, result.getResponse().getStatus());
        assertEquals("DOWN", payload.path("status").asText());
    }

    @Test
    void nonExposedActuatorEndpointRemainsUnavailableWithValidSession() throws Exception {
        mockMvc.perform(get("/actuator/env").header("Authorization", bearer()))
                .andExpect(status().isNotFound());
    }

    private String bearer() {
        return "Bearer " + fixtureToken;
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

    @TestConfiguration(proxyBeanMethods = false)
    static class DegradedHealthConfiguration {
        @Bean
        HealthIndicator wave1dCHealthFixture() {
            return () -> DEGRADED.get()
                    ? Health.down().withDetail("fixture", "controlled-test-degradation").build()
                    : Health.up().build();
        }
    }
}
