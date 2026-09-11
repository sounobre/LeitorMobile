package br.com.leitormobile.lexicon;

import java.util.Collection;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

@Component
public class LocalLexicalDictionary {
    private final Map<String, LocalEntry> entries = Map.ofEntries(
            Map.entry("dragon", new LocalEntry("a mythical creature often shown as a large winged reptile", "dragão", "/ˈdræɡən/", "A2")),
            Map.entry("wield", new LocalEntry("to hold and use a weapon or tool", "empunhar; manejar", "/wiːld/", "B2")),
            Map.entry("charge", new LocalEntry("to ask a price or move forward suddenly", "cobrar; atacar", "/tʃɑːrdʒ/", "B1")),
            Map.entry("book", new LocalEntry("a written or printed work", "livro", "/bʊk/", "A1")),
            Map.entry("read", new LocalEntry("to look at and understand written words", "ler", "/riːd/", "A1"))
    );

    public Optional<LocalEntry> find(String lemma) {
        if (lemma == null || lemma.isBlank()) return Optional.empty();
        return Optional.ofNullable(entries.get(lemma.trim().toLowerCase(Locale.ROOT)));
    }

    public Map<String, LocalEntry> findAll(Collection<String> terms) {
        Map<String, LocalEntry> result = new HashMap<>();
        for (String term : terms) {
            if (term == null || term.isBlank()) continue;
            String normalized = term.trim().toLowerCase(Locale.ROOT);
            LocalEntry entry = entries.get(normalized);
            if (entry != null) result.put(normalized, entry);
        }
        return result;
    }

    public record LocalEntry(String definition, String translationPtBr, String ipa, String cefr) {}
}
