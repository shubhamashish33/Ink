package com.shubham.ink.note;


import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface NoteRepository extends JpaRepository<Note, UUID> {

    Page<Note> findAllByUser_IdOrderByUpdatedAtDesc(UUID userId, Pageable pageable);

    Optional<Note> findByIdAndUser_Id(UUID id, UUID userId);

    void deleteByIdAndUser_Id(UUID id, UUID userId);

    Page<Note> findAllByUser_IdAndArchivedFalseOrderByPinnedDescUpdatedAtDesc(UUID userId, Pageable pageable);

    Page<Note> findAllByUser_IdAndArchivedTrueOrderByUpdatedAtDesc(UUID userId, Pageable pageable);

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
    Page<Note> searchActiveNotes(
        @Param("userId") UUID userId,
        @Param("query") String query,
        Pageable pageable
    );
}
