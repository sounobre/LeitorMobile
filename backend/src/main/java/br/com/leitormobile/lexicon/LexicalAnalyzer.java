package br.com.leitormobile.lexicon;

import java.util.Locale;

import org.springframework.stereotype.Component;

@Component
public class LexicalAnalyzer {

    public AnalyzedToken analyze(EpubTextExtractor.ExtractedToken token) {
        String surface = token.surface();
        String normalized = surface.toLowerCase(Locale.ROOT).replace('’', '\'');
        String lemma = normalized;
        if (lemma.endsWith("'s") && lemma.length() > 3) lemma = lemma.substring(0, lemma.length() - 2);
        else if (lemma.endsWith("ies") && lemma.length() > 4) lemma = lemma.substring(0, lemma.length() - 3) + "y";
        else if (lemma.endsWith("ing") && lemma.length() > 5) lemma = lemma.substring(0, lemma.length() - 3);
        else if (lemma.endsWith("ed") && lemma.length() > 4) lemma = lemma.substring(0, lemma.length() - 2);
        else if (lemma.endsWith("es") && lemma.length() > 4) lemma = lemma.substring(0, lemma.length() - 2);
        else if (lemma.endsWith("s") && lemma.length() > 3) lemma = lemma.substring(0, lemma.length() - 1);

        String pos = guessPartOfSpeech(normalized);
        return new AnalyzedToken(surface, lemma, pos, token.startOffset(), token.endOffset());
    }

    private static String guessPartOfSpeech(String word) {
        if (word.endsWith("ly")) return "ADVERB";
        if (word.endsWith("ing") || word.endsWith("ed")) return "VERB";
        if (word.endsWith("ous") || word.endsWith("ive") || word.endsWith("ful") || word.endsWith("less")) return "ADJECTIVE";
        return "UNKNOWN";
    }

    public record AnalyzedToken(String surface, String lemma, String partOfSpeech, int startOffset, int endOffset) {}
}
