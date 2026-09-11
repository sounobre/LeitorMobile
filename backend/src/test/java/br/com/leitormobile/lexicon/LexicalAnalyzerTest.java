package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class LexicalAnalyzerTest {
    private final LexicalAnalyzer analyzer = new LexicalAnalyzer();

    @Test
    void normalizesCommonInflectionsWithoutSendingTextAnywhere() {
        var result = analyzer.analyze(new EpubTextExtractor.ExtractedToken("wielded", 2, 9));
        assertEquals("wield", result.lemma());
        assertEquals("VERB", result.partOfSpeech());
        assertEquals(2, result.startOffset());
        assertEquals(9, result.endOffset());
    }
}
