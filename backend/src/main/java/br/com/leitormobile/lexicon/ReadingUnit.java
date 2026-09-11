package br.com.leitormobile.lexicon;

import br.com.leitormobile.book.Book;
import jakarta.persistence.*;
import java.util.UUID;

@Entity @Table(name = "reading_units", uniqueConstraints = @UniqueConstraint(columnNames = {"book_id", "unit_index"}))
public class ReadingUnit {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "book_id", nullable = false) private Book book;
    @Column(name = "unit_index", nullable = false) private int unitIndex;
    @Column(nullable = false, length = 1000) private String href;
    @Column(nullable = false, length = 500) private String title;
    @Column(name = "text_hash", nullable = false, length = 128) private String textHash;
    @Column(name = "character_count", nullable = false) private int characterCount;
    @Column(name = "sentence_count", nullable = false) private int sentenceCount;
    protected ReadingUnit() {}
    public ReadingUnit(Book book, int unitIndex, String href, String title, String textHash, int characterCount, int sentenceCount) {
        this.book = book; this.unitIndex = unitIndex; this.href = href; this.title = title; this.textHash = textHash; this.characterCount = characterCount; this.sentenceCount = sentenceCount;
    }
    public UUID getId() { return id; }
    public Book getBook() { return book; }
    public int getUnitIndex() { return unitIndex; }
    public String getHref() { return href; }
    public String getTitle() { return title; }
    public int getCharacterCount() { return characterCount; }
    public int getSentenceCount() { return sentenceCount; }
}
