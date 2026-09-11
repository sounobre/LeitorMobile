package br.com.leitormobile.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class OllamaAiProvider implements AiProvider {

    private final AiProperties properties;
    private final ObjectMapper objectMapper;

    public OllamaAiProvider(AiProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    @Override
    public ProviderResponse enrichMetadata(List<MetadataCandidate> candidates) {
        if (candidates.isEmpty()) return new ProviderResponse(List.of(), 0, 0);
        String baseUrl = properties.getOllama().getBaseUrl().replaceAll("/+$", "");
        String model = properties.getOllama().getModel();
        if (baseUrl.isBlank() || model.isBlank()) throw new OllamaUnavailableException("Ollama não está configurado.");

        Map<String, Object> request = new HashMap<>();
        request.put("model", model);
        request.put("stream", false);
        request.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt()),
                Map.of("role", "user", "content", userPrompt(candidates))
        ));
        request.put("format", responseSchema());
        request.put("options", Map.of("temperature", 0));

        OllamaResponse response;
        try {
            response = restClient(baseUrl)
                    .post()
                    .uri("/api/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(OllamaResponse.class);
        } catch (RestClientException exception) {
            throw new OllamaUnavailableException("Ollama não respondeu em " + baseUrl + ".", exception);
        }
        if (response == null || response.message() == null || response.message().content() == null) {
            throw new OllamaUnavailableException("Ollama retornou uma resposta vazia.");
        }
        try {
            JsonNode root = objectMapper.readTree(response.message().content());
            List<MetadataEnrichment> entries = new ArrayList<>();
            for (JsonNode item : root.path("entries")) {
                entries.add(new MetadataEnrichment(
                        clean(item.path("lemma").asText(), 500),
                        clean(item.path("partOfSpeech").asText(), 64),
                        clean(item.path("definition").asText(), 2_000),
                        clean(item.path("translationPtBr").asText(), 500),
                        clean(item.path("ipa").asText(), 500),
                        clean(item.path("cefr").asText(), 16),
                        clean(item.path("senseKey").asText(), 200),
                        Math.max(0, Math.min(1, item.path("confidence").asDouble(0)))
                ));
            }
            return new ProviderResponse(entries, response.promptEvalCount(), response.evalCount());
        } catch (IOException exception) {
            throw new OllamaUnavailableException("Ollama retornou JSON inválido.", exception);
        }
    }

    private RestClient restClient(String baseUrl) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(properties.getOllama().getConnectTimeoutMs()))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofMillis(properties.getOllama().getReadTimeoutMs()));
        return RestClient.builder().baseUrl(baseUrl).requestFactory(requestFactory).build();
    }

    private static String systemPrompt() {
        return "Você é um enriquecedor lexical. Retorne exclusivamente JSON conforme o schema. "
                + "Use somente os metadados fornecidos. Não peça, reproduza ou invente trechos de livros. "
                + "Definições devem ser curtas e pedagógicas; não inclua explicações fora do JSON.";
    }

    private static String userPrompt(List<MetadataCandidate> candidates) {
        StringBuilder prompt = new StringBuilder("Enriqueça estes lexemas independentes de contexto protegido:\n");
        for (MetadataCandidate candidate : candidates) {
            prompt.append("- lemma=").append(candidate.lemma())
                    .append(", pos=").append(candidate.partOfSpeech())
                    .append(", bookFrequency=").append(candidate.bookFrequency()).append('\n');
        }
        return prompt.toString();
    }

    private static Map<String, Object> responseSchema() {
        Map<String, Object> item = Map.of(
                "type", "object",
                "properties", Map.of(
                        "lemma", Map.of("type", "string"),
                        "partOfSpeech", Map.of("type", "string"),
                        "definition", Map.of("type", "string"),
                        "translationPtBr", Map.of("type", "string"),
                        "ipa", Map.of("type", "string"),
                        "cefr", Map.of("type", "string"),
                        "senseKey", Map.of("type", "string"),
                        "confidence", Map.of("type", "number")
                ),
                "required", List.of("lemma", "partOfSpeech", "definition", "translationPtBr", "ipa", "cefr", "senseKey", "confidence")
        );
        return Map.of(
                "type", "object",
                "properties", Map.of("entries", Map.of("type", "array", "items", item)),
                "required", List.of("entries")
        );
    }

    private static String clean(String value, int max) {
        if (value == null) return "";
        String sanitized = value.replaceAll("[\\u0000-\\u001F]", " ").trim();
        return sanitized.substring(0, Math.min(sanitized.length(), max));
    }

    private record OllamaResponse(
            String model,
            OllamaMessage message,
            @com.fasterxml.jackson.annotation.JsonProperty("prompt_eval_count") Integer promptEvalCount,
            @com.fasterxml.jackson.annotation.JsonProperty("eval_count") Integer evalCount
    ) {}

    private record OllamaMessage(String role, String content) {}

    public static class OllamaUnavailableException extends RuntimeException {
        public OllamaUnavailableException(String message) { super(message); }
        public OllamaUnavailableException(String message, Throwable cause) { super(message, cause); }
    }
}
