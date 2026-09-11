package br.com.leitormobile.lexicon;

import jakarta.persistence.*;
import java.util.UUID;

@Entity @Table(name = "book_senses", uniqueConstraints = @UniqueConstraint(columnNames = {"book_lexeme_id", "lexical_sense_id"}))
public class BookSense {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "book_lexeme_id", nullable = false) private BookLexeme bookLexeme;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "lexical_sense_id", nullable = false) private LexicalSense lexicalSense;
    @Column(name = "occurrence_count", nullable = false) private int occurrenceCount;
    @Column(precision = 5, scale = 4) private java.math.BigDecimal confidence;
    @Column(name = "resolution_status", nullable = false, length = 32) private String resolutionStatus;
    protected BookSense() {}
}
