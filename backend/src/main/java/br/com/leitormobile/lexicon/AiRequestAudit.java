package br.com.leitormobile.lexicon;

import br.com.leitormobile.book.Book;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name = "ai_request_audit")
public class AiRequestAudit {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "book_id") private Book book;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "job_id") private LexiconJob job;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "lexeme_id") private Lexeme lexeme;
    @Column(nullable = false, length = 64) private String provider;
    @Column(nullable = false, length = 200) private String model;
    @Column(name = "task_type", nullable = false, length = 64) private String taskType;
    @Column(name = "used_copyrighted_excerpt", nullable = false) private boolean usedCopyrightedExcerpt;
    @Column(name = "excerpt_character_count", nullable = false) private int excerptCharacterCount;
    @Column(name = "excerpt_count", nullable = false) private int excerptCount;
    @Column(nullable = false, length = 1000) private String reason;
    @Column(name = "input_token_count") private Integer inputTokenCount;
    @Column(name = "output_token_count") private Integer outputTokenCount;
    @Column(name = "result_status", nullable = false, length = 32) private String resultStatus;
    @Column(name = "request_hash", length = 128) private String requestHash;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected AiRequestAudit() {}
    public AiRequestAudit(Book book, LexiconJob job, String provider, String model, String taskType, boolean usedExcerpt, int excerptCharacters, int excerptCount, String reason, Integer inputTokens, Integer outputTokens, String status, String requestHash) {
        this.book = book; this.job = job; this.provider = provider; this.model = model; this.taskType = taskType; this.usedCopyrightedExcerpt = usedExcerpt; this.excerptCharacterCount = excerptCharacters; this.excerptCount = excerptCount; this.reason = reason; this.inputTokenCount = inputTokens; this.outputTokenCount = outputTokens; this.resultStatus = status; this.requestHash = requestHash; this.createdAt = Instant.now();
    }
}
