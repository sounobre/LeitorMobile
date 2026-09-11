package br.com.leitormobile.lexicon;

import br.com.leitormobile.ai.AiProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

/** Package-local bridge so the lexicon orchestration stays cohesive. */
@Component("lexiconOllamaAiProvider")
class OllamaAiProvider extends br.com.leitormobile.ai.OllamaAiProvider {
    OllamaAiProvider(AiProperties properties, ObjectMapper objectMapper) {
        super(properties, objectMapper);
    }
}

