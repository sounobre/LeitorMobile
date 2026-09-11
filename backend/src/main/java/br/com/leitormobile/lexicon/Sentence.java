package br.com.leitormobile.lexicon;

import jakarta.persistence.*;
import java.util.UUID;

@Entity @Table(name = "sentences", uniqueConstraints = @UniqueConstraint(columnNames = {"reading_unit_id", "sequence_index"}))
public class Sentence {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "reading_unit_id", nullable = false) private ReadingUnit readingUnit;
    @Column(name = "sequence_index", nullable = false) private int sequenceIndex;
    @Column(name = "text_hash", nullable = false, length = 128) private String textHash;
    @Column(name = "character_count", nullable = false) private int characterCount;
    @Column(name = "start_offset", nullable = false) private int startOffset;
    @Column(name = "end_offset", nullable = false) private int endOffset;
    protected Sentence() {}
    public Sentence(ReadingUnit unit, int sequenceIndex, String textHash, int characterCount, int startOffset, int endOffset) {
        this.readingUnit = unit; this.sequenceIndex = sequenceIndex; this.textHash = textHash; this.characterCount = characterCount; this.startOffset = startOffset; this.endOffset = endOffset;
    }
    public UUID getId() { return id; }
    public ReadingUnit getReadingUnit() { return readingUnit; }
}
