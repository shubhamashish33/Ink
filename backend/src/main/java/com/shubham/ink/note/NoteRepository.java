package com.shubham.ink.note;


import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NoteRepository extends JpaRepository<Note, UUID> {

    List<Note> findAllByUser_IdOrderByUpdatedAtDesc(UUID userId);

    Optional<Note> findByIdAndUser_Id(UUID id, UUID userId);

    void deleteByIdAndUser_Id(UUID id, UUID userId);

    List<Note> findAllByUser_IdAndArchivedFalseOrderByPinnedDescUpdatedAtDesc(UUID userId);

    List<Note> findAllByUser_IdAndArchivedTrueOrderByUpdatedAtDesc(UUID userId);

    @Query("""
            SELECT n
            FROM Note n
            WHERE n.user.id = :userId
              AND n.archived = false
              AND (
                  LOWER(n.title) LIKE LOWER(CONCAT('%', :query, '%'))
                  OR LOWER(n.content) LIKE LOWER(CONCAT('%', :query, '%'))
              )
            ORDER BY n.pinned DESC, n.updatedAt DESC
            """)
    List<Note> searchActiveNotes( @Param("userId") UUID userId, @Param("query") String query );
}
