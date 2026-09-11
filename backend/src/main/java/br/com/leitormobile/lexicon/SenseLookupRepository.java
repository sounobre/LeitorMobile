package br.com.leitormobile.lexicon;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface SenseLookupRepository extends JpaRepository<LexicalSense, UUID> {
    List<LexicalSense> findByDictionaryEntryIdOrderBySenseKeyAsc(UUID dictionaryEntryId);
}
