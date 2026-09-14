package br.com.leitormobile.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.leitormobile.LeitorBackendApplication;
import br.com.leitormobile.support.PostgresIntegrationTestSupport;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(classes = LeitorBackendApplication.class)
@AutoConfigureMockMvc
class SecurityConfigTest extends PostgresIntegrationTestSupport {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void unauthenticatedApiRequestReturnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/books"))
                .andExpect(status().isUnauthorized());
    }
}
