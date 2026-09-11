package br.com.leitormobile.ai;

import java.net.URI;
import java.util.Locale;

import org.springframework.stereotype.Component;

@Component
public class CopyrightPrivacyGate {

    private final AiProperties properties;

    public CopyrightPrivacyGate(AiProperties properties) {
        this.properties = properties;
    }

    public void check(String provider, ExternalContextDecision decision) {
        if (!decision.allowed()) throw new CopyrightPolicyException(decision.justification());
        if (!properties.isLocalOnly() || !provider.equalsIgnoreCase("ollama")) return;

        URI uri = URI.create(properties.getOllama().getBaseUrl());
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!"http".equalsIgnoreCase(uri.getScheme()) || !isLocalHost(host)) {
            throw new CopyrightPolicyException("Ollama está configurado fora do modo local-only.");
        }
        String model = properties.getOllama().getModel().toLowerCase(Locale.ROOT);
        if (model.contains("cloud")) {
            throw new CopyrightPolicyException("Modelos cloud do Ollama são bloqueados pelo modo local-only.");
        }
    }

    private static boolean isLocalHost(String host) {
        return host.equals("localhost") || host.equals("127.0.0.1") || host.equals("::1") || host.equals("ollama");
    }

    public static class CopyrightPolicyException extends RuntimeException {
        public CopyrightPolicyException(String message) { super(message); }
    }
}
