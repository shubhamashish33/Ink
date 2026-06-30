package com.shubham.ink.note;


import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NoteRepository extends JpaRepository<Note, UUID> {

    List<Note> findAllByUser_IdOrderByUpdatedAtDesc(UUID userId);
    
    Optional<Note> findByIdAndUser_Id(UUID id, UUID userId);
    
    void deleteByIdAndUser_Id(UUID id, UUID userId);
}
