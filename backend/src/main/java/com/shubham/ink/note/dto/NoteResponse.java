package com.shubham.ink.note.dto;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record NoteResponse(
    UUID id,
    String title,
    String content,
    Set<String> tags,
    boolean archived,
    boolean pinned,
    Instant createdAt,
    Instant updatedAt
) {
}
