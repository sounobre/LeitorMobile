package br.com.leitormobile.lexicon;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "lexemes", uniqueConstraints = @UniqueConstraint(columnNames = {"language", "lemma", "part_of_speech"}))
public class Lexeme {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(nullable = false, length = 32) private String language;
    @Column(nullable = false, length = 500) private String lemma;
    @Column(name = "part_of_speech", nullable = false, length = 64) private String partOfSpeech;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected Lexeme() {}
    public Lexeme(String language, String lemma, String partOfSpeech) { this.language = language; this.lemma = lemma; this.partOfSpeech = partOfSpeech; this.createdAt = Instant.now(); }
    public UUID getId() { return id; }
    public String getLanguage() { return language; }
    public String getLemma() { return lemma; }
    public String getPartOfSpeech() { return partOfSpeech; }
}
