package br.com.leitormobile.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.leitormobile.LeitorBackendApplication;
import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(classes = LeitorBackendApplication.class)
@AutoConfigureMockMvc
class AuthControllerTest extends PostgresIntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private AppUserRepository appUserRepository;

    @Autowired
    private SessionTokenRepository sessionTokenRepository;

    @Value("${app.auth.email}")
    private String knownEmail;

    @Test
    void knownUserWithIncorrectPasswordDoesNotCreateAuthenticatedSession() throws Exception {
        appUserRepository.findByEmailIgnoreCase(knownEmail)
                .orElseThrow(() -> new AssertionError("test account was not seeded"));
        long sessionsBefore = sessionTokenRepository.count();

        mockMvc.perform(loginRequest(knownEmail, "invalid-wave-1a-password"))
                .andExpect(status().isUnauthorized());

        assertEquals(sessionsBefore, sessionTokenRepository.count(),
                "invalid credentials must not persist a session token");
    }

    @Test
    void unknownUserDoesNotCreateAuthenticatedSession() throws Exception {
        long sessionsBefore = sessionTokenRepository.count();

        mockMvc.perform(loginRequest("missing-wave-1a@example.invalid", "irrelevant-password"))
                .andExpect(status().isUnauthorized());

        assertEquals(sessionsBefore, sessionTokenRepository.count(),
                "unknown credentials must not persist a session token");
    }

    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder loginRequest(
            String email,
            String password
    ) {
        return post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }
}
