package br.com.leitormobile.book;

import br.com.leitormobile.auth.AppUser;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "books")
public class Book {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private AppUser owner;

    @Column(name = "file_uri", length = 1000)
    private String fileUri;

    @Column(name = "file_hash", nullable = false, length = 128)
    private String fileHash;

    @Column(name = "original_name", nullable = false, length = 500)
    private String originalName;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(nullable = false, length = 500)
    private String author;

    @Column(nullable = false, length = 32)
    private String language;

    @Column(name = "cover_uri", length = 1000)
    private String coverUri;

    @Column(nullable = false, columnDefinition = "text")
    private String description;

    @Column(nullable = false, length = 500)
    private String publisher;

    @Column(name = "imported_at", nullable = false)
    private Instant importedAt;

    @Column(name = "last_opened_at")
    private Instant lastOpenedAt;

    @Column(name = "last_cfi", columnDefinition = "text")
    private String lastCfi;

    @Column(nullable = false, precision = 5, scale = 4)
    private BigDecimal progress;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "locations_json", columnDefinition = "jsonb")
    private String locationsJson;

    protected Book() {
    }

    public Book(AppUser owner, String fileHash, String originalName, String title, String author, String language) {
        this.owner = owner;
        this.fileHash = fileHash;
        this.originalName = originalName;
        this.title = title;
        this.author = author;
        this.language = language;
        this.description = "";
        this.publisher = "";
        this.progress = BigDecimal.ZERO;
        this.importedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public AppUser getOwner() { return owner; }
    public void setOwner(AppUser owner) { this.owner = owner; }
    public String getFileUri() { return fileUri; }
    public void setFileUri(String fileUri) { this.fileUri = fileUri; }
    public String getFileHash() { return fileHash; }
    public String getOriginalName() { return originalName; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getAuthor() { return author; }
    public String getLanguage() { return language; }
    public String getCoverUri() { return coverUri; }
    public void setCoverUri(String coverUri) { this.coverUri = coverUri; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getPublisher() { return publisher; }
    public void setPublisher(String publisher) { this.publisher = publisher; }
    public Instant getImportedAt() { return importedAt; }
    public Instant getLastOpenedAt() { return lastOpenedAt; }
    public String getLastCfi() { return lastCfi; }
    public BigDecimal getProgress() { return progress; }
    public String getLocationsJson() { return locationsJson; }

    public void updateProgress(String lastCfi, BigDecimal progress) {
        this.lastCfi = lastCfi;
        this.progress = progress.max(BigDecimal.ZERO).min(BigDecimal.ONE);
        this.lastOpenedAt = Instant.now();
    }
}
