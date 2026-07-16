package com.shubham.ink.note.dto;

import java.time.Instant;
import java.util.UUID;
import java.util.Set;

public record NoteResponse(
    UUID id,
    String title,
    String content,
    Set<String> tags,
    String encryptedPayload,
    Long version,
    boolean archived,
    boolean pinned,
    Instant createdAt,
    Instant updatedAt
) {
    public NoteResponse(UUID id, String title, String content, Set<String> tags, boolean archived, boolean pinned, Instant createdAt, Instant updatedAt) {
        this(id, title, content, tags, null, null, archived, pinned, createdAt, updatedAt);
    }
}
