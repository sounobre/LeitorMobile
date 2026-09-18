package br.com.leitormobile.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class OllamaAiProviderTest {
    @Test
    void sendsMetadataOnlyRequestAndParsesValidResponse() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        CountDownLatch requestSeen = new CountDownLatch(1);
        AtomicReference<String> method = new AtomicReference<>();
        AtomicReference<String> path = new AtomicReference<>();
        AtomicReference<String> requestBody = new AtomicReference<>();
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/chat", exchange -> {
            method.set(exchange.getRequestMethod());
            path.set(exchange.getRequestURI().getPath());
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            requestSeen.countDown();

            String structuredContent = objectMapper.writeValueAsString(Map.of(
                    "entries", List.of(
                            Map.of(
                                    "lemma", "wander",
                                    "partOfSpeech", "VERB",
                                    "definition", "move without a fixed direction",
                                    "translationPtBr", "vagar",
                                    "ipa", "/ˈwɒndə/",
                                    "cefr", "B1",
                                    "senseKey", "wander.v.01",
                                    "confidence", 0.93
                            ),
                            Map.of(
                                    "lemma", "light",
                                    "partOfSpeech", "NOUN",
                                    "definition", "illumination",
                                    "translationPtBr", "luz",
                                    "ipa", "/laɪt/",
                                    "cefr", "A2",
                                    "senseKey", "light.n.01",
                                    "confidence", 0.81
                            )
                    )
            ));
            String responseBody = objectMapper.writeValueAsString(Map.of(
                    "model", "fake-model",
                    "message", Map.of("role", "assistant", "content", structuredContent),
                    "prompt_eval_count", 17,
                    "eval_count", 29
            ));
            byte[] responseBytes = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, responseBytes.length);
            try (OutputStream response = exchange.getResponseBody()) {
                response.write(responseBytes);
            } finally {
                exchange.close();
            }
        });
        server.start();

        try {
            AiProperties properties = propertiesFor(server, "fake-model");
            OllamaAiProvider provider = new OllamaAiProvider(properties, objectMapper);
            String protectedExcerpt = "PROTECTED_BOOK_EXCERPT_SHOULD_NOT_LEAVE";

            AiProvider.ProviderResponse response = provider.enrichMetadata(List.of(
                    new AiProvider.MetadataCandidate(UUID.randomUUID(), "wander", "VERB", 7),
                    new AiProvider.MetadataCandidate(UUID.randomUUID(), "light", "NOUN", 4)
            ));

            assertTrue(requestSeen.await(1, TimeUnit.SECONDS));
            assertEquals("POST", method.get());
            assertEquals("/api/chat", path.get());
            assertEquals(2, response.entries().size());
            assertEquals("wander", response.entries().get(0).lemma());
            assertEquals("VERB", response.entries().get(0).partOfSpeech());
            assertEquals("move without a fixed direction", response.entries().get(0).definition());
            assertEquals("vagar", response.entries().get(0).translationPtBr());
            assertEquals("/ˈwɒndə/", response.entries().get(0).ipa());
            assertEquals("B1", response.entries().get(0).cefr());
            assertEquals("wander.v.01", response.entries().get(0).senseKey());
            assertEquals(0.93, response.entries().get(0).confidence());
            assertEquals("light", response.entries().get(1).lemma());
            assertEquals(17, response.inputTokens());
            assertEquals(29, response.outputTokens());

            var request = objectMapper.readTree(requestBody.get());
            assertEquals("fake-model", request.path("model").asText());
            assertTrue(request.has("stream"));
            assertFalse(request.path("stream").asBoolean());
            assertTrue(request.path("messages").isArray());
            assertTrue(request.path("format").isObject());
            assertTrue(request.path("format").path("properties").path("entries").isObject());
            String serializedRequest = requestBody.get();
            assertTrue(serializedRequest.contains("wander"));
            assertTrue(serializedRequest.contains("pos=VERB"));
            assertTrue(serializedRequest.contains("bookFrequency=7"));
            assertFalse(serializedRequest.contains(protectedExcerpt));
        } finally {
            server.stop(0);
        }
    }

    @Test
    void failsWhenOllamaReturnsInvalidStructuredContent() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/chat", exchange -> {
            byte[] responseBytes = "{\"message\":{\"role\":\"assistant\",\"content\":\"not-json\"}}"
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, responseBytes.length);
            try (OutputStream response = exchange.getResponseBody()) {
                response.write(responseBytes);
            } finally {
                exchange.close();
            }
        });
        server.start();

        try {
            OllamaAiProvider provider = new OllamaAiProvider(propertiesFor(server, "fake-model"), new ObjectMapper());
            assertThrows(
                    OllamaAiProvider.OllamaUnavailableException.class,
                    () -> provider.enrichMetadata(List.of(
                            new AiProvider.MetadataCandidate(UUID.randomUUID(), "invalid", "NOUN", 1)
                    ))
            );
        } finally {
            server.stop(0);
        }
    }

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

    private static AiProperties propertiesFor(HttpServer server, String model) {
        AiProperties properties = new AiProperties();
        properties.setEnabled(true);
        properties.getOllama().setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        properties.getOllama().setModel(model);
        properties.getOllama().setConnectTimeoutMs(1_000);
        properties.getOllama().setReadTimeoutMs(1_000);
        return properties;
    }
}
