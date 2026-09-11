package br.com.leitormobile.lexicon;

import jakarta.persistence.*;
import java.util.UUID;

@Entity @Table(name = "lexical_senses", uniqueConstraints = @UniqueConstraint(columnNames = {"dictionary_entry_id", "sense_key"}))
public class LexicalSense {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "dictionary_entry_id", nullable = false) private DictionaryEntry dictionaryEntry;
    @Column(name = "sense_key", nullable = false, length = 200) private String senseKey;
    @Column(nullable = false, columnDefinition = "text") private String definition;
    @Column(name = "translation_pt_br", nullable = false, columnDefinition = "text") private String translationPtBr;
    @Column(nullable = false, length = 16) private String cefr;
    @Column(nullable = false, length = 64) private String source;
    protected LexicalSense() {}
    public LexicalSense(DictionaryEntry entry, String senseKey, String definition, String translation, String cefr, String source) { this.dictionaryEntry = entry; this.senseKey = senseKey; this.definition = definition; this.translationPtBr = translation; this.cefr = cefr; this.source = source; }
    public UUID getId() { return id; }
    public String getSenseKey() { return senseKey; }
    public String getDefinition() { return definition; }
    public String getTranslationPtBr() { return translationPtBr; }
}
