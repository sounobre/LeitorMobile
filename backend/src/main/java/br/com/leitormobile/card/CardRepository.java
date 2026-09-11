package br.com.leitormobile.card;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CardRepository extends JpaRepository<Card, UUID> {

    @Query("select c from Card c where c.archived = false and c.book.owner.id = :ownerId order by c.queueOrder asc, c.createdAt asc")
    List<Card> findActive(@Param("ownerId") UUID ownerId);

    @Query("select c from Card c where c.book.owner.id = :ownerId order by c.archived asc, c.queueOrder asc, c.createdAt asc")
    List<Card> findAllForOwner(@Param("ownerId") UUID ownerId);

    @Query("select coalesce(max(c.queueOrder), -1) from Card c where c.archived = false and c.book.owner.id = :ownerId")
    int findNextQueueOrder(@Param("ownerId") UUID ownerId);

    Optional<Card> findByIdAndBookOwnerId(UUID id, UUID ownerId);
}