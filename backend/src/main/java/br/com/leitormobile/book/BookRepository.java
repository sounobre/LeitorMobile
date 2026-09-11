package br.com.leitormobile.book;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookRepository extends JpaRepository<Book, UUID> {

    boolean existsByFileHashAndOwnerId(String fileHash, UUID ownerId);

    @Query("""
            select b from Book b
            where b.owner.id = :ownerId
              and (lower(b.title) like lower(concat('%', :search, '%'))
               or lower(b.author) like lower(concat('%', :search, '%')))
            order by b.lastOpenedAt desc nulls last, b.importedAt desc
            """)
    List<Book> search(@Param("ownerId") UUID ownerId, @Param("search") String search);

    @Query("select b from Book b where b.owner.id = :ownerId order by b.lastOpenedAt desc nulls last, b.importedAt desc")
    List<Book> findLibrary(@Param("ownerId") UUID ownerId);

    Optional<Book> findByIdAndOwnerId(UUID id, UUID ownerId);

    List<Book> findByOwnerIsNull();
}