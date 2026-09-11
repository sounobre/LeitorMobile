package br.com.leitormobile.lexicon;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class LexiconJobRecovery {
    static final String INTERRUPTED_MESSAGE = "Processamento interrompido porque o backend foi reiniciado.";

    private static final Logger LOGGER = LoggerFactory.getLogger(LexiconJobRecovery.class);
    private final LexiconJobRepository jobs;

    public LexiconJobRecovery(LexiconJobRepository jobs) {
        this.jobs = jobs;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public int recoverInterruptedJobs() {
        int recovered = jobs.markInterruptedJobs(INTERRUPTED_MESSAGE);
        if (recovered > 0) {
            LOGGER.warn("lexicon_jobs_recovered count={} message={}", recovered, INTERRUPTED_MESSAGE);
        }
        return recovered;
    }
}
