package br.com.leitormobile.card;

import br.com.leitormobile.book.Book;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "cards")
public class Card {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "book_id", nullable = false)
    private Book book;

    @Column(name = "cfi_range", nullable = false, columnDefinition = "text")
    private String cfiRange;

    @Column(name = "selected_text", nullable = false, columnDefinition = "text")
    private String selectedText;

    @Column(nullable = false, columnDefinition = "text")
    private String translation;

    @Column(nullable = false, length = 500)
    private String pronunciation;

    @Column(name = "part_of_speech", nullable = false, length = 200)
    private String partOfSpeech;

    @Column(nullable = false, columnDefinition = "text")
    private String definition;

    @Column(nullable = false, columnDefinition = "text")
    private String background;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "examples_json", nullable = false, columnDefinition = "jsonb")
    private List<String> examples = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "related_words_json", nullable = false, columnDefinition = "jsonb")
    private List<String> relatedWords = new ArrayList<>();

    @Column(name = "chapter_title", nullable = false, length = 500)
    private String chapterTitle;

    @Column(name = "queue_order", nullable = false)
    private Integer queueOrder;

    @Column(nullable = false)
    private boolean archived;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Card() {
    }

    public Card(Book book, String cfiRange, String selectedText, String chapterTitle, int queueOrder) {
        this.book = book;
        this.cfiRange = cfiRange;
        this.selectedText = selectedText;
        this.chapterTitle = chapterTitle;
        this.queueOrder = queueOrder;
        this.translation = "";
        this.pronunciation = "";
        this.partOfSpeech = "";
        this.definition = "";
        this.background = "";
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public UUID getId() { return id; }
    public Book getBook() { return book; }
    public String getCfiRange() { return cfiRange; }
    public String getSelectedText() { return selectedText; }
    public String getTranslation() { return translation; }
    public String getPronunciation() { return pronunciation; }
    public String getPartOfSpeech() { return partOfSpeech; }
    public String getDefinition() { return definition; }
    public String getBackground() { return background; }
    public List<String> getExamples() { return examples; }
    public List<String> getRelatedWords() { return relatedWords; }
    public String getChapterTitle() { return chapterTitle; }
    public Integer getQueueOrder() { return queueOrder; }
    public boolean isArchived() { return archived; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void update(CardDtos.UpdateRequest request) {
        this.selectedText = request.selectedText();
        this.translation = safe(request.translation());
        this.pronunciation = safe(request.pronunciation());
        this.partOfSpeech = safe(request.partOfSpeech());
        this.definition = safe(request.definition());
        this.background = safe(request.background());
        this.examples = request.examples() == null ? new ArrayList<>() : new ArrayList<>(request.examples());
        this.relatedWords = request.relatedWords() == null ? new ArrayList<>() : new ArrayList<>(request.relatedWords());
        this.updatedAt = Instant.now();
    }

    public void archive() {
        this.archived = true;
        this.updatedAt = Instant.now();
    }

    public void unarchive() {
        this.archived = false;
        this.updatedAt = Instant.now();
    }

    public void moveToEnd(int newOrder) {
        this.queueOrder = newOrder;
        this.updatedAt = Instant.now();
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
