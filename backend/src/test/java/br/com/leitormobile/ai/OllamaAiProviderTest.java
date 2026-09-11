package br.com.leitormobile.ai;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class OllamaAiProviderTest {
    @Test
    void failsWhenOllamaExceedsTheConfiguredReadTimeout() throws Exception {
        CountDownLatch requestSeen = new CountDownLatch(1);
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/chat", exchange -> {
            requestSeen.countDown();
            try {
                Thread.sleep(3_000);
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
            } finally {
                exchange.close();
            }
        });
        server.start();

        try {
            AiProperties properties = new AiProperties();
            properties.setEnabled(true);
            properties.getOllama().setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
            properties.getOllama().setModel("test-model");
            properties.getOllama().setConnectTimeoutMs(1_000);
            properties.getOllama().setReadTimeoutMs(1_000);
            OllamaAiProvider provider = new OllamaAiProvider(properties, new ObjectMapper());

            assertThrows(
                    OllamaAiProvider.OllamaUnavailableException.class,
                    () -> org.junit.jupiter.api.Assertions.assertTimeout(
                            Duration.ofSeconds(2),
                            () -> provider.enrichMetadata(List.of(new AiProvider.MetadataCandidate(
                                    UUID.randomUUID(), "timeout", "UNKNOWN", 1
                            )))
                    )
            );
            assertTrue(requestSeen.await(1, TimeUnit.SECONDS));
        } finally {
            server.stop(0);
        }
    }
}
