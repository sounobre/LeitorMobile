package br.com.leitormobile.lexicon;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface WordFormLookupRepository extends JpaRepository<WordForm, UUID> {
    @Query("select wf.form from WordForm wf where wf.lexeme.id = :lexemeId order by wf.form asc")
    List<String> findForms(@Param("lexemeId") UUID lexemeId);
}
