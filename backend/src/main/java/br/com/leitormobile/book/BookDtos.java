package br.com.leitormobile.book;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class BookDtos {
    private BookDtos() {}

    public record CreateBookRequest(
            @NotBlank String originalName,
            String fileHash,
            String title,
            String author,
            String language,
            String coverUri,
            String description,
            String publisher
    ) {}

    public record ProgressRequest(
            String lastCfi,
            @DecimalMin("0.0") @DecimalMax("1.0") BigDecimal progress
    ) {}

    public record Response(
            UUID id,
            String fileHash,
            String originalName,
            String title,
            String author,
            String language,
            String coverUri,
            String description,
            String publisher,
            Instant importedAt,
            Instant lastOpenedAt,
            String lastCfi,
            BigDecimal progress,
            boolean fileAvailable,
            boolean coverAvailable
    ) {
        static Response from(Book book) {
            return new Response(
                    book.getId(), book.getFileHash(), book.getOriginalName(), book.getTitle(),
                    book.getAuthor(), book.getLanguage(), book.getCoverUri(), book.getDescription(),
                    book.getPublisher(), book.getImportedAt(), book.getLastOpenedAt(),
                    book.getLastCfi(), book.getProgress(),
                    book.getFileUri() != null, book.getCoverUri() != null
            );
        }
    }
}
