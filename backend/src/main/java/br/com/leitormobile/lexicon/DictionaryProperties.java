package br.com.leitormobile.lexicon;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.dictionary")
public class DictionaryProperties {
    private boolean importOnStartup;
    private String importFile = "";
    private String sourceVersion = "enwiktionary-kaikki";
    private int chunkSize = 500;
    private long maxRecords;
    private int maxErrors = 1_000;

    public boolean isImportOnStartup() { return importOnStartup; }
    public void setImportOnStartup(boolean value) { this.importOnStartup = value; }
    public String getImportFile() { return importFile; }
    public void setImportFile(String value) { this.importFile = value == null ? "" : value.trim(); }
    public String getSourceVersion() { return sourceVersion; }
    public void setSourceVersion(String value) { this.sourceVersion = value == null || value.isBlank() ? "enwiktionary-kaikki" : value.trim(); }
    public int getChunkSize() { return chunkSize; }
    public void setChunkSize(int value) { this.chunkSize = Math.max(50, Math.min(5_000, value)); }
    public long getMaxRecords() { return maxRecords; }
    public void setMaxRecords(long value) { this.maxRecords = Math.max(0, value); }
    public int getMaxErrors() { return maxErrors; }
    public void setMaxErrors(int value) { this.maxErrors = Math.max(1, Math.min(100_000, value)); }
}
