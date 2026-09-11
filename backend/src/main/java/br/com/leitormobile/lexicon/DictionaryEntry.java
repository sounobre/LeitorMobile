package br.com.leitormobile.lexicon;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "dictionary_entries")
public class DictionaryEntry {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "lexeme_id", nullable = false, unique = true) private Lexeme lexeme;
    @Column(nullable = false, columnDefinition = "text") private String definition;
    @Column(name = "translation_pt_br", nullable = false, columnDefinition = "text") private String translationPtBr;
    @Column(nullable = false, length = 500) private String ipa;
    @Column(nullable = false, length = 16) private String cefr;
    @Column(nullable = false, length = 64) private String source;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    protected DictionaryEntry() {}
    public DictionaryEntry(Lexeme lexeme) { this.lexeme = lexeme; this.definition = ""; this.translationPtBr = ""; this.ipa = ""; this.cefr = ""; this.source = "LOCAL"; this.updatedAt = Instant.now(); }
    public UUID getId() { return id; }
    public Lexeme getLexeme() { return lexeme; }
    public String getDefinition() { return definition; }
    public String getTranslationPtBr() { return translationPtBr; }
    public String getIpa() { return ipa; }
    public String getCefr() { return cefr; }
    public String getSource() { return source; }
    public void enrich(String definition, String translation, String ipa, String cefr, String source) { this.definition = safe(definition); this.translationPtBr = safe(translation); this.ipa = safe(ipa); this.cefr = safe(cefr); this.source = safe(source); this.updatedAt = Instant.now(); }
    private static String safe(String value) { return value == null ? "" : value.trim(); }
}
