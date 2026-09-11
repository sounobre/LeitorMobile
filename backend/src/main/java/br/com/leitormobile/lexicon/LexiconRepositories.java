package br.com.leitormobile.lexicon;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface LexiconJobRepository extends JpaRepository<LexiconJob, UUID> {
    Optional<LexiconJob> findTopByBookIdOrderByCreatedAtDesc(UUID bookId);
    Optional<LexiconJob> findTopByBookIdAndStatusInOrderByCreatedAtDesc(UUID bookId, List<String> statuses);

    @Modifying
    @Query("update LexiconJob job set job.status = 'FAILED', job.phase = 'FAILED', job.errorMessage = :message, job.lastMessage = :message, job.finishedAt = CURRENT_TIMESTAMP where job.status in ('QUEUED', 'RUNNING')")
    int markInterruptedJobs(@Param("message") String message);
}

interface ReadingUnitRepository extends JpaRepository<ReadingUnit, UUID> {
    @Modifying @Query("delete from ReadingUnit u where u.book.id = :bookId")
    void deleteByBookId(@Param("bookId") UUID bookId);
}

interface SentenceRepository extends JpaRepository<Sentence, UUID> {
}

interface LexemeRepository extends JpaRepository<Lexeme, UUID> {
    Optional<Lexeme> findByLanguageAndLemmaAndPartOfSpeech(String language, String lemma, String partOfSpeech);

    @Query(value = """
            select candidates.id, candidates.language, candidates.lemma, candidates.part_of_speech, candidates.created_at
            from (
                select l.id, l.language, l.lemma, l.part_of_speech, l.created_at, 0 as lemma_rank
                from lexemes l
                where l.language = :language and lower(l.lemma) = lower(:lemma)
                union all
                select distinct l.id, l.language, l.lemma, l.part_of_speech, l.created_at, 1 as lemma_rank
                from lexemes l
                join word_forms wf on wf.lexeme_id = l.id
                where l.language = :language
                  and lower(wf.form) = lower(:surface)
                  and lower(l.lemma) <> lower(:lemma)
            ) candidates
            order by case when candidates.part_of_speech = :partOfSpeech then 0 else 1 end,
                     candidates.lemma_rank,
                     candidates.part_of_speech asc
            limit 1
            """, nativeQuery = true)
    List<Lexeme> findBestMatch(@Param("language") String language, @Param("lemma") String lemma, @Param("surface") String surface, @Param("partOfSpeech") String partOfSpeech);
}

interface WordFormRepository extends JpaRepository<WordForm, UUID> {
    boolean existsByLexemeIdAndForm(UUID lexemeId, String form);
}

interface DictionaryEntryRepository extends JpaRepository<DictionaryEntry, UUID> {
    Optional<DictionaryEntry> findByLexemeId(UUID lexemeId);
}

interface LexicalSenseRepository extends JpaRepository<LexicalSense, UUID> {
    Optional<LexicalSense> findByDictionaryEntryIdAndSenseKey(UUID entryId, String senseKey);
}

interface BookLexemeRepository extends JpaRepository<BookLexeme, UUID> {
    Optional<BookLexeme> findByBookIdAndLexemeId(UUID bookId, UUID lexemeId);

    @Query("select bl from BookLexeme bl join fetch bl.lexeme where bl.book.id = :bookId order by bl.frequency desc, bl.lexeme.lemma asc")
    List<BookLexeme> findForBook(@Param("bookId") UUID bookId);

    @Query("select bl from BookLexeme bl join fetch bl.lexeme where bl.book.id = :bookId and (lower(bl.lexeme.lemma) = lower(:term) or exists (select wf.id from WordForm wf where wf.lexeme.id = bl.lexeme.id and lower(wf.form) = lower(:term))) order by bl.frequency desc")
    List<BookLexeme> lookup(@Param("bookId") UUID bookId, @Param("term") String term);

    @Query("select bl from BookLexeme bl join fetch bl.lexeme where bl.book.id = :bookId and bl.resolutionStatus = 'UNRESOLVED' order by bl.frequency desc")
    List<BookLexeme> findUnresolved(@Param("bookId") UUID bookId);

    @Modifying @Query("delete from BookLexeme bl where bl.book.id = :bookId")
    void deleteByBookId(@Param("bookId") UUID bookId);
}

interface TokenOccurrenceRepository extends JpaRepository<TokenOccurrence, UUID> {
    @Modifying @Query("delete from TokenOccurrence t where t.book.id = :bookId")
    void deleteByBookId(@Param("bookId") UUID bookId);
}

interface AiRequestAuditRepository extends JpaRepository<AiRequestAudit, UUID> {
}
