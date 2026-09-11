package br.com.leitormobile.lexicon;

import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DictionaryImportStartup implements ApplicationRunner {
    private static final Logger LOGGER = LoggerFactory.getLogger(DictionaryImportStartup.class);
    private final DictionaryProperties properties;
    private final KaikkiDictionaryImporter importer;

    public DictionaryImportStartup(DictionaryProperties properties, KaikkiDictionaryImporter importer) {
        this.properties = properties;
        this.importer = importer;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!properties.isImportOnStartup()) return;
        if (properties.getImportFile().isBlank()) throw new IllegalStateException("app.dictionary.import-file precisa apontar para um JSONL/JSONL.GZ do Kaikki.");
        LOGGER.info("dictionary_import_starting file={} maxRecords={} chunkSize={}", properties.getImportFile(), properties.getMaxRecords(), properties.getChunkSize());
        importer.importFile(Path.of(properties.getImportFile()));
    }
}
