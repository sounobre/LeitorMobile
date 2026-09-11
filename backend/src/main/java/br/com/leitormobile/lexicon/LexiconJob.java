package br.com.leitormobile.lexicon;

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
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "lexicon_jobs")
public class LexiconJob {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "book_id", nullable = false)
    private Book book;
    @Column(nullable = false, length = 32) private String status;
    @Column(nullable = false, length = 32) private String phase;
    @Column(name = "last_message", columnDefinition = "text") private String lastMessage;
    @Column(nullable = false, precision = 5, scale = 4) private BigDecimal progress;
    @Column(name = "processed_units", nullable = false) private int processedUnits;
    @Column(name = "total_units", nullable = false) private int totalUnits;
    @Column(name = "processed_tokens", nullable = false) private int processedTokens;
    @Column(name = "total_lexemes", nullable = false) private int totalLexemes;
    @Column(name = "error_message", columnDefinition = "text") private String errorMessage;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "started_at") private Instant startedAt;
    @Column(name = "finished_at") private Instant finishedAt;

    protected LexiconJob() {}
    public LexiconJob(Book book) {
        this.book = book;
        this.status = "QUEUED";
        this.phase = "QUEUED";
        this.progress = BigDecimal.ZERO;
        this.createdAt = Instant.now();
    }
    public UUID getId() { return id; }
    public Book getBook() { return book; }
    public String getStatus() { return status; }
    public String getPhase() { return phase; }
    public String getLastMessage() { return lastMessage; }
    public BigDecimal getProgress() { return progress; }
    public int getProcessedUnits() { return processedUnits; }
    public int getTotalUnits() { return totalUnits; }
    public int getProcessedTokens() { return processedTokens; }
    public int getTotalLexemes() { return totalLexemes; }
    public String getErrorMessage() { return errorMessage; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getStartedAt() { return startedAt; }
    public Instant getFinishedAt() { return finishedAt; }
    public void start(int totalUnits) {
        this.status = "RUNNING";
        this.phase = "EXTRACTING";
        this.totalUnits = totalUnits;
        this.lastMessage = "EPUB extraído; iniciando análise lexical.";
        this.startedAt = Instant.now();
    }
    public void updateProgress(int units, int tokens, int lexemes) {
        this.processedUnits = units; this.processedTokens = tokens; this.totalLexemes = lexemes;
        this.progress = totalUnits == 0 ? BigDecimal.ONE : BigDecimal.valueOf(units).divide(BigDecimal.valueOf(totalUnits), 4, java.math.RoundingMode.HALF_UP);
        this.phase = "ANALYZING";
        this.lastMessage = "Unidade " + units + " de " + totalUnits + " analisada.";
    }
    public void startEnrichment(int candidates) {
        this.phase = "ENRICHING";
        this.lastMessage = candidates == 0 ? "Análise lexical concluída; nenhuma palavra precisa de enriquecimento." : "Enriquecendo " + candidates + " palavras com o modelo local.";
    }
    public void complete(int units, int tokens, int lexemes) {
        updateProgress(units, tokens, lexemes);
        this.status = "COMPLETED";
        this.phase = "COMPLETED";
        this.progress = BigDecimal.ONE;
        this.lastMessage = "Léxico preparado com sucesso.";
        this.finishedAt = Instant.now();
    }
    public void fail(String message) {
        this.status = "FAILED";
        this.phase = "FAILED";
        this.errorMessage = message;
        this.lastMessage = message;
        this.finishedAt = Instant.now();
    }
}
