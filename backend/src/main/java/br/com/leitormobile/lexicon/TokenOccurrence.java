package br.com.leitormobile.lexicon;

import br.com.leitormobile.book.Book;
import jakarta.persistence.*;
import java.util.UUID;

@Entity @Table(name = "token_occurrences")
public class TokenOccurrence {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "book_id", nullable = false) private Book book;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "sentence_id", nullable = false) private Sentence sentence;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "lexeme_id", nullable = false) private Lexeme lexeme;
    @Column(nullable = false, length = 500) private String surface;
    @Column(name = "start_offset", nullable = false) private int startOffset;
    @Column(name = "end_offset", nullable = false) private int endOffset;
    protected TokenOccurrence() {}
    public TokenOccurrence(Book book, Sentence sentence, Lexeme lexeme, String surface, int startOffset, int endOffset) { this.book = book; this.sentence = sentence; this.lexeme = lexeme; this.surface = surface; this.startOffset = startOffset; this.endOffset = endOffset; }
}
