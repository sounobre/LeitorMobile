package br.com.leitormobile.lexicon;

import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

class LexiconPersistenceBoundaryTest {

    @Test
    void flushesBeforeClearingThePersistenceContextAtBatchBoundary() {
        EntityManager entityManager = mock(EntityManager.class);
        LexiconPersistenceBoundary boundary = new LexiconPersistenceBoundary(entityManager);

        boundary.flushAndClear();

        InOrder order = inOrder(entityManager);
        order.verify(entityManager).flush();
        order.verify(entityManager).clear();
    }
}
