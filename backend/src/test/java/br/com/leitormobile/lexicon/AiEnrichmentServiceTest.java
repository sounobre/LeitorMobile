package br.com.leitormobile.lexicon;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import br.com.leitormobile.ai.AiProperties;
import br.com.leitormobile.ai.AiProvider;
import br.com.leitormobile.ai.CopyrightPrivacyGate;
import br.com.leitormobile.ai.ExternalAiContextPolicy;
import br.com.leitormobile.book.Book;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AiEnrichmentServiceTest {
    @Test
    void doesNotCallProviderWhenThereAreNoUnresolvedCandidates() {
        AiProperties properties = enabledOllamaProperties();
        OllamaAiProvider provider = mock(OllamaAiProvider.class);
        LexiconJobProgressWriter progressWriter = mock(LexiconJobProgressWriter.class);
        CopyrightPrivacyGate gate = mock(CopyrightPrivacyGate.class);
        AiRequestAuditRepository audits = mock(AiRequestAuditRepository.class);
        DictionaryEntryRepository dictionaries = mock(DictionaryEntryRepository.class);
        LexicalSenseRepository senses = mock(LexicalSenseRepository.class);
        AiEnrichmentService service = service(properties, provider, gate, audits, dictionaries, senses, progressWriter);

        service.enrich(mock(LexiconJob.class), List.of());

        verifyNoInteractions(provider, progressWriter, gate, audits, dictionaries, senses);
    }

    @Test
    void callsProviderForMetadataCandidatesWithoutBookText() {
        AiProperties properties = enabledOllamaProperties();
        OllamaAiProvider provider = mock(OllamaAiProvider.class);
        when(provider.enrichMetadata(any())).thenReturn(new AiProvider.ProviderResponse(List.of(), 3, 5));
        LexiconJobProgressWriter progressWriter = mock(LexiconJobProgressWriter.class);
        CopyrightPrivacyGate gate = mock(CopyrightPrivacyGate.class);
        AiRequestAuditRepository audits = mock(AiRequestAuditRepository.class);
        DictionaryEntryRepository dictionaries = mock(DictionaryEntryRepository.class);
        LexicalSenseRepository senses = mock(LexicalSenseRepository.class);
        AiEnrichmentService service = service(properties, provider, gate, audits, dictionaries, senses, progressWriter);

        UUID jobId = UUID.randomUUID();
        UUID bookId = UUID.randomUUID();
        UUID lexemeId = UUID.randomUUID();
        LexiconJob job = mock(LexiconJob.class);
        Book book = mock(Book.class);
        Lexeme lexeme = mock(Lexeme.class);
        BookLexeme bookLexeme = mock(BookLexeme.class);
        when(job.getId()).thenReturn(jobId);
        when(job.getBook()).thenReturn(book);
        when(book.getId()).thenReturn(bookId);
        when(bookLexeme.getLexeme()).thenReturn(lexeme);
        when(bookLexeme.getFrequency()).thenReturn(3);
        when(lexeme.getId()).thenReturn(lexemeId);
        when(lexeme.getLemma()).thenReturn("wander");
        when(lexeme.getPartOfSpeech()).thenReturn("VERB");

        service.enrich(job, List.of(bookLexeme));

        verify(progressWriter).enriching(jobId, 1);
        verify(gate).check(any(), any());
        verify(provider).enrichMetadata(List.of(
                new AiProvider.MetadataCandidate(lexemeId, "wander", "VERB", 3)
        ));
    }

    private static AiProperties enabledOllamaProperties() {
        AiProperties properties = new AiProperties();
        properties.setEnabled(true);
        properties.setProvider("ollama");
        properties.getOllama().setBaseUrl("http://127.0.0.1:1");
        properties.getOllama().setModel("fake-model");
        return properties;
    }

    private static AiEnrichmentService service(
            AiProperties properties,
            OllamaAiProvider provider,
            CopyrightPrivacyGate gate,
            AiRequestAuditRepository audits,
            DictionaryEntryRepository dictionaries,
            LexicalSenseRepository senses,
            LexiconJobProgressWriter progressWriter
    ) {
        return new AiEnrichmentService(
                properties,
                provider,
                new ExternalAiContextPolicy(),
                gate,
                audits,
                dictionaries,
                senses,
                progressWriter
        );
    }
}
