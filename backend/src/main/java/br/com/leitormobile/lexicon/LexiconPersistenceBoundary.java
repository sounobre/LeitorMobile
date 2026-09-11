package br.com.leitormobile.lexicon;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Component;

/** Keeps the JPA persistence context bounded while a book is processed. */
@Component
final class LexiconPersistenceBoundary {
    private final EntityManager entityManager;

    LexiconPersistenceBoundary(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }
}
