package br.com.leitormobile.lexicon;

import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Persists visible job checkpoints while the extraction transaction is still running. */
@Service
public class LexiconJobProgressWriter {
    private final LexiconJobRepository jobs;

    public LexiconJobProgressWriter(LexiconJobRepository jobs) {
        this.jobs = jobs;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void started(UUID jobId, int totalUnits) {
        update(jobId, job -> job.start(totalUnits));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void progress(UUID jobId, int processedUnits, int processedTokens, int totalLexemes) {
        update(jobId, job -> job.updateProgress(processedUnits, processedTokens, totalLexemes));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void enriching(UUID jobId, int candidates) {
        update(jobId, job -> job.startEnrichment(candidates));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void completed(UUID jobId, int processedUnits, int processedTokens, int totalLexemes) {
        update(jobId, job -> job.complete(processedUnits, processedTokens, totalLexemes));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void failed(UUID jobId, String message) {
        update(jobId, job -> job.fail(message));
    }

    private void update(UUID jobId, java.util.function.Consumer<LexiconJob> change) {
        LexiconJob job = jobs.findById(jobId).orElseThrow(() -> new IllegalStateException("Lexicon job not found: " + jobId));
        change.accept(job);
        jobs.save(job);
    }
}
