package br.com.leitormobile.lexicon;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.zip.GZIPInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class KaikkiDictionaryImporter {
    private static final Logger LOGGER = LoggerFactory.getLogger(KaikkiDictionaryImporter.class);
    private static final String SOURCE_KEY = "KAIKKI_WIKTIONARY_EN";
    private static final String SOURCE = "KAIKKI_WIKTIONARY";
    private static final String SOURCE_URL = "https://kaikki.org/dictionary/English/";
    private static final String LICENSE_URL = "https://en.wiktionary.org/wiki/Wiktionary:Copyrights";

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final DictionaryProperties properties;
    private final TransactionTemplate transaction;

    public KaikkiDictionaryImporter(JdbcTemplate jdbc, ObjectMapper mapper, DictionaryProperties properties,
                                    PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.properties = properties;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    public ImportResult importFile(Path file) {
        Path normalized = file.toAbsolutePath().normalize();
        if (!Files.isRegularFile(normalized)) throw new IllegalArgumentException("Arquivo Kaikki não encontrado: " + normalized);
        try {
            long size = Files.size(normalized);
            String hash = sha256(normalized);
            UUID sourceId = ensureSource(hash);
            Optional<UUID> completed = findCompletedBatch(sourceId, hash);
            if (completed.isPresent()) {
                LOGGER.info("dictionary_import_skipped source={} batchId={} reason=already_completed", SOURCE_KEY, completed.get());
                return new ImportResult(completed.get(), "SKIPPED", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
            }

            UUID batchId = createBatch(sourceId, normalized, hash, size);
            Counters counters = new Counters();
            List<ParsedEntry> chunk = new ArrayList<>(properties.getChunkSize());
            boolean reachedLimit = false;
            try (InputStream raw = Files.newInputStream(normalized);
                 InputStream decoded = normalized.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".gz")
                         ? new GZIPInputStream(raw, 64 * 1024) : raw;
                 BufferedReader reader = new BufferedReader(new InputStreamReader(decoded, StandardCharsets.UTF_8), 128 * 1024)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    counters.recordsRead++;
                    if (line.isBlank()) continue;
                    try {
                        ParsedEntry entry = parse(line);
                        if (entry == null) continue;
                        chunk.add(entry);
                        counters.recordsAccepted++;
                        if (chunk.size() >= properties.getChunkSize()) {
                            writeChunk(chunk, counters);
                            chunk.clear();
                            updateProgress(batchId, counters);
                        }
                        if (properties.getMaxRecords() > 0 && counters.recordsAccepted >= properties.getMaxRecords()) {
                            reachedLimit = true;
                            break;
                        }
                    } catch (Exception exception) {
                        counters.errors++;
                        if (counters.errors <= 10 || counters.errors % 100 == 0) LOGGER.warn(
                                "dictionary_import_record_failed batchId={} line={} message={}", batchId, counters.recordsRead, safeMessage(exception));
                        if (counters.errors > properties.getMaxErrors()) throw new IllegalStateException(
                                "Limite de erros do importador excedido: " + counters.errors, exception);
                    }
                }
                if (!chunk.isEmpty()) {
                    writeChunk(chunk, counters);
                    updateProgress(batchId, counters);
                }
            }
            String status = reachedLimit ? "PARTIAL" : "COMPLETED";
            finishBatch(batchId, status, counters, null);
            LOGGER.info("dictionary_import_completed batchId={} status={} recordsRead={} accepted={} lexemes={} forms={} senses={} translations={} pronunciations={} examples={} relations={} errors={}",
                    batchId, status, counters.recordsRead, counters.recordsAccepted, counters.lexemes, counters.forms, counters.senses,
                    counters.translations, counters.pronunciations, counters.examples, counters.relations, counters.errors);
            return counters.result(batchId, status);
        } catch (Exception exception) {
            throw new IllegalStateException("Importação Kaikki falhou: " + safeMessage(exception), exception);
        }
    }

    private void writeChunk(List<ParsedEntry> entries, Counters counters) {
        transaction.executeWithoutResult(status -> {
            Map<EntryKey, ParsedEntry> unique = new LinkedHashMap<>();
            for (ParsedEntry entry : entries) unique.merge(new EntryKey(entry.lemma(), entry.partOfSpeech()), entry, ParsedEntry::merge);

            jdbc.batchUpdate("INSERT INTO lexemes(language, lemma, part_of_speech) VALUES ('en', ?, ?) ON CONFLICT (language, lemma, part_of_speech) DO NOTHING",
                    unique.keySet().stream().map(key -> new Object[] {key.lemma(), key.partOfSpeech()}).toList());
            Map<EntryKey, UUID> lexemeIds = findLexemeIds(unique.keySet());

            Set<FormKey> forms = new LinkedHashSet<>();
            for (ParsedEntry entry : unique.values()) {
                UUID lexemeId = lexemeIds.get(new EntryKey(entry.lemma(), entry.partOfSpeech()));
                if (lexemeId == null) continue;
                forms.add(new FormKey(lexemeId, entry.lemma()));
                for (String form : entry.forms()) forms.add(new FormKey(lexemeId, form));
            }
            jdbc.batchUpdate("INSERT INTO word_forms(lexeme_id, form) VALUES (?, ?) ON CONFLICT (lexeme_id, form) DO NOTHING",
                    forms.stream().map(form -> new Object[] {form.lexemeId(), form.form()}).toList());

            jdbc.batchUpdate("""
                    INSERT INTO dictionary_entries(lexeme_id, definition, translation_pt_br, ipa, cefr, source, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'KAIKKI_WIKTIONARY', now())
                    ON CONFLICT (lexeme_id) DO UPDATE SET
                        definition = CASE WHEN EXCLUDED.definition <> '' THEN EXCLUDED.definition ELSE dictionary_entries.definition END,
                        translation_pt_br = CASE WHEN EXCLUDED.translation_pt_br <> '' THEN EXCLUDED.translation_pt_br ELSE dictionary_entries.translation_pt_br END,
                        ipa = CASE WHEN EXCLUDED.ipa <> '' THEN EXCLUDED.ipa ELSE dictionary_entries.ipa END,
                        cefr = CASE WHEN EXCLUDED.cefr <> '' THEN EXCLUDED.cefr ELSE dictionary_entries.cefr END,
                        source = 'KAIKKI_WIKTIONARY', updated_at = now()
                    """,
                    unique.values().stream().map(entry -> new Object[] {
                            lexemeIds.get(new EntryKey(entry.lemma(), entry.partOfSpeech())), entry.definition(), entry.translationPtBr(), entry.ipa(), entry.cefr()
                    }).toList());
            Map<EntryKey, UUID> entryIds = findEntryIds(lexemeIds);

            Map<SenseKeyId, Sense> senseData = new LinkedHashMap<>();
            for (ParsedEntry entry : unique.values()) {
                UUID dictionaryId = entryIds.get(new EntryKey(entry.lemma(), entry.partOfSpeech()));
                if (dictionaryId == null) continue;
                for (Sense sense : entry.senses()) senseData.putIfAbsent(new SenseKeyId(dictionaryId, sense.key()), sense);
            }
            jdbc.batchUpdate("""
                    INSERT INTO lexical_senses(dictionary_entry_id, sense_key, definition, translation_pt_br, cefr, source)
                    VALUES (?, ?, ?, ?, ?, 'KAIKKI_WIKTIONARY')
                    ON CONFLICT (dictionary_entry_id, sense_key) DO UPDATE SET
                        definition = CASE WHEN EXCLUDED.definition <> '' THEN EXCLUDED.definition ELSE lexical_senses.definition END,
                        translation_pt_br = CASE WHEN EXCLUDED.translation_pt_br <> '' THEN EXCLUDED.translation_pt_br ELSE lexical_senses.translation_pt_br END,
                        cefr = CASE WHEN EXCLUDED.cefr <> '' THEN EXCLUDED.cefr ELSE lexical_senses.cefr END,
                        source = 'KAIKKI_WIKTIONARY'
                    """,
                    senseData.entrySet().stream().map(item -> new Object[] {
                            item.getKey().dictionaryId(), item.getKey().senseKey(), item.getValue().definition(), item.getValue().translationPtBr(), item.getValue().cefr()
                    }).toList());
            Map<SenseKeyId, UUID> senseIds = findSenseIds(senseData.keySet());

            List<Object[]> translations = new ArrayList<>();
            List<Object[]> examples = new ArrayList<>();
            for (ParsedEntry entry : unique.values()) {
                UUID dictionaryId = entryIds.get(new EntryKey(entry.lemma(), entry.partOfSpeech()));
                if (dictionaryId == null) continue;
                for (Sense sense : entry.senses()) {
                    UUID senseId = senseIds.get(new SenseKeyId(dictionaryId, sense.key()));
                    if (senseId == null) continue;
                    for (Translation item : sense.translations()) translations.add(new Object[] {senseId, item.language(), item.word(), item.qualifier(), SOURCE});
                    for (Example item : sense.examples()) examples.add(new Object[] {senseId, item.text(), item.translation(), SOURCE});
                }
            }
            jdbc.batchUpdate("INSERT INTO dictionary_translations(lexical_sense_id, language, translation, qualifier, source) VALUES (?, ?, ?, ?, ?) ON CONFLICT (lexical_sense_id, language, translation) DO UPDATE SET qualifier = EXCLUDED.qualifier, source = EXCLUDED.source", translations);
            jdbc.batchUpdate("INSERT INTO lexical_examples(lexical_sense_id, example_text, translation_text, source) VALUES (?, ?, ?, ?)", examples);

            List<Object[]> pronunciations = new ArrayList<>();
            List<Object[]> relations = new ArrayList<>();
            for (ParsedEntry entry : unique.values()) {
                UUID dictionaryId = entryIds.get(new EntryKey(entry.lemma(), entry.partOfSpeech()));
                UUID lexemeId = lexemeIds.get(new EntryKey(entry.lemma(), entry.partOfSpeech()));
                if (dictionaryId == null || lexemeId == null) continue;
                for (Pronunciation item : entry.pronunciations()) pronunciations.add(new Object[] {dictionaryId, item.ipa(), item.audioUrl(), item.dialect(), SOURCE});
                for (Relation item : entry.relations()) relations.add(new Object[] {
                        lexemeId, item.type(), item.language(), item.lemma(), item.language().equals("en") ? lexemeIds.get(new EntryKey(item.lemma(), item.partOfSpeech())) : null, SOURCE
                });
            }
            jdbc.batchUpdate("INSERT INTO dictionary_pronunciations(dictionary_entry_id, ipa, audio_url, dialect, source) VALUES (?, ?, ?, ?, ?) ON CONFLICT (dictionary_entry_id, ipa, audio_url) DO NOTHING", pronunciations);
            jdbc.batchUpdate("INSERT INTO lexical_relations(source_lexeme_id, relation_type, target_language, target_lemma, target_lexeme_id, source) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (source_lexeme_id, relation_type, target_language, target_lemma) DO NOTHING", relations);

            counters.lexemes += unique.size();
            counters.forms += forms.size();
            counters.senses += senseData.size();
            counters.translations += translations.size();
            counters.pronunciations += pronunciations.size();
            counters.examples += examples.size();
            counters.relations += relations.size();
        });
    }

    private ParsedEntry parse(String line) throws IOException {
        JsonNode root = mapper.readTree(line);
        if (root == null || !isEnglish(root)) return null;
        String word = normalize(root.path("word").asText(""));
        if (word.isBlank() || word.length() > 500) return null;
        String pos = normalizePos(root.path("pos").asText("unknown"));
        List<Sense> senses = parseSenses(root, word, pos);
        String definition = senses.stream().map(Sense::definition).filter(value -> !value.isBlank()).findFirst().orElse("");
        String translation = senses.stream().flatMap(sense -> sense.translations().stream()).filter(item -> item.language().equals("pt")).map(Translation::word).filter(value -> !value.isBlank()).findFirst().orElse("");
        String ipa = array(root.path("sounds")).stream().map(sound -> clean(sound.path("ipa").asText(""))).filter(value -> !value.isBlank()).findFirst().orElse("");
        List<Pronunciation> pronunciations = array(root.path("sounds")).stream().map(KaikkiDictionaryImporter::toPronunciation).filter(Objects::nonNull).distinct().toList();
        List<String> forms = array(root.path("forms")).stream().map(form -> normalize(form.path("form").asText(""))).filter(value -> !value.isBlank() && value.length() <= 500).distinct().toList();
        List<Relation> relations = senses.stream().flatMap(sense -> sense.relations().stream()).distinct().toList();
        return new ParsedEntry(word, pos, definition, translation, ipa, "", forms, senses, pronunciations, relations);
    }

    private List<Sense> parseSenses(JsonNode root, String word, String pos) {
        List<Sense> result = new ArrayList<>();
        List<Translation> rootTranslations = parseTranslations(root.path("translations"));
        int index = 0;
        for (JsonNode node : array(root.path("senses"))) {
            String key = normalizeSenseKey(node, word, pos, index++);
            String definition = joinText(node.path("glosses"));
            String cefr = findCefr(node);
            List<Translation> translations = parseTranslations(node.path("translations"));
            if (translations.isEmpty()) translations = rootTranslations;
            List<Example> examples = array(node.path("examples")).stream()
                    .map(example -> new Example(clean(example.path("text").asText("")), clean(example.path("english").asText(""))))
                    .filter(example -> !example.text().isBlank()).distinct().toList();
            List<Relation> relations = new ArrayList<>();
            Map<String, String> relationTypes = Map.of("synonyms", "SYNONYM", "antonyms", "ANTONYM", "hypernyms", "HYPERNYM", "hyponyms", "HYPONYM", "related", "RELATED", "derived", "DERIVED");
            for (Map.Entry<String, String> relationType : relationTypes.entrySet()) {
                for (JsonNode relation : array(node.path(relationType.getKey()))) {
                    String target = normalize(relation.path("word").asText(""));
                    if (!target.isBlank() && target.length() <= 500) relations.add(new Relation(relationType.getValue(), "en", target, normalizePos(relation.path("pos").asText("unknown"))));
                }
            }
            result.add(new Sense(key, definition, translations.stream().filter(item -> item.language().equals("pt")).map(Translation::word).findFirst().orElse(""), cefr, translations, examples, relations));
        }
        if (result.isEmpty()) {
            List<Translation> translations = parseTranslations(root.path("translations"));
            result.add(new Sense(word + "|" + pos + "|0", "", translations.stream().filter(item -> item.language().equals("pt")).map(Translation::word).findFirst().orElse(""), "", translations, List.of(), List.of()));
        }
        return result;
    }

    private static List<Translation> parseTranslations(JsonNode node) {
        List<Translation> values = new ArrayList<>();
        for (JsonNode item : array(node)) {
            String language = normalizeLanguage(item.path("code").asText(""));
            String word = clean(item.path("word").asText(""));
            if (language.equals("pt") && !word.isBlank() && word.length() <= 500) values.add(new Translation(language, word, clean(firstNonBlank(item.path("note").asText(""), item.path("sense").asText("")))));
        }
        return values.stream().distinct().toList();
    }

    private static Pronunciation toPronunciation(JsonNode node) {
        String ipa = clean(node.path("ipa").asText(""));
        String audio = firstNonBlank(clean(node.path("mp3_url").asText("")), clean(node.path("ogg_url").asText("")));
        String dialect = joinText(node.path("tags"));
        if (ipa.isBlank() && audio.isBlank()) return null;
        return new Pronunciation(ipa, audio, dialect);
    }

    private Map<EntryKey, UUID> findLexemeIds(Collection<EntryKey> keys) {
        if (keys.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(keys.size(), "(?, ?)"));
        List<Object> args = new ArrayList<>();
        for (EntryKey key : keys) { args.add(key.lemma()); args.add(key.partOfSpeech()); }
        Map<EntryKey, UUID> result = new HashMap<>();
        jdbc.query("SELECT id, lemma, part_of_speech FROM lexemes WHERE language = 'en' AND (lemma, part_of_speech) IN (" + placeholders + ")",
                args.toArray(), (org.springframework.jdbc.core.RowCallbackHandler) rs -> result.put(new EntryKey(rs.getString("lemma"), rs.getString("part_of_speech")), rs.getObject("id", UUID.class)));
        return result;
    }

    private Map<EntryKey, UUID> findEntryIds(Map<EntryKey, UUID> lexemes) {
        if (lexemes.isEmpty()) return Map.of();
        String placeholders = String.join(",", Collections.nCopies(lexemes.size(), "?"));
        Map<UUID, UUID> byLexeme = new HashMap<>();
        jdbc.query("SELECT id, lexeme_id FROM dictionary_entries WHERE lexeme_id IN (" + placeholders + ")", lexemes.values().toArray(),
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> byLexeme.put(rs.getObject("lexeme_id", UUID.class), rs.getObject("id", UUID.class)));
        Map<EntryKey, UUID> result = new HashMap<>();
        for (Map.Entry<EntryKey, UUID> item : lexemes.entrySet()) result.put(item.getKey(), byLexeme.get(item.getValue()));
        return result;
    }

    private Map<SenseKeyId, UUID> findSenseIds(Collection<SenseKeyId> keys) {
        if (keys.isEmpty()) return Map.of();
        String where = String.join(" OR ", Collections.nCopies(keys.size(), "(dictionary_entry_id = ? AND sense_key = ?)"));
        List<Object> args = new ArrayList<>();
        for (SenseKeyId key : keys) { args.add(key.dictionaryId()); args.add(key.senseKey()); }
        Map<SenseKeyId, UUID> result = new HashMap<>();
        jdbc.query("SELECT id, dictionary_entry_id, sense_key FROM lexical_senses WHERE " + where, args.toArray(),
                (org.springframework.jdbc.core.RowCallbackHandler) rs -> result.put(new SenseKeyId(rs.getObject("dictionary_entry_id", UUID.class), rs.getString("sense_key")), rs.getObject("id", UUID.class)));
        return result;
    }

    private UUID ensureSource(String hash) {
        return jdbc.queryForObject("""
                INSERT INTO dictionary_sources(source_key, name, homepage_url, license_name, license_url, attribution_text, source_version, snapshot_date, source_hash, updated_at)
                VALUES (?, ?, ?, 'CC BY-SA 4.0 / GFDL', ?, ?, ?, ?, ?, now())
                ON CONFLICT (source_key) DO UPDATE SET source_version = EXCLUDED.source_version, snapshot_date = EXCLUDED.snapshot_date, source_hash = EXCLUDED.source_hash, updated_at = now()
                RETURNING id
                """, UUID.class, SOURCE_KEY, "Kaikki/Wiktionary English machine-readable dictionary", SOURCE_URL, LICENSE_URL,
                "Dados derivados do Wiktionary via Kaikki/Wiktextract.", properties.getSourceVersion(), LocalDate.now(ZoneOffset.UTC), hash);
    }

    private Optional<UUID> findCompletedBatch(UUID sourceId, String hash) {
        return jdbc.query("SELECT id FROM dictionary_import_batches WHERE dictionary_source_id = ? AND source_hash = ? AND status = 'COMPLETED'",
                (rs, rowNum) -> rs.getObject("id", UUID.class), sourceId, hash).stream().findFirst();
    }

    private UUID createBatch(UUID sourceId, Path file, String hash, long size) {
        return jdbc.queryForObject("INSERT INTO dictionary_import_batches(dictionary_source_id, source_file, source_hash, source_size_bytes, status) VALUES (?, ?, ?, ?, 'RUNNING') ON CONFLICT (dictionary_source_id, source_hash) DO UPDATE SET source_file = EXCLUDED.source_file, source_size_bytes = EXCLUDED.source_size_bytes, status = 'RUNNING', records_read = 0, records_accepted = 0, lexemes_imported = 0, forms_imported = 0, senses_imported = 0, translations_imported = 0, pronunciations_imported = 0, examples_imported = 0, relations_imported = 0, error_count = 0, started_at = now(), finished_at = NULL, error_message = NULL RETURNING id",
                UUID.class, sourceId, file.toString(), hash, size);
    }

    private void updateProgress(UUID batchId, Counters counters) {
        jdbc.update("UPDATE dictionary_import_batches SET records_read = ?, records_accepted = ?, lexemes_imported = ?, forms_imported = ?, senses_imported = ?, translations_imported = ?, pronunciations_imported = ?, examples_imported = ?, relations_imported = ?, error_count = ? WHERE id = ?",
                counters.recordsRead, counters.recordsAccepted, counters.lexemes, counters.forms, counters.senses, counters.translations, counters.pronunciations, counters.examples, counters.relations, counters.errors, batchId);
        LOGGER.info("dictionary_import_progress batchId={} recordsRead={} accepted={} lexemes={} senses={} errors={}", batchId, counters.recordsRead, counters.recordsAccepted, counters.lexemes, counters.senses, counters.errors);
    }

    private void finishBatch(UUID batchId, String status, Counters counters, String error) {
        jdbc.update("UPDATE dictionary_import_batches SET status = ?, records_read = ?, records_accepted = ?, lexemes_imported = ?, forms_imported = ?, senses_imported = ?, translations_imported = ?, pronunciations_imported = ?, examples_imported = ?, relations_imported = ?, error_count = ?, finished_at = now(), error_message = ? WHERE id = ?",
                status, counters.recordsRead, counters.recordsAccepted, counters.lexemes, counters.forms, counters.senses, counters.translations, counters.pronunciations, counters.examples, counters.relations, counters.errors, error, batchId);
    }

    private static boolean isEnglish(JsonNode root) {
        return "en".equalsIgnoreCase(root.path("lang_code").asText("")) || "English".equalsIgnoreCase(root.path("lang").asText(""));
    }

    private static String normalizePos(String value) {
        return switch (clean(value).toLowerCase(Locale.ROOT).replace('_', ' ')) {
            case "noun" -> "NOUN";
            case "verb" -> "VERB";
            case "adjective", "adj" -> "ADJECTIVE";
            case "adverb", "adv" -> "ADVERB";
            case "pronoun" -> "PRONOUN";
            case "preposition" -> "PREPOSITION";
            case "conjunction" -> "CONJUNCTION";
            case "interjection" -> "INTERJECTION";
            case "determiner" -> "DETERMINER";
            case "phrase" -> "PHRASE";
            case "proper name" -> "PROPER_NAME";
            default -> {
                String normalized = clean(value).toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
                yield normalized.isBlank() ? "UNKNOWN" : normalized.substring(0, Math.min(64, normalized.length()));
            }
        };
    }

    private static String normalizeLanguage(String value) {
        String language = clean(value).toLowerCase(Locale.ROOT);
        if (language.equals("pt-br") || language.equals("pt_br") || language.equals("por")) return "pt";
        return language.length() > 16 ? language.substring(0, 16) : language;
    }

    private static String normalizeSenseKey(JsonNode node, String word, String pos, int index) {
        String explicit = clean(firstNonBlank(
                node.path("senseid").isArray() && node.path("senseid").size() > 0 ? node.path("senseid").get(0).asText("") : "",
                node.path("id").asText("")));
        String value = explicit.isBlank() ? word + "|" + pos + "|" + index : explicit;
        return value.substring(0, Math.min(200, value.length()));
    }

    private static String findCefr(JsonNode node) {
        for (String tag : textValues(node.path("tags"))) if (tag.matches("[ABC][12]")) return tag;
        return "";
    }

    private static List<JsonNode> array(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<JsonNode> values = new ArrayList<>();
        node.forEach(values::add);
        return values;
    }

    private static List<String> textValues(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> values = new ArrayList<>();
        node.forEach(item -> values.add(clean(item.asText(""))));
        return values;
    }

    private static String joinText(JsonNode node) {
        return textValues(node).stream().filter(value -> !value.isBlank()).distinct().reduce((left, right) -> left + " / " + right).orElse("");
    }

    private static String normalize(String value) { return clean(value).toLowerCase(Locale.ROOT); }
    private static String clean(String value) {
        if (value == null) return "";
        return java.text.Normalizer.normalize(value.replace('’', '\''), java.text.Normalizer.Form.NFKC).trim().replaceAll("\\s+", " ");
    }
    private static String firstNonBlank(String first, String second) { return first != null && !first.isBlank() ? first : second == null ? "" : second; }

    private static String sha256(Path file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = Files.newInputStream(file)) {
            byte[] buffer = new byte[1024 * 1024];
            int count;
            while ((count = input.read(buffer)) >= 0) if (count > 0) digest.update(buffer, 0, count);
        }
        return java.util.HexFormat.of().formatHex(digest.digest());
    }

    private static String safeMessage(Throwable exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? exception.getClass().getSimpleName() : message.substring(0, Math.min(500, message.length()));
    }

    public record ImportResult(UUID batchId, String status, long recordsRead, long recordsAccepted, long lexemes, long forms, long senses, long translations, long pronunciations, long examples, long relations, long errors) {}
    private record EntryKey(String lemma, String partOfSpeech) {}
    private record FormKey(UUID lexemeId, String form) {}
    private record SenseKeyId(UUID dictionaryId, String senseKey) {}
    private record Translation(String language, String word, String qualifier) {}
    private record Example(String text, String translation) {}
    private record Pronunciation(String ipa, String audioUrl, String dialect) {}
    private record Relation(String type, String language, String lemma, String partOfSpeech) {}
    private record Sense(String key, String definition, String translationPtBr, String cefr, List<Translation> translations, List<Example> examples, List<Relation> relations) {}
    private record ParsedEntry(String lemma, String partOfSpeech, String definition, String translationPtBr, String ipa, String cefr, List<String> forms, List<Sense> senses, List<Pronunciation> pronunciations, List<Relation> relations) {
        private static ParsedEntry merge(ParsedEntry left, ParsedEntry right) {
            return new ParsedEntry(left.lemma(), left.partOfSpeech(), firstNonBlank(left.definition(), right.definition()), firstNonBlank(left.translationPtBr(), right.translationPtBr()), firstNonBlank(left.ipa(), right.ipa()), firstNonBlank(left.cefr(), right.cefr()), mergeList(left.forms(), right.forms()), mergeList(left.senses(), right.senses()), mergeList(left.pronunciations(), right.pronunciations()), mergeList(left.relations(), right.relations()));
        }
        private static <T> List<T> mergeList(List<T> left, List<T> right) { return java.util.stream.Stream.concat(left.stream(), right.stream()).distinct().toList(); }
    }
    private static final class Counters {
        private long recordsRead, recordsAccepted, lexemes, forms, senses, translations, pronunciations, examples, relations, errors;
        private ImportResult result(UUID batchId, String status) { return new ImportResult(batchId, status, recordsRead, recordsAccepted, lexemes, forms, senses, translations, pronunciations, examples, relations, errors); }
    }
}
