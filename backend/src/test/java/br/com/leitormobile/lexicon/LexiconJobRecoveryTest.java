package br.com.leitormobile.lexicon;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;

class LexiconJobRecoveryTest {
    @Test
    void marksJobsInterruptedByBackendRestartAsFailed() {
        LexiconJobRepository jobs = mock(LexiconJobRepository.class);
        when(jobs.markInterruptedJobs(LexiconJobRecovery.INTERRUPTED_MESSAGE)).thenReturn(1);
        LexiconJobRecovery recovery = new LexiconJobRecovery(jobs);

        assertEquals(1, recovery.recoverInterruptedJobs());
        verify(jobs).markInterruptedJobs(LexiconJobRecovery.INTERRUPTED_MESSAGE);
    }
}
