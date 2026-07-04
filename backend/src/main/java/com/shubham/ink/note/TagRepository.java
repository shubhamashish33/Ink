package com.shubham.ink.note;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TagRepository extends JpaRepository<Tag, UUID> {

    List<Tag> findAllByUser_IdAndNameIn(UUID userId, Collection<String> names);
}
