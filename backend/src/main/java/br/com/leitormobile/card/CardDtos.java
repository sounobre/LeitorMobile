package br.com.leitormobile.card;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class CardDtos {
    private CardDtos() {}

    public record CreateRequest(
            @NotNull UUID bookId,
            @NotBlank String cfiRange,
            @NotBlank String selectedText,
            String chapterTitle,
            String translation,
            String pronunciation,
            String partOfSpeech,
            String definition,
            String background,
            List<String> examples,
            List<String> relatedWords
    ) {}

    public record UpdateRequest(
            @NotBlank String selectedText,
            String translation,
            String pronunciation,
            String partOfSpeech,
            String definition,
            String background,
            List<String> examples,
            List<String> relatedWords
    ) {}

    public record Response(
            UUID id,
            UUID bookId,
            String bookTitle,
            String cfiRange,
            String selectedText,
            String translation,
            String pronunciation,
            String partOfSpeech,
            String definition,
            String background,
            List<String> examples,
            List<String> relatedWords,
            String chapterTitle,
            int queueOrder,
            boolean archived,
            Instant createdAt,
            Instant updatedAt
    ) {
        static Response from(Card card) {
            return new Response(
                    card.getId(), card.getBook().getId(), card.getBook().getTitle(), card.getCfiRange(),
                    card.getSelectedText(), card.getTranslation(), card.getPronunciation(),
                    card.getPartOfSpeech(), card.getDefinition(), card.getBackground(),
                    List.copyOf(card.getExamples()), List.copyOf(card.getRelatedWords()),
                    card.getChapterTitle(), card.getQueueOrder(), card.isArchived(),
                    card.getCreatedAt(), card.getUpdatedAt()
            );
        }
    }
}
