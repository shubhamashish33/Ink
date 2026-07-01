package com.shubham.ink.note.dto;

import java.time.Instant;
import java.util.UUID;

public record NoteResponse(
    UUID id,
    String title,
    String content,
    boolean archived,
    boolean pinned,
    Instant createdAt,
    Instant updatedAt
) {
}