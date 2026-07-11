package com.shubham.ink.note.dto;

import java.util.Set;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateNoteRequest(
    @Size(max=255) String title,
    String content,
    Set<@Size(max = 64) String> tags,
    @NotBlank String encryptedPayload
) {
    public UpdateNoteRequest(String title, String content, Set<String> tags) { this(title, content, tags, null); }
    public UpdateNoteRequest(String encryptedPayload) { this("", "encrypted", Set.of(), encryptedPayload); }
}
