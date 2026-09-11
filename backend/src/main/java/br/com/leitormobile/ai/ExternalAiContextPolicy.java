package br.com.leitormobile.ai;

import java.util.List;

import org.springframework.stereotype.Component;

@Component
public class ExternalAiContextPolicy {

    private static final int MAX_EXCERPT_CHARACTERS = 600;
    private static final int MAX_EXCERPTS = 1;

    public ExternalContextDecision decideMetadataOnly(AiTaskType task, int candidateCount) {
        if (candidateCount < 1) {
            return ExternalContextDecision.blocked("Não há candidatos lexicais para enriquecer.");
        }
        return ExternalContextDecision.metadataOnly(
                "Tarefa " + task + " resolvida com metadados lexicais; nenhum texto da obra é necessário."
        );
    }

    public ExternalContextDecision decideWithContext(AiTaskType task, List<String> excerpts) {
        if (excerpts == null || excerpts.size() != MAX_EXCERPTS) {
            return ExternalContextDecision.blocked(
                    "A política exige exatamente uma ocorrência curta para a tarefa " + task + "."
            );
        }
        String excerpt = excerpts.get(0) == null ? "" : excerpts.get(0).trim();
        if (excerpt.isBlank() || excerpt.length() > MAX_EXCERPT_CHARACTERS) {
            return ExternalContextDecision.blocked(
                    "A ocorrência excede o limite técnico conservador de contexto mínimo."
            );
        }
        return new ExternalContextDecision(
                true,
                true,
                "Uma única ocorrência curta foi necessária para a tarefa " + task + ".",
                List.of(excerpt),
                excerpt.length()
        );
    }
}
