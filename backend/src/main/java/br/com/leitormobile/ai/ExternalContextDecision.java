package br.com.leitormobile.ai;

import java.util.List;

public record ExternalContextDecision(
        boolean allowed,
        boolean copyrightedTextRequired,
        String justification,
        List<String> excerpts,
        int totalCharacters
) {
    public static ExternalContextDecision metadataOnly(String justification) {
        return new ExternalContextDecision(true, false, justification, List.of(), 0);
    }

    public static ExternalContextDecision blocked(String justification) {
        return new ExternalContextDecision(false, false, justification, List.of(), 0);
    }
}
