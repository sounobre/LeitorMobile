package br.com.leitormobile.ai;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.ai")
public class AiProperties {

    private boolean enabled;
    private String provider = "none";
    private boolean localOnly = true;
    private final Ollama ollama = new Ollama();

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider == null ? "none" : provider.trim(); }
    public boolean isLocalOnly() { return localOnly; }
    public void setLocalOnly(boolean localOnly) { this.localOnly = localOnly; }
    public Ollama getOllama() { return ollama; }

    public static class Ollama {
        private String baseUrl = "http://localhost:11434";
        private String model = "gemma3";
        private int connectTimeoutMs = 2_000;
        private int readTimeoutMs = 120_000;
        private int maxCandidates = 500;

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl == null ? "" : baseUrl.trim(); }
        public String getModel() { return model; }
        public void setModel(String model) { this.model = model == null ? "" : model.trim(); }
        public int getConnectTimeoutMs() { return connectTimeoutMs; }
        public void setConnectTimeoutMs(int value) { this.connectTimeoutMs = Math.max(100, value); }
        public int getReadTimeoutMs() { return readTimeoutMs; }
        public int getMaxCandidates() { return Math.max(1, Math.min(5_000, maxCandidates)); }
        public void setMaxCandidates(int value) { this.maxCandidates = value; }
        public void setReadTimeoutMs(int value) { this.readTimeoutMs = Math.max(1_000, value); }
    }
}

