package br.com.leitormobile.lexicon;

import br.com.leitormobile.book.Book;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "book_lexemes", uniqueConstraints = @UniqueConstraint(columnNames = {"book_id", "lexeme_id"}))
public class BookLexeme {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "book_id", nullable = false) private Book book;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "lexeme_id", nullable = false) private Lexeme lexeme;
    @Column(nullable = false) private int frequency;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "first_sentence_id") private Sentence firstSentence;
    @Column(name = "resolution_status", nullable = false, length = 32) private String resolutionStatus;
    @Column(name = "pedagogical_relevance", nullable = false, length = 32) private String pedagogicalRelevance;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    protected BookLexeme() {}
    public BookLexeme(Book book, Lexeme lexeme, Sentence firstSentence) { this.book = book; this.lexeme = lexeme; this.firstSentence = firstSentence; this.frequency = 0; this.resolutionStatus = "UNRESOLVED"; this.pedagogicalRelevance = "OPTIONAL"; this.updatedAt = Instant.now(); }
    public UUID getId() { return id; }
    public Book getBook() { return book; }
    public Lexeme getLexeme() { return lexeme; }
    public int getFrequency() { return frequency; }
    public Sentence getFirstSentence() { return firstSentence; }
    public String getResolutionStatus() { return resolutionStatus; }
    public String getPedagogicalRelevance() { return pedagogicalRelevance; }
    public void increment(Sentence first) { frequency++; if (firstSentence == null) firstSentence = first; updatedAt = Instant.now(); }
    public void resolve(String status, String relevance) { resolutionStatus = status; pedagogicalRelevance = relevance; updatedAt = Instant.now(); }
}
